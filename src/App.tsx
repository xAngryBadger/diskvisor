import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { SunburstChart } from './components/SunburstChart'
import { FileTree } from './components/FileTree'
import { StatsBar } from './components/StatsBar'
import { Breadcrumb } from './components/Breadcrumb'
import type { FileNode, ScanResult } from './types'

function App() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null)
  const [path, setPath] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    invoke<string>('get_home_dir').then(setPath).catch(() => setPath('/'))
  }, [])

  const handleScan = useCallback(async (scanPath: string) => {
    setScanning(true)
    setError(null)
    setSelectedNode(null)
    abortRef.current = false

    try {
      const result = await invoke<ScanResult>('scan_directory', {
        path: scanPath,
        maxDepth: 4,
      })
      if (!abortRef.current) {
        setScanResult(result)
        setSelectedNode(result.root)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setScanning(false)
    }
  }, [])

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected) {
      const dirPath = typeof selected === 'string' ? selected : selected
      setPath(dirPath)
      handleScan(dirPath)
    }
  }, [handleScan])

  const handleNodeSelect = useCallback((node: FileNode) => {
    setSelectedNode(node)
  }, [])

  const handleNavigate = useCallback((node: FileNode) => {
    setPath(node.path)
    handleScan(node.path)
  }, [handleScan])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="flex items-center gap-3 px-4 border-b"
        style={{ borderColor: 'var(--border)', height: 48 }}
      >
        <h1 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--amber)' }}>
          DiskVisor
        </h1>

        <div
          className="flex items-center flex-1 gap-2 rounded-md px-2"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
        >
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan(path)}
            className="flex-1 bg-transparent text-sm outline-none py-1"
            style={{ color: 'var(--text)' }}
            placeholder="/path/to/scan"
          />
          <button
            onClick={() => handleScan(path)}
            disabled={scanning}
            className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
            style={{
              background: scanning ? 'var(--bg-surface)' : 'var(--amber)',
              color: scanning ? 'var(--text-3)' : '#fff',
            }}
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        <button
          onClick={handleBrowse}
          className="text-xs px-3 py-1 rounded transition-colors"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          Browse
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 text-xs" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
          {error}
        </div>
      )}

      {scanResult && <StatsBar result={scanResult} />}

      {scanResult && selectedNode && (
        <Breadcrumb node={selectedNode} onNavigate={handleNavigate} />
      )}

      <div className="flex-1 flex min-h-0">
        {scanResult ? (
          <>
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
              <SunburstChart
                node={scanResult.root}
                selectedNode={selectedNode}
                onSelect={handleNodeSelect}
                onNavigate={handleNavigate}
              />
            </div>
            <div
              className="overflow-y-auto border-l"
              style={{ width: 320, borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
            >
              <FileTree
                node={scanResult.root}
                selectedNode={selectedNode}
                onSelect={handleNodeSelect}
                onNavigate={handleNavigate}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">💾</div>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                {scanning ? 'Scanning directory...' : 'Select a directory to analyze disk usage'}
              </p>
              {scanning && (
                <div className="mt-4 h-1 w-48 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{ background: 'var(--amber)', width: '60%' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
