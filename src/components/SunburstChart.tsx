import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { FileNode } from '../types'

interface SunburstChartProps {
  node: FileNode
  selectedNode: FileNode | null
  onSelect: (node: FileNode) => void
  onNavigate: (node: FileNode) => void
}

interface HierarchyData {
  name: string
  path: string
  size: number
  isDir: boolean
  children?: HierarchyData[]
  modified: number | null
}

function toHierarchy(node: FileNode): HierarchyData {
  if (node.isDir && node.children.length > 0) {
    return {
      name: node.name,
      path: node.path,
      size: node.size,
      isDir: node.isDir,
      modified: node.modified,
      children: node.children.map(toHierarchy),
    }
  }
  return {
    name: node.name,
    path: node.path,
    size: Math.max(node.size, 1),
    isDir: node.isDir,
    modified: node.modified,
  }
}

const COLORS = [
  '#a8611a', '#388bfd', '#238636', '#da3633', '#8957e5',
  '#f0883e', '#3fb950', '#58a6ff', '#d2a8ff', '#79c0ff',
  '#ffa657', '#7ee787', '#ff7b72', '#d29922', '#a5d6ff',
]

interface ArcData {
  x0: number
  x1: number
  y0: number
  y1: number
}

export function SunburstChart({ node, selectedNode, onSelect, onNavigate }: SunburstChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((data: HierarchyData) => {
    if (data.isDir && data.children) {
      onNavigate(data as unknown as FileNode)
    }
    onSelect(data as unknown as FileNode)
  }, [onSelect, onNavigate])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 520
    const height = 520
    const radius = width / 6

    svg
      .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
      .style('font', '10px sans-serif')

    const hierarchy = toHierarchy(node)
    const root = d3.hierarchy(hierarchy)
      .sum((d) => (!d.children ? (d as HierarchyData).size : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const partition = d3.partition<HierarchyData>()
      .size([2 * Math.PI, root.height + 1])

    partition(root)

    const currentMap = new Map<string, ArcData>()
    root.each((d) => {
      const rect = d as d3.HierarchyRectangularNode<HierarchyData>
      currentMap.set(d.data.path, { x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: rect.y1 })
    })

    const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyData>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d) => d.y0 * radius)
      .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1))

    const color = d3.scaleOrdinal(COLORS)

    const g = svg.append('g')

    const tooltip = tooltipRef.current

    const arcNodes = root.descendants().slice(1) as d3.HierarchyRectangularNode<HierarchyData>[]

    g.selectAll('path')
      .data(arcNodes)
      .join('path')
      .attr('fill', (d) => {
        let p = d
        while (p.depth > 1) p = p.parent as d3.HierarchyRectangularNode<HierarchyData>
        return color(p.data.name)
      })
      .attr('fill-opacity', (d) => (selectedNode?.path === d.data.path ? 1 : 0.8))
      .attr('d', (d) => arc(d))
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('fill-opacity', 1)
        if (tooltip) {
          const pct = root.value ? ((d.value ?? 0) / root.value * 100).toFixed(1) : '0'
          tooltip.textContent = `${d.data.name} \u2014 ${formatBytes(d.value ?? 0)} (${pct}%)`
          tooltip.style.opacity = '1'
        }
      })
      .on('mousemove', (event) => {
        if (tooltip) {
          tooltip.style.left = event.offsetX + 10 + 'px'
          tooltip.style.top = event.offsetY - 30 + 'px'
        }
      })
      .on('mouseout', function (_event, d) {
        d3.select(this).attr('fill-opacity', selectedNode?.path === d.data.path ? 1 : 0.8)
        if (tooltip) tooltip.style.opacity = '0'
      })
      .on('click', (_event, d) => handleClick(d.data))

    g.selectAll('text')
      .data(arcNodes)
      .join('text')
      .attr('dy', '0.35em')
      .attr('fill', 'var(--text)')
      .attr('fill-opacity', (d) => {
        const cur = currentMap.get(d.data.path)
        if (!cur) return 0
        return +(arcVisible(cur) && labelVisible(cur))
      })
      .attr('font-size', (d) => Math.max(8, 11 - d.depth))
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .attr('transform', (d) => {
        const cur = currentMap.get(d.data.path)
        if (!cur) return ''
        return labelTransform(cur)
      })
      .text((d) => d.data.name.length > 12 ? d.data.name.slice(0, 11) + '...' : d.data.name)

    g.append('circle')
      .attr('r', radius)
      .attr('fill', 'var(--bg-alt)')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', () => onNavigate(node))

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', 'var(--text)')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text(node.name.length > 16 ? node.name.slice(0, 14) + '...' : node.name)

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.1em')
      .attr('fill', 'var(--text-3)')
      .attr('font-size', 10)
      .text(formatBytes(node.size))
  }, [node, selectedNode, handleClick, onNavigate])

  return (
    <div className="relative">
      <svg ref={svgRef} className="w-full h-full" style={{ maxWidth: 520, maxHeight: 520 }} />
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none rounded px-2 py-1 text-xs transition-opacity"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          opacity: 0,
          zIndex: 50,
        }}
      />
    </div>
  )
}

function arcVisible(d: ArcData) {
  return d.y1 <= 5 && d.y0 >= 1 && d.x1 > d.x0
}

function labelVisible(d: ArcData) {
  return d.y1 <= 5 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
}

function labelTransform(d: ArcData) {
  const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI
  const y = ((d.y0 + d.y1) / 2) * (520 / 6)
  return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
