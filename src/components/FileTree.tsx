import { useState } from 'react'
import type { FileNode } from '../types'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

interface FileTreeProps {
  node: FileNode
  selectedNode: FileNode | null
  onSelect: (node: FileNode) => void
  onNavigate: (node: FileNode) => void
  depth?: number
}

export function FileTree({ node, selectedNode, onSelect, onNavigate, depth = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isDir = node.isDir && node.children.length > 0
  const isSelected = selectedNode?.path === node.path

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm transition-colors group"
        style={{
          paddingLeft: 8 + depth * 12,
          background: isSelected ? 'var(--bg-surface)' : 'transparent',
        }}
        onClick={() => {
          onSelect(node)
          if (isDir) setExpanded(!expanded)
        }}
        onDoubleClick={() => isDir && onNavigate(node)}
      >
        {isDir ? (
          <span className="text-xs w-3 text-center flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="text-xs flex-shrink-0">{isDir ? '📁' : '📄'}</span>
        <span
          className="text-xs truncate flex-1"
          style={{ color: isSelected ? 'var(--text)' : 'var(--text-2)' }}
        >
          {node.name}
        </span>
        <span
          className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-3)' }}
        >
          {formatSize(node.size)}
        </span>
      </div>
      {expanded && isDir && node.children.map((child) => (
        <FileTree
          key={child.path}
          node={child}
          selectedNode={selectedNode}
          onSelect={onSelect}
          onNavigate={onNavigate}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}
