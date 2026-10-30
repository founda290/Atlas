import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader, Button, Loading, ErrorState } from '../components/ui'
import { FileEditor } from '../features/workspace/FileEditor'
import { FileExplorer } from '../features/workspace/FileExplorer'
import { GitChanges } from '../features/workspace/GitChanges'
import { useResource } from '../hooks/useResource'
import { api } from '../services/api'
export function ProjectEditorPage() {
  const { projectId = '' } = useParams()
  return <ProjectEditor key={projectId} projectId={projectId} />
}
function ProjectEditor({ projectId }: { projectId: string }) {
  const [selected, setSelected] = useState(''),
    [view, setView] = useState('files'),
    [revision, setRevision] = useState(0),
    [selectionRevision, setSelectionRevision] = useState(0)
  const load = useCallback(
    async (signal: AbortSignal) => ({
      project: await api.project(projectId, signal),
      inventory: await api.workspace(signal, projectId),
    }),
    [projectId],
  )
  const resource = useResource(load)
  const refresh = () => {
    resource.reload()
    setRevision((r) => r + 1)
  }
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Editor"
        title={resource.data?.project.name ?? 'Project editor'}
        description="Work with actual project files even when the model runtime is unavailable."
        action={<Button href={`/projects/${projectId}`}>Project overview</Button>}
      />
      <div className="app-page-body">
        {resource.data?.inventory.truncated && (
          <p className="activity-notice">
            Inventory reached its bounded path/depth limit. Not all files are listed.
          </p>
        )}
        <div className="editor-actions">
          <Button secondary onClick={() => setView('files')}>
            Files and editor
          </Button>
          <Button secondary onClick={() => setView('changes')}>
            Git changes
          </Button>
        </div>
        {resource.error && resource.data && (
          <ErrorState message={resource.error} retry={resource.reload} />
        )}
        {resource.loading && !resource.data ? (
          <Loading />
        ) : resource.error && !resource.data ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : (
          <>
            <div className="project-editor-layout" hidden={view !== 'files'}>
              <FileExplorer
                files={resource.data?.inventory.files ?? []}
                selected={selected}
                select={(path) => {
                  setSelected(path)
                  setSelectionRevision((r) => r + 1)
                }}
                refresh={refresh}
              />
              <FileEditor
                projectId={projectId}
                selected={selected}
                selectionRevision={selectionRevision}
                revision={revision}
                readOnly={resource.data?.project.status !== 'active'}
                onChange={refresh}
              />
            </div>
            <GitChanges
              projectId={projectId}
              active={view === 'changes'}
              revision={revision}
              onChange={refresh}
            />
          </>
        )}
      </div>
    </>
  )
}
