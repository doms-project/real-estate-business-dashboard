"use client"

import { useMemo } from "react"
import { AgencyBlop, CanvasState, ConnectionType } from "../types"

export { ConnectionLinePreview }

interface ConnectionLineData {
  from: { x: number; y: number }
  to: { x: number; y: number }
  type: ConnectionType
  label?: string
  bidirectional?: boolean
  isHighlighted: boolean
}

interface ConnectionLinesProps {
  blops: AgencyBlop[]
  canvasState: CanvasState
  selectedBlopId?: string
}

const CONNECTION_STYLES = {
  subscription: {
    color: '#10B981', // Green
    strokeWidth: 3,
    strokeDasharray: 'none',
    showArrow: true
  },
  'parent-child': {
    color: '#3B82F6', // Blue
    strokeWidth: 2,
    strokeDasharray: '5,5',
    showArrow: true
  },
  workflow: {
    color: '#F59E0B', // Orange
    strokeWidth: 2,
    strokeDasharray: 'none',
    showArrow: true
  },
  'data-flow': {
    color: '#8B5CF6', // Purple
    strokeWidth: 2,
    strokeDasharray: '10,5',
    showArrow: true
  },
  reference: {
    color: '#FF0000', // Bright Red
    strokeWidth: 8,
    strokeDasharray: 'none',
    showArrow: true
  }
} as const

const ArrowMarker = ({ id, color }: { id: string; color: string }) => (
  <defs>
    <marker
      id={id}
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polygon
        points="0 0, 10 3.5, 0 7"
        fill={color}
        opacity="0.8"
      />
    </marker>
  </defs>
)

interface ConnectionLinePreviewProps {
  startBlopId: string
  startAnchor: 'top' | 'bottom' | 'left' | 'right'
  endX: number
  endY: number
  blops: AgencyBlop[]
  pan: { x: number; y: number }
  zoom: number
}

const ConnectionLinePreview = ({
  startBlopId,
  startAnchor,
  endX,
  endY,
  blops,
  pan,
  zoom
}: ConnectionLinePreviewProps) => {
  const startBlop = blops.find(blop => blop.id === startBlopId)
  if (!startBlop) return null

  // Calculate start position based on anchor
  const startX = startBlop.x + (startAnchor === 'left' ? 0 : startAnchor === 'right' ? 200 : 100)
  const startY = startBlop.y + (startAnchor === 'top' ? 0 : startAnchor === 'bottom' ? 120 : 60)

  // Convert mouse position to canvas coordinates
  const canvasEndX = (endX - pan.x) / zoom
  const canvasEndY = (endY - pan.y) / zoom

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    >
      <line
        x1={startX}
        y1={startY}
        x2={canvasEndX}
        y2={canvasEndY}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        opacity="0.8"
      />
    </svg>
  )
}

const ConnectionLine = ({
  line,
  style
}: {
  line: ConnectionLineData
  style: typeof CONNECTION_STYLES[keyof typeof CONNECTION_STYLES]
}) => {
  const { from, to, label, isHighlighted } = line
  const { color, strokeWidth, strokeDasharray, showArrow } = style

  // Calculate midpoint for label
  const midpoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  }

  // Calculate angle for arrow orientation
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI

  const markerId = `arrow-${color.replace('#', '')}`


  return (
    <g>
      {/* Arrow marker definition */}
      {showArrow && <ArrowMarker id={markerId} color={color} />}

      {/* Connection line */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        opacity={isHighlighted ? 1 : 0.7}
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        className="transition-opacity duration-200"
      />

      {/* Connection label */}
      {label && (
        <text
          x={midpoint.x}
          y={midpoint.y - 8}
          textAnchor="middle"
          className="text-xs fill-gray-700 font-medium pointer-events-auto"
          style={{
            textShadow: '0 0 3px rgba(255,255,255,0.8)'
          }}
        >
          {label}
        </text>
      )}

      {/* Hover area for interaction */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="transparent"
        strokeWidth="8"
        className="cursor-pointer hover:stroke-blue-300 hover:stroke-opacity-30"
      />
    </g>
  )
}

export const ConnectionLines = ({
  blops,
  canvasState,
  selectedBlopId
}: ConnectionLinesProps) => {
  const { zoom, pan } = canvasState

  // Calculate all connection lines
  const lines = useMemo(() => {
    const connectionLines: ConnectionLineData[] = []

    blops.forEach(blop => {
      blop.connections?.forEach(connection => {
        const targetBlop = blops.find(b => b.id === connection.targetId)
        if (targetBlop) {
          // Calculate center positions of blops (assuming 300x180 size)
          const fromPos = {
            x: blop.x + 150, // Center horizontally
            y: blop.y + 90   // Center vertically
          }
          const toPos = {
            x: targetBlop.x + 150,
            y: targetBlop.y + 90
          }

          connectionLines.push({
            from: fromPos,
            to: toPos,
            type: connection.type,
            label: connection.label,
            bidirectional: connection.bidirectional,
            isHighlighted: selectedBlopId === blop.id || selectedBlopId === targetBlop.id
          })

          // If bidirectional, add reverse connection
          if (connection.bidirectional) {
            connectionLines.push({
              from: toPos,
              to: fromPos,
              type: connection.type,
              label: connection.label,
              bidirectional: true,
              isHighlighted: selectedBlopId === blop.id || selectedBlopId === targetBlop.id
            })
          }
        }
      })
    })

    return connectionLines
  }, [blops, selectedBlopId])

  // Remove duplicate lines (for bidirectional connections)
  const uniqueLines = useMemo(() => {
    const seen = new Set<string>()
    return lines.filter(line => {
      const key = `${Math.min(line.from.x, line.to.x)}-${Math.min(line.from.y, line.to.y)}-${Math.max(line.from.x, line.to.x)}-${Math.max(line.from.y, line.to.y)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [lines])

  if (uniqueLines.length === 0) {
    return null
  }
  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      aria-label="Connection lines between blops"
    >
      {uniqueLines.map((line, index) => (
        <ConnectionLine
          key={`connection-${index}`}
          line={line}
          style={CONNECTION_STYLES[line.type]}
        />
      ))}
    </svg>
  )
}