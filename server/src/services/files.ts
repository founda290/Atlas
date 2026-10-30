import { constants } from 'node:fs'
import { lstat, open, readdir, realpath, rename, unlink, mkdir, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { WorkspaceGuard } from '../runtime.js'
import {
  isSensitivePath,
  isSupportedTextPath,
  MAX_FILE_BYTES,
  readWorkspaceFile,
  validateFilePath,
} from '../workspace-files.js'
import { ServiceError, type ProjectRow, type PublicFile } from '../domain.js'
const excluded = new Set([
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.atlas',
  '.DS_Store',
  'target',
  '.turbo',
  '__pycache__',
  ...(process.env.ATLAS_FILE_EXCLUDES ?? '').split(',').filter(Boolean),
])
export const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')
export class Files {
  private queues = new Map<string, Promise<unknown>>()
  async locked<T>(id: string, action: () => Promise<T>) {
    const previous = this.queues.get(id) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(action)
    this.queues.set(id, next)
    try {
      return await next
    } finally {
      if (this.queues.get(id) === next) this.queues.delete(id)
    }
  }
  validate(relative: string) {
    validateFilePath(relative)
    if (relative.split('/').some((p) => excluded.has(p)))
      throw new ServiceError(403, 'This path is excluded by the workspace policy')
  }
  async target(project: ProjectRow, relative: string, allowMissing = false) {
    this.validate(relative)
    const root = await realpath(project.rootPath)
    let current = root
    const parts = relative.split('/')
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index])
      try {
        const stat = await lstat(current)
        if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1))
          throw new ServiceError(403, 'Symlinks and hard-linked files are not permitted')
        if (index < parts.length - 1 && !stat.isDirectory())
          throw new ServiceError(404, 'Parent directory not found')
      } catch (error) {
        if (
          allowMissing &&
          index === parts.length - 1 &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        )
          return current
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          throw new ServiceError(404, 'Project path not found')
        throw error
      }
    }
    const canonical = await realpath(current)
    if (!canonical.startsWith(root + path.sep))
      throw new ServiceError(403, 'Path escapes project workspace')
    return current
  }
  async inventory(project: ProjectRow) {
    const files: PublicFile[] = []
    let truncated = false
    const walk = async (directory: string, prefix: string, depth: number) => {
      if (depth > 24 || files.length >= 10000) {
        truncated = true
        return
      }
      for (const name of (await readdir(directory)).sort()) {
        if (isSensitivePath(name) || excluded.has(name) || name.startsWith('.atlas-tmp-')) continue
        const relative = prefix ? `${prefix}/${name}` : name
        const info = await lstat(path.join(directory, name))
        if (info.isSymbolicLink() || (info.isFile() && info.nlink > 1)) continue
        if (files.length >= 10000) {
          truncated = true
          return
        }
        if (info.isDirectory()) {
          files.push({ path: relative, kind: 'directory', bytes: 0, modifiedAt: info.mtimeMs })
          await walk(await this.target(project, relative), relative, depth + 1)
        } else if (info.isFile() && info.size <= MAX_FILE_BYTES)
          files.push({ path: relative, kind: 'file', bytes: info.size, modifiedAt: info.mtimeMs })
      }
    }
    await walk(await realpath(project.rootPath), '', 0)
    return { workspaceId: project.id, files, truncated }
  }
  async read(project: ProjectRow, relative: string) {
    await this.target(project, relative)
    const result = await readWorkspaceFile(
      new WorkspaceGuard(project.rootPath, project.id),
      relative,
    )
    const metadata = await lstat(await this.target(project, relative))
    return {
      ...result,
      version: hash(result.content),
      modifiedAt: metadata.mtimeMs,
      readOnly: project.status !== 'active',
    }
  }
  async write(
    project: ProjectRow,
    relative: string,
    content: string,
    expectedVersion: string | null,
    creating = false,
    initialMode = 0o600,
  ) {
    if (project.status !== 'active') throw new ServiceError(409, 'Archived project is read-only')
    if (
      typeof content !== 'string' ||
      Buffer.byteLength(content) > MAX_FILE_BYTES ||
      content.includes('\0')
    )
      throw new ServiceError(413, 'Text content must be UTF-8, without NUL, and at most 256 KiB')
    if (Buffer.from(content, 'utf8').toString('utf8') !== content)
      throw new ServiceError(415, 'Content contains invalid Unicode')
    if (!isSupportedTextPath(relative)) throw new ServiceError(415, 'Unsupported text file type')
    const target = await this.target(project, relative, true)
    let mode = initialMode
    try {
      const current = await this.read(project, relative)
      if (creating || current.version !== expectedVersion)
        throw new ServiceError(
          409,
          'File changed on disk; reload or reconcile before saving',
          'file_conflict',
        )
      mode = (await lstat(target)).mode & 0o777
    } catch (error) {
      if (!(error instanceof ServiceError && error.status === 404)) throw error
      if (!creating || expectedVersion !== null)
        throw new ServiceError(409, 'File no longer exists; create it explicitly')
    }
    const parent = await realpath(path.dirname(target)),
      parentInfo = await lstat(parent)
    const temporary = path.join(parent, `.atlas-tmp-${randomUUID()}`)
    const handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      mode,
    )
    try {
      await handle.chmod(mode)
      await handle.writeFile(content, 'utf8')
      await handle.sync()
      await handle.close()
      const check = await lstat(await realpath(path.dirname(target)))
      if (check.ino !== parentInfo.ino || check.dev !== parentInfo.dev)
        throw new ServiceError(409, 'Parent directory changed during save')
      await this.target(project, relative, true)
      if (!creating && (await this.read(project, relative)).version !== expectedVersion)
        throw new ServiceError(409, 'Concurrent file modification detected', 'file_conflict')
      if (creating) {
        // Exclusive hard-link installation prevents overwriting an existing destination.
        const { link } = await import('node:fs/promises')
        try {
          await link(temporary, target)
        } catch {
          throw new ServiceError(409, 'Destination already exists')
        }
        await unlink(temporary)
      } else await rename(temporary, target)
      return await this.read(project, relative)
    } finally {
      await handle.close().catch(() => undefined)
      await unlink(temporary).catch(() => undefined)
    }
  }
  async folder(project: ProjectRow, relative: string) {
    if (project.status !== 'active') throw new ServiceError(409, 'Archived project is read-only')
    await mkdir(await this.target(project, relative, true), { mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'EEXIST') throw new ServiceError(409, 'Path already exists')
        throw error
      },
    )
    return { path: relative, kind: 'directory' }
  }
  async remove(
    project: ProjectRow,
    relative: string,
    expectedVersion: string,
    confirmation: string,
  ) {
    if (project.status !== 'active') throw new ServiceError(409, 'Archived project is read-only')
    if (confirmation !== relative)
      throw new ServiceError(400, 'Type the exact path to confirm deletion')
    const target = await this.target(project, relative)
    if ((await lstat(target)).isDirectory()) {
      await rmdir(target).catch(() => {
        throw new ServiceError(409, 'Only empty folders may be deleted')
      })
    } else {
      if ((await this.read(project, relative)).version !== expectedVersion)
        throw new ServiceError(409, 'File changed; deletion refused')
      await unlink(target)
    }
    return { deleted: true, path: relative }
  }
  async move(project: ProjectRow, relative: string, destination: string, expectedVersion: string) {
    if (project.status !== 'active') throw new ServiceError(409, 'Archived project is read-only')
    const source = await this.target(project, relative),
      target = await this.target(project, destination, true)
    const info = await lstat(source)
    if (info.isDirectory()) {
      // No recursive move of unreviewed secrets/symlinks or tree changes. Empty folders only.
      if ((await readdir(source)).length)
        throw new ServiceError(
          409,
          'Only empty folders can be renamed safely; move individual files instead',
        )
      await mkdir(target, { mode: 0o700 })
      await rmdir(source)
    } else {
      if (!isSupportedTextPath(destination))
        throw new ServiceError(415, 'Unsupported destination type')
      const data = await this.read(project, relative)
      if (data.version !== expectedVersion)
        throw new ServiceError(409, 'File changed; rename refused')
      await this.write(project, destination, data.content, null, true, info.mode & 0o777)
      if ((await this.read(project, relative)).version !== expectedVersion)
        throw new ServiceError(409, 'Source changed during rename; destination copy retained')
      await unlink(source)
    }
    return { path: destination }
  }
}
