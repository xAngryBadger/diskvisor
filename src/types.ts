export interface FileNode {
  name: string
  path: string
  size: number
  isDir: boolean
  children: FileNode[]
  modified: number | null
}

export interface ScanResult {
  root: FileNode
  totalSize: number
  totalFiles: number
  totalDirs: number
  elapsedMs: number
}
