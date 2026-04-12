import { memo } from 'react'

interface NodePosition {
  id: string
  x: number
  y: number
  parentId: string | null
}

interface CanvasEdgesProps {
  positions: NodePosition[]
  nodeWidth: number
  nodeHeight: number
}

function CanvasEdgesInner({ positions, nodeWidth, nodeHeight }: CanvasEdgesProps) {
  const posMap = new Map(positions.map(p => [p.id, p]))

  // Build edges: parent output port → child input port
  const edges = positions
    .filter(p => p.parentId && posMap.has(p.parentId))
    .map(p => {
      const parent = posMap.get(p.parentId!)!
      return {
        id: `${parent.id}-${p.id}`,
        x1: parent.x + nodeWidth,     // right edge of parent
        y1: parent.y + nodeHeight / 2, // vertical center
        x2: p.x,                       // left edge of child
        y2: p.y + nodeHeight / 2,
      }
    })

  if (edges.length === 0) return null

  // Compute SVG bounds
  const allX = edges.flatMap(e => [e.x1, e.x2])
  const allY = edges.flatMap(e => [e.y1, e.y2])
  const minX = Math.min(...allX) - 20
  const minY = Math.min(...allY) - 20
  const maxX = Math.max(...allX) + 20
  const maxY = Math.max(...allY) + 20

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id="edge-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {edges.map(edge => {
        const sx = edge.x1 - minX
        const sy = edge.y1 - minY
        const ex = edge.x2 - minX
        const ey = edge.y2 - minY
        const midX = (sx + ex) / 2

        return (
          <g key={edge.id}>
            {/* Shadow */}
            <path
              d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`}
              fill="none"
              stroke="hsl(var(--primary) / 0.06)"
              strokeWidth={6}
            />
            {/* Main line */}
            <path
              d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`}
              fill="none"
              stroke="url(#edge-gradient)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* Animated dot */}
            <circle r={2.5} fill="hsl(var(--primary))" opacity={0.6}>
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`}
              />
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

const CanvasEdges = memo(CanvasEdgesInner)
export default CanvasEdges
