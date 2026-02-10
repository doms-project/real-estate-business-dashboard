"use client"

// Force recompile after connection fixes
import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useUser } from "@clerk/nextjs"
import { Toolbar } from "./components/Toolbar"
import { Canvas } from "./components/Canvas"
import { useCanvas } from "./hooks/useCanvas"
import { useBlops } from "./hooks/useBlops"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"
import { subscribeToUpdates } from "@/lib/realtime-updates"
import { CanvasMode } from "./types"

export default function FlexboardPage() {
  const { user } = useUser()
  const [showMetrics, setShowMetrics] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [connectionStart, setConnectionStart] = useState<{ blopId: string, anchor: 'top' | 'bottom' | 'left' | 'right' } | null>(null)
  const [hoveredBlop, setHoveredBlop] = useState<string | null>(null)

  // Connection state tracking removed - now using click-based connections

  // DnD sensors - allow double-clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Canvas state and handlers
  const {
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
  } = useCanvas()

  // Blops state and handlers
  const {
    blops,
    filteredBlops,
    loading,
    searchQuery,
    selectedBlop,
    blopCounts,
    addingBlop,
    setSearchQuery,
    setSelectedBlop,
    setBlops,
    addBlop,
    editBlop,
    deleteBlop,
    autoArrange,
    clearSearch,
    refreshData,
    createConnection,
    removeConnection,
  } = useBlops(user)

  // Handle connection drag end
  const handleConnectionEnd = useCallback((toId?: string) => {
    if (connectionStart && toId && toId !== connectionStart.blopId) {
      // Create connection
      createConnection(connectionStart.blopId, toId, 'reference')
      // Only exit connect mode when connection is successfully created
      cancelConnectionMode()
    }
    // Reset connection state (always do this)
    setConnectionStart(null)
  }, [connectionStart, createConnection, cancelConnectionMode])

  // Handle connection anchor click - select source or complete connection
  const handleConnectionStart = useCallback((blopId: string, anchor: 'top' | 'bottom' | 'left' | 'right' = 'top') => {

    if (!connectionStart) {
      // No connection in progress - start a new connection
      setConnectionStart({ blopId, anchor })
      setConnectionSource(blopId)
      startConnectionMode('reference')
    } else {
      // Connection in progress - complete it if hovering over valid target
      if (connectionStart.blopId !== blopId && hoveredBlop === blopId) {
        handleConnectionEnd(blopId)
      } else if (connectionStart.blopId === blopId) {
        // Clicked same blop - cancel
        setConnectionStart(null)
        setHoveredBlop(null)
      }
      // If clicked on non-hovered target, do nothing
    }
  }, [connectionStart, hoveredBlop, setConnectionSource, startConnectionMode, handleConnectionEnd])

  // Connection mode is now click-based instead of drag-based

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    setBlops(prev => prev.map(blop => {
      if (blop.id === active.id) {
        return {
          ...blop,
          x: blop.x + delta.x / canvasState.zoom,
          y: blop.y + delta.y / canvasState.zoom
        }
      }
      return blop
    }))
    setSelectedBlop(String(active.id))
  }

  // Handle blop selection
  const handleBlopSelect = (blopId: string | null) => {
    if (!blopId) {
      setSelectedBlop(null)
      return
    }

    // Normal selection
    setSelectedBlop(blopId)
  }

  // Enhanced refresh with loading state
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshData()
    } finally {
      setRefreshing(false)
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onAddBlop: addBlop,
    onAutoArrange: autoArrange,
    onToggleGrid: () => setShowGrid(!canvasState.showGrid),
    onResetView: resetView,
    onRefresh: handleRefresh,
    selectedBlop,
    onDeleteSelected: () => selectedBlop && deleteBlop(selectedBlop),
    onClearSelection: () => setSelectedBlop(null),
    onClearSearch: clearSearch,
  })

  // Global mouse events for panning
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Format blop data from realtime updates
  const formatRealtimeBlop = (blopData: any) => {
    let connections = []
    try {
      if (Array.isArray(blopData.connections)) {
        // Parse each JSON string in the array like formatBlopData does
        const parsedConnections: any[] = []
        for (const conn of blopData.connections) {
          try {
            if (typeof conn === 'string') {
              const parsed = JSON.parse(conn)
              // Validate that parsed connection has required fields
              if (parsed && typeof parsed === 'object' && 'targetId' in parsed && 'type' in parsed) {
                parsedConnections.push(parsed)
              } else {
                console.warn('Invalid connection format for realtime blop', blopData.id, ':', conn)
              }
            } else if (conn && typeof conn === 'object' && 'targetId' in conn && 'type' in conn) {
              // Already parsed object
              parsedConnections.push(conn)
            } else {
              console.warn('Invalid connection object for realtime blop', blopData.id, ':', conn)
            }
          } catch (e) {
            console.error('Error parsing connection for realtime blop', blopData.id, ':', conn, e)
          }
        }
        connections = parsedConnections
      }
    } catch (error) {
      console.error('Error parsing connections array for realtime blop', blopData.id, ':', error)
      connections = []
    }

    return {
      id: blopData.id,
      x: blopData.x || 200,
      y: blopData.y || 200,
      shape: blopData.shape || "square",
      color: blopData.color || "bg-blue-500",
      title: blopData.title || blopData.content || "Untitled",
      content: blopData.content || "",
      type: blopData.type || "text",
      status: blopData.status || "info",
      connections: connections,
    }
  }

  // Real-time blops updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates('blops', (update) => {

      if (update.type === 'blop_created') {
        // Small delay to allow local operations to complete
        setTimeout(() => {
          const formattedBlop = formatRealtimeBlop(update.data)

          // Add the new blop to the state if it's not already there
          setBlops(prev => {
            const exists = prev.find(blop => blop.id === formattedBlop.id)
            if (!exists) {
              return [...prev, formattedBlop]
            }
            return prev
          })
        }, 500)
      } else if (update.type === 'blop_updated') {
        const formattedBlop = formatRealtimeBlop(update.data)

        // Update the existing blop
        setBlops(prev => prev.map(blop =>
          blop.id === formattedBlop.id ? formattedBlop : blop
        ))
      } else if (update.type === 'blop_deleted') {
        // Remove the deleted blop
        setBlops(prev => prev.filter(blop => blop.id !== update.data.id))
      }
    })

    return unsubscribe
  }, [setBlops])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading agency data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        zoom={canvasState.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={resetView}
        onAddBlop={addBlop}
        addingBlop={addingBlop}
        onAutoArrange={autoArrange}
        showGrid={canvasState.showGrid}
        onToggleGrid={() => setShowGrid(!canvasState.showGrid)}
        showMetrics={showMetrics}
        onToggleMetrics={() => setShowMetrics(!showMetrics)}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        filteredBlopsCount={blopCounts.filtered}
        totalBlopsCount={blopCounts.total}
        customBlopsCount={blopCounts.custom}
        locationBlopsCount={blopCounts.locations}
        isConnecting={!!connectionStart}
        onStartConnectionMode={() => {
          startConnectionMode('reference')
        }}
        onCancelConnectionMode={() => {
          setConnectionStart(null)
          setHoveredBlop(null)
          cancelConnectionMode()
        }}
      />

        <Canvas
          blops={blops}
          filteredBlops={filteredBlops}
          selectedBlop={selectedBlop}
          onSelectBlop={handleBlopSelect}
          onDragEnd={handleDragEnd}
          onDeleteBlop={deleteBlop}
          onEditBlop={editBlop}
          canvasState={canvasState}
          onMouseDown={handleMouseDown}
          connectionStart={connectionStart}
          onConnectionStart={handleConnectionStart}
          onConnectionEnd={handleConnectionEnd}
          onHover={setHoveredBlop}
          hoveredBlop={hoveredBlop}
          sensors={sensors}
        />
    </div>
  )
}