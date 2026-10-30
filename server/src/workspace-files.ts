import { constants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { WorkspaceGuard } from './runtime.js'

export const MAX_FILE_BYTES = 256 * 1024
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.txt',
  '.css',
  '.scss',
  '.html',
  '.svg',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
  '.bash',
  '.sql',
  '.vue',
  '.svelte',
])
const textNames = new Set([
  'dockerfile',
  'makefile',
  'license',
  'readme',
  '.gitignore',
  '.editorconfig',
])
const blockedDirectories = new Set([
  '.git',
  'node_modules',
  '.ssh',
  '.aws',
  '.azure',
  '.gnupg',
  '.config',
  '.local',
  '.cache',
  '.opencode',
])
const blockedNames = new Set([
  '.npmrc',
  '.yarnrc',
  '.netrc',
  '.git-credentials',
  '.pypirc',
  'credentials',
  'credentials.json',
  'auth.json',
  'secrets.json',
  'secrets.yaml',
  'secrets.yml',
  'id_rsa',
  'id_ed25519',
])

export class WorkspaceFileError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'WorkspaceFileError'
  }
}
/** Shared visibility policy for inventory, reads and runtime diff paths. Not a secret scanner. */
export function isSensitivePath(relativePath: string) {
  return relativePath.split(/[\\/]/).some((part) => {
    const name = part.toLowerCase()
    return (
      blockedDirectories.has(name) ||
      blockedNames.has(name) ||
      name.startsWith('.env') ||
      /\.(pem|key|p12|pfx|keystore)$/.test(name)
    )
  })
}
export function validateFilePath(relativePath: string) {
  if (
    !relativePath ||
    relativePath.length > 2048 ||
    /[\\%\x00-\x1f\x7f]/.test(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    /^[a-z]:/i.test(relativePath) ||
    relativePath.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new WorkspaceFileError(
      400,
      'Use a workspace-relative file path without traversal or encoded separators',
    )
  }
  if (isSensitivePath(relativePath))
    throw new WorkspaceFileError(403, 'This path is restricted by the workspace file policy')
}
function isInside(root: string, target: string) {
  const relative = path.relative(root, target)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}
export function isSupportedTextPath(relativePath: string) {
  return (
    textExtensions.has(path.extname(relativePath).toLowerCase()) ||
    textNames.has(path.basename(relativePath).toLowerCase())
  )
}

/** Bounded, UTF-8-only, read-only access. No arbitrary filesystem or save endpoint. */
export async function readWorkspaceFile(guard: WorkspaceGuard, relativePath: string) {
  validateFilePath(relativePath)
  if (!isSupportedTextPath(relativePath))
    throw new WorkspaceFileError(415, 'This file type is not supported for text preview')
  const root = await guard.assert()
  const target = path.resolve(root, relativePath)
  if (!isInside(root, target))
    throw new WorkspaceFileError(403, 'File is outside the configured workspace')
  try {
    // Reject every symlink component, not only the final file.
    let candidate = root
    for (const component of relativePath.split('/')) {
      candidate = path.join(candidate, component)
      if ((await lstat(candidate)).isSymbolicLink())
        throw new WorkspaceFileError(403, 'Symbolic links are not available for file preview')
    }
    const canonical = await guard.safePath(relativePath)
    if (!isInside(root, canonical))
      throw new WorkspaceFileError(403, 'File is outside the configured workspace')
    const handle = await open(
      target,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    )
    try {
      const info = await handle.stat()
      if (!info.isFile())
        throw new WorkspaceFileError(415, 'Only regular text files can be previewed')
      if (info.size > MAX_FILE_BYTES)
        throw new WorkspaceFileError(413, 'File exceeds the 256 KiB text-preview limit')
      // On Linux validate the opened descriptor, closing parent-symlink swap races.
      const openedPath = await realpath(
        process.platform === 'linux' ? `/proc/self/fd/${handle.fd}` : target,
      )
      if (!isInside(root, openedPath) || isSensitivePath(path.relative(root, openedPath)))
        throw new WorkspaceFileError(403, 'File is outside the permitted workspace paths')
      const current = await lstat(target)
      if (current.isSymbolicLink() || current.dev !== info.dev || current.ino !== info.ino)
        throw new WorkspaceFileError(409, 'File changed during access; refresh and retry')
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1)
      let length = 0
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length)
        if (!bytesRead) break
        length += bytesRead
      }
      if (length > MAX_FILE_BYTES)
        throw new WorkspaceFileError(413, 'File exceeds the 256 KiB text-preview limit')
      const bytes = buffer.subarray(0, length)
      if (bytes.includes(0))
        throw new WorkspaceFileError(415, 'Binary files are not supported for text preview')
      let content: string
      try {
        content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      } catch {
        throw new WorkspaceFileError(415, 'File is not valid UTF-8 text')
      }
      return {
        workspaceId: guard.id,
        path: relativePath,
        content,
        bytes: length,
        encoding: 'utf-8' as const,
        readOnly: true as const,
      }
    } finally {
      await handle.close()
    }
  } catch (failure) {
    if (failure instanceof WorkspaceFileError) throw failure
    const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : ''
    if (code === 'ENOENT' || code === 'ENOTDIR')
      throw new WorkspaceFileError(404, 'Workspace file not found')
    if (code === 'ELOOP' || code === 'EACCES' || code === 'EPERM')
      throw new WorkspaceFileError(403, 'Workspace file access was denied')
    throw new WorkspaceFileError(503, 'Workspace file could not be read safely')
  }
}
