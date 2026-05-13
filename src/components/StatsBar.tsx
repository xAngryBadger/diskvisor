import type { ScanResult } from '../types'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function StatsBar({ result }: { result: ScanResult }) {
  return (
    <div
      className="flex items-center gap-6 px-4 py-2 border-b text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)', color: 'var(--text-2)' }}
    >
      <span>Total: <strong style={{ color: 'var(--text)' }}>{formatSize(result.totalSize)}</strong></span>
      <span>Files: <strong style={{ color: 'var(--text)' }}>{result.totalFiles.toLocaleString()}</strong></span>
      <span>Folders: <strong style={{ color: 'var(--text)' }}>{result.totalDirs.toLocaleString()}</strong></span>
      <span>Scan time: <strong style={{ color: 'var(--text)' }}>{result.elapsedMs}ms</strong></span>
    </div>
  )
}
