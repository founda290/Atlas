import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { lstat, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { ProjectRow } from '../domain.js'
import { ServiceError } from '../domain.js'
import { Files, hash } from './files.js'
import { isSupportedTextPath, MAX_FILE_BYTES } from '../workspace-files.js'
const execute = promisify(execFile)
export class Git {
  constructor(private files: Files) {}
  private async inspect(project: ProjectRow) {
    const root = path.join(project.rootPath, '.git'),
      stack = [root]
    let count = 0
    while (stack.length) {
      const current = stack.pop()!,
        info = await lstat(current).catch(() => null)
      if (!info) {
        if (current === root) throw new ServiceError(409, 'Project is not a managed Git repository')
        continue
      }
      if (
        info.isSymbolicLink() ||
        (!info.isDirectory() && !info.isFile()) ||
        (info.isFile() && info.nlink !== 1)
      )
        throw new ServiceError(409, 'Unsafe Git metadata links or special files; review locally')
      if (++count > 10000)
        throw new ServiceError(
          409,
          'Git metadata exceeds the bounded inspection limit; review locally',
        )
      if (info.isDirectory())
        for (const entry of await readdir(current)) stack.push(path.join(current, entry))
    }
    for (const file of [
      'commondir',
      'gitdir',
      'objects/info/alternates',
      'objects/info/http-alternates',
    ])
      if (await lstat(path.join(root, file)).catch(() => null))
        throw new ServiceError(409, 'External Git worktrees/object stores require local review')
  }
  private async run(project: ProjectRow, args: string[], diff = false) {
    const git = await lstat(path.join(project.rootPath, '.git')).catch(() => null)
    if (!git?.isDirectory() || git.isSymbolicLink())
      throw new ServiceError(409, 'Project is not a managed Git repository')
    const config = await lstat(path.join(project.rootPath, '.git/config')).catch(() => null)
    if (
      config &&
      (!config.isFile() || config.isSymbolicLink() || config.nlink !== 1 || config.size > 65536)
    )
      throw new ServiceError(409, 'Unsafe Git configuration; review locally')
    const base = [
      '--literal-pathspecs',
      '--no-pager',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.attributesFile=/dev/null',
      '-c',
      'diff.external=',
    ]
    const options = {
      cwd: project.rootPath,
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'buffer' as const,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: 'C.UTF-8',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_NO_REPLACE_OBJECTS: '1',
      },
    }
    const decode = (bytes: Buffer) => {
      try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      } catch {
        throw new ServiceError(415, 'Git output contains non-UTF-8 data; review locally')
      }
    }
    try {
      const local = decode(
        (await execute('git', [...base, 'config', '--local', '--no-includes', '--list'], options))
          .stdout,
      )
      // Status itself can run clean filters. Refuse before *any* status/diff/index operation.
      if (
        /^(filter\.|include\.|includeif\.|core\.worktree=|extensions\.worktreeconfig=)/im.test(
          local,
        )
      )
        throw new ServiceError(
          409,
          'Git filters/includes/external worktrees require local review; operation refused',
        )
      return decode((await execute('git', [...base, ...args], options)).stdout)
    } catch (error) {
      if (error instanceof ServiceError) throw error
      const result = error as { code?: number; stdout?: Buffer }
      if (diff && result.code === 1 && result.stdout) return decode(result.stdout)
      throw new ServiceError(
        409,
        'Git operation failed. Check repository state locally; no blanket reset was performed.',
      )
    }
  }
  private async blob(project: ProjectRow, revision: string, relative: string) {
    this.files.validate(relative)
    if (revision === '') {
      const tracked = await this.run(project, ['ls-files', '--stage', '--', relative])
      if (!tracked.trim()) return ''
      if (!/^(100644|100755) /.test(tracked))
        throw new ServiceError(415, 'Unsupported index file mode')
    } else {
      if (!(await this.run(project, ['rev-parse', '--verify', 'HEAD']).catch(() => ''))) return ''
      const tree = await this.run(project, ['ls-tree', '-z', 'HEAD', '--', relative])
      if (!tree) return ''
      if (!/^(100644|100755) /.test(tree)) throw new ServiceError(415, 'Unsupported tree file mode')
    }
    return this.run(project, ['show', '--no-ext-diff', '--no-textconv', `${revision}:${relative}`])
  }
  private async item(
    project: ProjectRow,
    file: string,
    status: string,
    oldPath?: string,
    head = '',
  ) {
    this.files.validate(file)
    if (oldPath) this.files.validate(oldPath)
    const metadata = await this.files.target(project, file, true).catch((error: unknown) => {
      if (error instanceof ServiceError && error.status === 404)
        return path.join(project.rootPath, file)
      throw error
    })
    const info = await lstat(metadata).catch(() => null)
    if (info && !info.isFile()) throw new ServiceError(415, 'Only regular text files are reviewed')
    if (!isSupportedTextPath(file) || (info?.size ?? 0) > MAX_FILE_BYTES)
      throw new ServiceError(415, 'File omitted by text policy')
    const content = info ? (await this.files.read(project, file)).content : ''
    const index = await this.blob(project, '', file)
    const indexState = await this.run(project, ['ls-files', '--stage', '--', file])
    if (Buffer.byteLength(index) > MAX_FILE_BYTES || index.includes('\0'))
      throw new ServiceError(415, 'Index file omitted by size/type policy')
    return {
      path: file,
      status,
      oldPath,
      version: hash(
        `${status}\0${content}\0${index}\0${head}\0${oldPath ?? ''}\0${info?.mode ?? 0}\0${indexState}`,
      ),
    }
  }
  async status(project: ProjectRow) {
    try {
      await this.inspect(project)
      const head = await this.run(project, ['rev-parse', '--verify', 'HEAD']).catch(() => '')
      const raw = await this.run(project, [
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
      ])
      const chunks = raw.split('\0').filter(Boolean),
        files = []
      let omitted = 0
      for (let i = 0; i < chunks.length; i++) {
        const status = chunks[i].slice(0, 2),
          file = chunks[i].slice(3)
        const oldPath = /[RC]/.test(status) ? chunks[++i] : undefined
        if (files.length >= 100) {
          omitted++
          continue
        }
        try {
          files.push(await this.item(project, file, status, oldPath, head))
        } catch {
          omitted++
        }
      }
      const branch = (
        await this.run(project, ['symbolic-ref', '--short', 'HEAD']).catch(() => 'detached')
      ).trim()
      return { repository: true, branch, files, omitted, attribution: 'unattributed' as const }
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.message === 'Project is not a managed Git repository'
      )
        return {
          repository: false,
          branch: null,
          files: [],
          omitted: 0,
          attribution: 'unattributed' as const,
        }
      throw error
    }
  }
  async diff(project: ProjectRow, comparison: string) {
    if (!['working', 'staged', 'head'].includes(comparison))
      throw new ServiceError(400, 'Choose working, staged or head comparison')
    const status = await this.status(project),
      diffs = []
    let omitted = status.omitted,
      total = 0
    const hasHead =
      comparison === 'head'
        ? Boolean(await this.run(project, ['rev-parse', '--verify', 'HEAD']).catch(() => ''))
        : true
    for (const entry of status.files) {
      if (
        (comparison === 'working' && entry.status !== '??' && entry.status[1] === ' ') ||
        (comparison === 'staged' && [' ', '?'].includes(entry.status[0]))
      )
        continue
      try {
        const before = await this.blob(
          project,
          comparison === 'working' ? '' : 'HEAD',
          comparison === 'working' ? entry.path : (entry.oldPath ?? entry.path),
        )
        const after =
          comparison === 'staged'
            ? await this.blob(project, '', entry.path)
            : (
                await this.files.read(project, entry.path).catch((error: unknown) => {
                  if (error instanceof ServiceError && error.status === 404) return { content: '' }
                  throw error
                })
              ).content
        if (before === after && !(entry.oldPath && comparison !== 'working')) continue
        const size = Buffer.byteLength(before) + Buffer.byteLength(after)
        if (size > MAX_FILE_BYTES || total + size > 1024 * 1024 || before.includes('\0')) {
          omitted++
          continue
        }
        const args = [
          'diff',
          '--no-ext-diff',
          '--no-textconv',
          '--no-color',
          '--unified=3',
          ...(comparison === 'staged' ? ['--cached'] : comparison === 'head' ? ['HEAD'] : []),
          '--',
          entry.path,
          ...(entry.oldPath ? [entry.oldPath] : []),
        ]
        const unified =
          entry.status === '??' || (comparison === 'head' && !hasHead)
            ? await this.run(
                project,
                [
                  'diff',
                  '--no-ext-diff',
                  '--no-textconv',
                  '--no-index',
                  '--',
                  '/dev/null',
                  entry.path,
                ],
                true,
              )
            : await this.run(project, args)
        total += size
        diffs.push({
          ...entry,
          before,
          after,
          unified,
          additions: unified.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
            .length,
          deletions: unified.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'))
            .length,
          file: entry.path,
        })
      } catch (error) {
        if (error instanceof ServiceError && [413, 415].includes(error.status)) {
          omitted++
          continue
        }
        throw error
      }
    }
    return {
      ...status,
      diffs,
      omitted,
      comparison,
      source: 'git' as const,
      authoritativeFilesystem: true,
      fetchedAt: Date.now(),
    }
  }
  async action(
    project: ProjectRow,
    action: string,
    file: string,
    expectedVersion: string,
    confirmation?: string,
  ) {
    if (project.status !== 'active') throw new ServiceError(409, 'Archived project is read-only')
    this.files.validate(file)
    const current = (await this.status(project)).files.find((f) => f.path === file)
    if (!current || current.version !== expectedVersion)
      throw new ServiceError(409, 'Git/file state changed; refresh before modifying it')
    if (action === 'stage') await this.run(project, ['add', '--', file])
    else if (action === 'unstage') {
      const head = await this.run(project, ['rev-parse', '--verify', 'HEAD']).catch(() => null)
      if (head)
        await this.run(project, [
          'restore',
          '--staged',
          '--',
          file,
          ...(current.oldPath ? [current.oldPath] : []),
        ])
      else await this.run(project, ['update-index', '--force-remove', '--', file])
    } else if (action === 'revert') {
      if (confirmation !== file)
        throw new ServiceError(400, 'Type the exact file path to discard unstaged changes')
      if (
        current.status === '??' ||
        current.status[1] === ' ' ||
        current.status.includes('D') ||
        /[RCU]/.test(current.status)
      )
        throw new ServiceError(
          409,
          'Only existing tracked files with unstaged edits can be reverted; untracked/deleted/conflicted/renamed files require local review',
        )
      const mode = await this.run(project, ['ls-files', '--stage', '--', file])
      if (!/^(100644|100755) /.test(mode)) throw new ServiceError(409, 'Unsupported Git file mode')
      const content = await this.blob(project, '', file),
        currentFile = await this.files.read(project, file)
      await this.files.write(project, file, content, currentFile.version)
    } else throw new ServiceError(400, 'Unknown Git action')
    return this.status(project)
  }
}
