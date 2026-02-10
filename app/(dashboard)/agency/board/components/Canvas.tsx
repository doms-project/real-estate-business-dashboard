"use client"

// Force recompile after connection fixes
import { DndContext, DragEndEvent } from "@dnd-kit/core"
import { BlopComponent } from "./BlopComponent"
import { ConnectionLines, ConnectionLinePreview } from "./ConnectionLines"
import { AgencyBlop, CanvasState } from "../types"

interface CanvasProps {
  blops: AgencyBlop[]
  filteredBlops: AgencyBlop[]
  selectedBlop: string | null
  onSelectBlop: (id: string | null) => void
  onDragEnd: (event: DragEndEvent) => void
  onDeleteBlop: (blopId: string) => void
  onEditBlop: (blopId: string, newTitle?: string, newContent?: string) => void
  canvasState: CanvasState
  onMouseDown: (e: React.MouseEvent) => void
  connectionStart?: { blopId: string, anchor: 'top' | 'bottom' | 'left' | 'right' } | null
  onConnectionStart?: (blopId: string, anchor?: 'top' | 'bottom' | 'left' | 'right') => void
  onConnectionEnd?: (toId?: string) => void
  onHover?: (blopId: string | null) => void
  hoveredBlop?: string | null
}

export const Canvas = ({
  blops,
  filteredBlops,
  selectedBlop,
  onSelectBlop,
  onDragEnd,
  onDeleteBlop,
  onEditBlop,
  canvasState,
  onMouseDown,
  connectionStart,
  onConnectionStart,
  onConnectionEnd,
  onHover,
  hoveredBlop
}: CanvasProps) => {
  const { zoom, pan, showGrid, isPanning } = canvasState

  // Handle drag start
  const handleDragStart = (event: any) => {
    // Normal drag handling
  }

  // Handle drag end for blop repositioning
  const handleDragEnd = (event: any) => {
    const { active, over } = event
    // Normal blop repositioning
    onDragEnd(event)
  }

  return (
    <div
      className={`flex-1 relative overflow-hidden bg-gray-50 ${isPanning ? 'cursor-grabbing' : canvasState.mode === 'connect' ? 'cursor-crosshair' : 'cursor-grab'}`}
      onMouseDown={onMouseDown}
    >
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="absolute inset-0 canvas-background select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          role="main"
          aria-label="Interactive canvas"
        >
          {/* Grid Background - covers massive pannable area */}
          {showGrid && (
            <div
              className="absolute opacity-20 pointer-events-none"
              style={{
                left: '-2000000px',
                top: '-2000000px',
                width: '4000000px',
                height: '4000000px',
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: `${20}px ${20}px`,
              }}
              aria-hidden="true"
            />
          )}

          {/* Keyboard Shortcuts Hint */}
          <div
            className="
              absolute top-4 right-4 bg-black/90 text-white text-xs px-3 py-2
              rounded-md opacity-0 hover:opacity-100 transition-opacity duration-300
              pointer-events-none z-50 max-w-xs
            "
            role="tooltip"
            aria-label="Keyboard shortcuts"
          >
            <div className="font-medium mb-1">Keyboard Shortcuts:</div>
            <div className="space-y-0.5 text-xs">
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+F</kbd> Search</div>
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+N</kbd> Add blop</div>
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+A</kbd> Auto-arrange</div>
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+G</kbd> Toggle grid</div>
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+0</kbd> Reset view</div>
              <div><kbd className="bg-white/20 px-1 rounded">Ctrl+R</kbd> Refresh</div>
              <div><kbd className="bg-white/20 px-1 rounded">Del</kbd> Delete selected</div>
              <div className="mt-2 text-xs opacity-75">Click & drag empty space to pan</div>
            </div>
          </div>

          {/* Connection Lines */}
          <ConnectionLines
            blops={blops}
            canvasState={canvasState}
            selectedBlopId={selectedBlop || undefined}
          />

          {/* Connection preview removed - now using click-to-connect */}

          {/* Render Blops */}
          {filteredBlops.map((blop) => (
            <BlopComponent
              key={blop.id}
              blop={blop}
              onDelete={onDeleteBlop}
              onDoubleClick={onEditBlop}
              isSelected={selectedBlop === blop.id}
              onSelect={onSelectBlop}
              onConnectionStart={onConnectionStart}
              onHover={onHover}
              canvasMode={canvasState.mode}
              isConnectionSource={connectionStart?.blopId === blop.id}
              isHoveredTarget={!!(connectionStart && hoveredBlop === blop.id && connectionStart.blopId !== blop.id)}
            />
          ))}

          {/* Empty States */}
          {filteredBlops.length === 0 && blops.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No locations match your search</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search terms or clear the search.</p>
                <button
                  onClick={() => onSelectBlop(null)}
                  className="
                    inline-flex items-center px-4 py-2 border border-transparent
                    text-sm font-medium rounded-md text-white bg-blue-600
                    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  "
                >
                  Clear Search
                </button>
              </div>
            </div>
          )}

          {blops.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
                <p className="text-gray-600">Connect your GoHighLevel account to view your agency locations.</p>
              </div>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  )
}