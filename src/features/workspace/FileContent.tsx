import { useCallback, useEffect, useRef } from 'react'
import { Badge, CodeBlock, ErrorState, Loading } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { api } from '../../services/api'

export function FileContent({ path, revision }: { path: string; revision: number }) {
  const loader = useCallback((signal: AbortSignal) => api.file(path, signal), [path])
  const resource = useResource(loader)
  const lastRevision = useRef(revision)
  useEffect(() => {
    if (lastRevision.current !== revision) {
      lastRevision.current = revision
      resource.reload()
    }
  }, [revision, resource.reload])
  const language = path.includes('.') ? (path.split('.').pop() ?? 'text') : 'text'
  return (
    <section className="file-content" aria-label={`File contents: ${path}`}>
      <div className="file-content-toolbar">
        <Badge>Read-only UTF-8</Badge>
        <button
          type="button"
          className="text-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          Refresh file
        </button>
      </div>
      {resource.loading ? (
        <Loading label="Reading selected workspace file" />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data && resource.data.path === path ? (
        <>
          <p className="file-content-info">
            {resource.data.bytes.toLocaleString()} bytes ·{' '}
            {resource.data.content.split('\n').length.toLocaleString()} lines · no save operation
          </p>
          <div className="file-source">
            <CodeBlock code={resource.data.content} language={language} />
          </div>
          {resource.data.content === '' && <p className="file-content-info">This file is empty.</p>}
        </>
      ) : null}
      <p className="file-content-info">
        Preview is limited to supported UTF-8 text files up to 256 KiB. Use your local editor to
        make changes.
      </p>
    </section>
  )
}
