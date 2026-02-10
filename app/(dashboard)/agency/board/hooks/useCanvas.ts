import { useState, useCallback } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { AgencyBlop, CanvasState, CanvasMode, ConnectionType } from '../types'

export const useCanvas = () => {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 })
  const [mode, setMode] = useState<CanvasMode>(CanvasMode.VIEW)
  const [connectionSourceId, setConnectionSourceId] = useState<string>()
  const [connectionType, setConnectionType] = useState<ConnectionType>('reference')

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setIsPanning(false)
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(10, prev + 0.2)) // Allow up to 10x zoom
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.1, prev - 0.2)) // Allow down to 0.1x zoom
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Start panning - the parent container handles this, so we can pan from anywhere
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
    setInitialPan({ ...pan })
    e.preventDefault()
  }, [pan])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      // Calculate how much mouse has moved from initial position
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y

      const newPan = {
        x: initialPan.x + deltaX,
        y: initialPan.y + deltaY
      }

      // Add bounds to prevent excessive panning (reasonable limits)
      const maxPan = 10000 // 10k pixels in each direction
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, newPan.x)),
        y: Math.max(-maxPan, Math.min(maxPan, newPan.y))
      })
    }
  }, [isPanning, panStart, initialPan])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const canvasState: CanvasState = {
    zoom,
    pan,
    showGrid,
    isPanning,
    panStart: initialPan, // Use initialPan instead of panStart for canvasState
    mode,
    connectionSourceId,
    connectionType
  }

  const startConnectionMode = useCallback((type: ConnectionType) => {
    setMode(CanvasMode.CONNECT)
    setConnectionType(type)
    setConnectionSourceId(undefined)
  }, [])

  const cancelConnectionMode = useCallback(() => {
    setMode(CanvasMode.VIEW)
    setConnectionSourceId(undefined)
  }, [])

  const setConnectionSource = useCallback((blopId: string) => {
    setConnectionSourceId(blopId)
  }, [])

  return {
    canvasState,
    resetView,
    handleZoomIn,
    handleZoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    setShowGrid,
    startConnectionMode,
    cancelConnectionMode,
    setConnectionSource,
  }
}