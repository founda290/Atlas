export interface BrowserFile {
  path: string
  content: string
}
export interface BrowserProject {
  id: string
  name: string
  description: string
  revision: number
  created: number
  updated: number
  files: BrowserFile[]
}
const LIMIT = 256 * 1024,
  PROJECT_LIMIT = 8 * 1024 * 1024
export function browserPath(value: string): string {
  if (
    !value ||
    value.length > 240 ||
    value.startsWith('/') ||
    /[\\\x00-\x1f%:]/.test(value) ||
    value
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          p === '.git' ||
          p === 'node_modules' ||
          p === '.env' ||
          p.startsWith('.env.') ||
          /^(credentials|secrets?)(\.|$)/i.test(p),
      ) ||
    /\.(pem|key|p12|pfx)$/i.test(value)
  )
    throw new Error(
      'Use a relative source path without traversal, secrets, dependencies or Git internals.',
    )
  return value
}
function validate(project: BrowserProject) {
  if (
    typeof project.name !== 'string' ||
    !project.name.trim() ||
    project.name.length > 80 ||
    typeof project.description !== 'string' ||
    project.description.length > 2000 ||
    !Array.isArray(project.files) ||
    project.files.length > 200
  )
    throw new Error('Project name, description or file count is invalid (maximum 200 files).')
  const seen = new Set<string>()
  let total = 0
  for (const file of project.files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string')
      throw new Error('Invalid project file.')
    browserPath(file.path)
    if (seen.has(file.path)) throw new Error('Duplicate file path.')
    seen.add(file.path)
    const bytes = new TextEncoder().encode(file.content).length
    if (
      bytes > LIMIT ||
      file.content.includes('\0') ||
      new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(file.content)) !==
        file.content
    )
      throw new Error('Files must be valid UTF-8 text, at most 256 KiB.')
    total += bytes
  }
  for (const path of seen)
    if ([...seen].some((other) => other !== path && other.startsWith(`${path}/`)))
      throw new Error('A file cannot also be a parent folder.')
  if (total > PROJECT_LIMIT) throw new Error('Browser project exceeds the 8 MiB source limit.')
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error(
          'This browser does not support IndexedDB. Use a supported browser to store projects on this device.',
        ),
      )
      return
    }
    const request = indexedDB.open('atlas-browser-projects', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' })
    request.onerror = () =>
      reject(
        new Error(
          'Browser storage could not be opened. Check privacy settings and available space.',
        ),
      )
    request.onblocked = () =>
      reject(new Error('Close older Atlas tabs before upgrading browser storage.'))
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, set: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    let value: T, failure: Error | undefined
    const tx = db.transaction('projects', mode)
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onabort = tx.onerror = () => {
      db.close()
      reject(
        failure ??
          new Error(
            'Storage was not committed. Check browser quota/privacy settings, then export your work.',
          ),
      )
    }
    const fail = (error: Error) => {
      failure = error
      tx.abort()
    }
    try {
      work(
        tx.objectStore('projects'),
        (result) => {
          value = result
        },
        fail,
      )
    } catch (e) {
      fail(e instanceof Error ? e : new Error('Invalid project operation.'))
    }
  })
}
function notify() {
  window.dispatchEvent(new Event('atlas-browser-projects'))
}
export const browserProjects = {
  list: () =>
    transaction<BrowserProject[]>('readonly', (store, set) => {
      const request = store.getAll()
      request.onsuccess = () =>
        set((request.result as BrowserProject[]).sort((a, b) => b.updated - a.updated))
    }),
  get: (id: string) =>
    transaction<BrowserProject>('readonly', (store, set, fail) => {
      const request = store.get(id)
      request.onsuccess = () =>
        request.result
          ? set(request.result as BrowserProject)
          : fail(new Error('Browser project not found on this device.'))
    }),
  async create(name: string, description = '', files: BrowserFile[] = []) {
    if (typeof name !== 'string') throw new Error('Enter a valid project name.')
    const now = Date.now(),
      project: BrowserProject = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description,
        revision: 1,
        created: now,
        updated: now,
        files,
      }
    validate(project)
    await transaction<void>('readwrite', (store) => {
      store.add(project)
    })
    notify()
    return project
  },
  async update(id: string, revision: number, change: (project: BrowserProject) => void) {
    const result = await transaction<BrowserProject>('readwrite', (store, set, fail) => {
      const request = store.get(id)
      request.onsuccess = () => {
        try {
          const project = request.result as BrowserProject | undefined
          if (!project) throw new Error('Browser project not found.')
          if (project.revision !== revision)
            throw new Error(
              'This project changed in another tab. Your draft has been kept. Export/copy it before reloading.',
            )
          change(project)
          validate(project)
          project.revision++
          project.updated = Date.now()
          store.put(project)
          set(project)
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Project could not be saved.'))
        }
      }
    })
    notify()
    return result
  },
  async remove(id: string, revision: number, confirmName: string) {
    await transaction<void>('readwrite', (store, _set, fail) => {
      const request = store.get(id)
      request.onsuccess = () => {
        const p = request.result as BrowserProject | undefined
        if (!p || p.name !== confirmName || p.revision !== revision) {
          fail(
            new Error(
              'Project changed or confirmation name does not match. Reload before deleting.',
            ),
          )
          return
        }
        store.delete(id)
      }
    })
    notify()
  },
  export(project: BrowserProject) {
    validate(project)
    return JSON.stringify(
      {
        format: 'atlas-browser-project',
        version: 1,
        name: project.name,
        description: project.description,
        files: project.files,
      },
      null,
      2,
    )
  },
  async import(text: string) {
    if (new TextEncoder().encode(text).length > 12 * 1024 * 1024)
      throw new Error('Import is too large (maximum 12 MiB JSON).')
    const input: unknown = JSON.parse(text)
    if (!input || typeof input !== 'object') throw new Error('Invalid project bundle.')
    const p = input as Record<string, unknown>
    if (p.format !== 'atlas-browser-project' || p.version !== 1)
      throw new Error('Unsupported project bundle.')
    return this.create(p.name as string, p.description as string, p.files as BrowserFile[])
  },
}
