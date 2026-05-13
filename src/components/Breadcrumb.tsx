import type { FileNode } from '../types'

interface BreadcrumbProps {
  node: FileNode
  onNavigate: (node: FileNode) => void
}

export function Breadcrumb({ node, onNavigate }: BreadcrumbProps) {
  const segments: { name: string; path: string }[] = []
  const current = node.path
  const parts = current.split('/').filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const segmentPath = '/' + parts.slice(0, i + 1).join('/')
    segments.push({ name: parts[i], path: segmentPath })
  }

  return (
    <div
      className="flex items-center gap-1 px-4 py-1.5 border-b text-xs overflow-x-auto"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
    >
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span style={{ color: 'var(--text-3)' }}>/</span>}
          <button
            onClick={() => onNavigate({ ...node, path: seg.path, name: seg.name })}
            className="hover:underline transition-colors"
            style={{ color: i === segments.length - 1 ? 'var(--text)' : 'var(--text-3)' }}
          >
            {seg.name}
          </button>
        </span>
      ))}
    </div>
  )
}
