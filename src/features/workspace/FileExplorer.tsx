import { useState } from 'react'
import { Button, EmptyState, Icon, SearchInput } from '../../components/ui'
import type { WorkspaceFile } from '../../types/api'
import { buildFileTree, type FileNode } from './data'
function FileBranch({
  node,
  selected,
  select,
}: {
  node: FileNode
  selected: string
  select: (path: string) => void
}) {
  return node.file ? (
    <li>
      <button
        type="button"
        className={`explorer-file ${selected === node.path ? 'selected' : ''}`}
        onClick={() => select(node.path)}
        aria-current={selected === node.path ? 'true' : undefined}
        title={node.path}
      >
        <Icon name="file" />
        <span>{node.name}</span>
        <small>{node.name.includes('.') ? node.name.split('.').pop() : 'file'}</small>
      </button>
    </li>
  ) : (
    <li>
      <details open>
        <summary>
          <Icon name="folder" />
          {node.name}
        </summary>
        <ul>
          {node.children.map((child) => (
            <FileBranch key={child.path} node={child} selected={selected} select={select} />
          ))}
        </ul>
      </details>
    </li>
  )
}
export function FileExplorer({
  files,
  selected,
  select,
  refresh,
}: {
  files: WorkspaceFile[]
  selected: string
  select: (path: string) => void
  refresh: () => void
}) {
  const [search, setSearch] = useState('')
  const tree = buildFileTree(
    files.filter((file) => file.path.toLowerCase().includes(search.toLowerCase())),
  )
  return (
    <div className="explorer">
      <div className="workbench-panel-header">
        <h2>Explorer</h2>
        <button type="button" className="text-button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <SearchInput
        label="Search workspace paths"
        value={search}
        onChange={setSearch}
        placeholder="Filter files…"
      />
      {tree.length ? (
        <ul className="file-tree">
          {tree.map((node) => (
            <FileBranch key={node.path} node={node} selected={selected} select={select} />
          ))}
        </ul>
      ) : (
        <EmptyState title={search ? 'No matching files' : 'Workspace is empty'}>
          {search ? 'Try a different path.' : 'Add files using your local tools, then refresh.'}
        </EmptyState>
      )}
      <div className="explorer-footer">
        <span>{files.length} files · inventory only</span>
        <Button secondary href="/docs/workspace">
          File access limitations
        </Button>
      </div>
    </div>
  )
}
export function FileDetails({ file }: { file: WorkspaceFile }) {
  return (
    <div className="file-details">
      <p className="panel-eyebrow">Selected file / metadata</p>
      <h2>{file.path.split('/').pop()}</h2>
      <code>{file.path}</code>
      <dl className="detail-list">
        <div>
          <dt>Type</dt>
          <dd>{file.path.includes('.') ? file.path.split('.').pop()?.toUpperCase() : 'File'}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            {file.bytes === undefined ? 'Not reported' : `${file.bytes.toLocaleString()} bytes`}
          </dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>Read-only inventory</dd>
        </div>
      </dl>
      <div className="file-access-notice">
        <Icon name="file" />
        <h3>Open this file in your local editor.</h3>
        <p>
          Atlas knows this path exists, but its API does not expose file contents or editing. No
          code has been substituted here.
        </p>
      </div>
    </div>
  )
}
