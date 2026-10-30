import { randomUUID } from 'node:crypto'
import { mkdir, lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Store } from '../database/store.js'
import { ServiceError, text, type ProjectRow, publicProject } from '../domain.js'
export class Projects {
  constructor(
    readonly store: Store,
    readonly workspaceRoot: string,
  ) {}
  async initialize() {
    await mkdir(this.workspaceRoot, { recursive: true, mode: 0o700 })
    if ((await lstat(this.workspaceRoot)).isSymbolicLink())
      throw new Error('Workspace root must not be a symlink')
  }
  async get(id: string, archived = true) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new ServiceError(404, 'Project not found')
    const row = await this.store.project(id)
    if (!row || row.status === 'deleted' || (!archived && row.status !== 'active'))
      throw new ServiceError(404, 'Active project not found')
    const allowedRoot = await realpath(this.workspaceRoot)
    const expected = path.join(allowedRoot, row.id)
    if (
      path.resolve(row.rootPath) !== expected ||
      (await lstat(expected)).isSymbolicLink() ||
      (await realpath(expected)) !== expected
    )
      throw new ServiceError(403, 'Project workspace boundary is invalid')
    return row
  }
  async create(input: Record<string, unknown>) {
    const name = text(input.name, 'project name', 80)
    if (/[\\/\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..')
      throw new ServiceError(400, 'Project name cannot contain path separators')
    const description = text(input.description, 'description', 2000, true)
    if (input.location !== undefined && input.location !== 'managed')
      throw new ServiceError(400, 'Choose the managed workspace location')
    if (
      (await this.store.projects()).some(
        (p) =>
          p.status !== 'deleted' &&
          p.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'),
      )
    )
      throw new ServiceError(409, 'A project with this name already exists')
    const id = randomUUID(),
      now = Date.now(),
      rootPath = path.join(await realpath(this.workspaceRoot), id)
    await mkdir(rootPath, { mode: 0o700 })
    const row: ProjectRow = {
      id,
      workspaceId: id,
      name,
      description,
      rootPath,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    }
    await promisify(execFile)(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'init.templateDir=',
        'init',
        '--initial-branch=main',
        rootPath,
      ],
      {
        timeout: 10000,
        maxBuffer: 100000,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    )
    try {
      await this.store.saveProject(row)
    } catch {
      throw new ServiceError(
        409,
        'Project could not be registered; the directory was retained for safety',
      )
    }
    await this.store.event(id, { type: 'project.created' })
    return publicProject(row)
  }
  async update(id: string, input: Record<string, unknown>) {
    const row = await this.get(id)
    if (input.name !== undefined) {
      const name = text(input.name, 'project name', 80)
      if (/[\\/\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..')
        throw new ServiceError(400, 'Invalid project name')
      if (
        (await this.store.projects()).some(
          (p) =>
            p.id !== id && p.status !== 'deleted' && p.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new ServiceError(409, 'Project name already exists')
      row.name = name
    }
    if (input.description !== undefined)
      row.description = text(input.description, 'description', 2000, true)
    if (input.status !== undefined) {
      if (!['active', 'archived'].includes(String(input.status)))
        throw new ServiceError(400, 'Invalid project status')
      row.status = input.status as 'active' | 'archived'
    }
    if (input.open === true) row.lastOpenedAt = Date.now()
    row.updatedAt = Date.now()
    await this.store.saveProject(row)
    await this.store.event(id, { type: 'project.updated' })
    return publicProject(row)
  }
  async remove(id: string, input: Record<string, unknown>) {
    const row = await this.get(id)
    if (input.confirmName !== row.name)
      throw new ServiceError(400, 'Confirm deletion by typing the exact project name')
    row.status = 'deleted'
    row.updatedAt = Date.now()
    await this.store.saveProject(row)
    await this.store.event(id, { type: 'project.deleted' })
    return { deleted: true, directoryRetained: true }
  }
}
