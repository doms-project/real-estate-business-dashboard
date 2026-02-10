"use client"

// Force recompile after connection fixes
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertTriangle, XCircle, Building2, Target, TrendingUp, DollarSign, Zap } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { BlopComponentProps } from "../types"

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-3 w-3 text-green-600" />
    case 'warning':
      return <AlertTriangle className="h-3 w-3 text-yellow-600" />
    case 'critical':
      return <XCircle className="h-3 w-3 text-red-600" />
    default:
      return <CheckCircle className="h-3 w-3 text-blue-600" />
  }
}

export const BlopComponent = ({
  blop,
  onDelete,
  onDoubleClick,
  isSelected,
  onSelect,
  onConnectionStart,
  onHover,
  canvasMode,
  isConnectionSource,
  isHoveredTarget
}: BlopComponentProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const isDraggableDisabled = isEditing
  const [editTitle, setEditTitle] = useState(blop.title)
  const [editContent, setEditContent] = useState(blop.content)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: blop.id,
    disabled: isDraggableDisabled,
  })

  const finalListeners = listeners


  const style = {
    position: "absolute" as const,
    left: blop.x,
    top: blop.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
    zIndex: isSelected ? 10 : 1,
    boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.5)' : undefined,
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(blop.id)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent canvas panning when interacting with blops
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isEditing && !isDragging) {
      setIsEditing(true)
      setEditTitle(blop.title)
      setEditContent(blop.content)
    }
  }

  const handleSaveEdit = () => {
    onDoubleClick(blop.id, editTitle, editContent)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle(blop.title)
    setEditContent(blop.content)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...finalListeners}
      onClick={canvasMode === 'connect' ? () => onConnectionStart?.(blop.id) : handleClick}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => onHover?.(blop.id)}
      onMouseLeave={() => onHover?.(null)}
      data-blop-id={blop.id}
      className={`
        ${blop.color}
        ${isSelected ? 'ring-2 ring-blue-400' : ''}
        ${isConnectionSource ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
        ${isHoveredTarget ? 'ring-4 ring-blue-400 animate-pulse' : ''}
        border-0 text-white cursor-move shadow-lg hover:shadow-xl
        relative group w-full max-w-xs p-4 touch-manipulation
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
      `}
      role="button"
      tabIndex={0}
      aria-label={`Blop: ${blop.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as any)
        }
      }}
    >
      {/* Status indicator */}
      <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
        {getStatusIcon(blop.status)}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onDelete(blop.id)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        className="
          absolute top-2 right-2 bg-red-500 hover:bg-red-600
          text-white rounded-full p-1 opacity-70 hover:opacity-100
          transition-opacity duration-200 shadow-md z-10
          focus:outline-none focus:ring-2 focus:ring-red-400
        "
        title="Delete this blop"
        aria-label="Delete blop"
      >
        <XCircle className="h-3 w-3" />
      </button>

      {/* Connection anchors - only show in connect mode */}
      {canvasMode === 'connect' && (
        <>
          {/* Top connection anchor */}
          <div
            className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:bg-blue-600 transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onConnectionStart) {
                onConnectionStart(blop.id)
              }
            }}
            title="Drag to connect"
          />

          {/* Bottom connection anchor */}
          <div
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:bg-blue-600 transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onConnectionStart) {
                onConnectionStart(blop.id)
              }
            }}
            title="Drag to connect"
          />

          {/* Left connection anchor */}
          <div
            className="absolute top-1/2 -left-2 transform -translate-y-1/2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:bg-blue-600 transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onConnectionStart) {
                onConnectionStart(blop.id)
              }
            }}
            title="Drag to connect"
          />

          {/* Right connection anchor */}
          <div
            className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-crosshair hover:bg-blue-600 transition-colors z-20"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onConnectionStart) {
                onConnectionStart(blop.id)
              }
            }}
            title="Drag to connect"
          />
        </>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 opacity-80" />
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            className="
              flex-1 bg-transparent border-b border-white/50 text-sm font-semibold
              focus:outline-none focus:border-white placeholder-white/50
            "
            placeholder="Task title..."
            autoFocus
            aria-label="Edit blop title"
          />
        ) : (
          <h3 className="font-semibold text-sm">{blop.title}</h3>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyPress}
            className="
              w-full bg-transparent border border-white/30 rounded text-xs p-2
              focus:outline-none focus:border-white/50 resize-none
              placeholder-white/50
            "
            rows={3}
            placeholder="Task description..."
            aria-label="Edit blop content"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancelEdit}
              className="
                px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 rounded
                transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
              "
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="
                px-2 py-1 text-xs bg-green-500/20 hover:bg-green-500/30 rounded
                transition-colors focus:outline-none focus:ring-2 focus:ring-green-400
              "
            >
              Save
            </button>
          </div>
          <div className="text-xs opacity-60 text-center">
            Ctrl+Enter to save, Escape to cancel
          </div>
        </div>
      ) : blop.healthData ? (
        <div className="space-y-3">
          {/* Health Score */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Health Score
              </span>
              <span className="font-semibold">{blop.healthData.overall_score}%</span>
            </div>
            <Progress value={blop.healthData.overall_score} className="h-2" />
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{blop.healthData.total_leads || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>{blop.healthData.total_deals || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>${((blop.healthData.current_revenue || 0) / 1000).toFixed(0)}K</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-center">
            <span className={`
              text-xs px-2 py-1 rounded font-medium
              ${blop.healthData.health_status === 'healthy' ? 'bg-green-600' :
                blop.healthData.health_status === 'warning' ? 'bg-yellow-600' :
                'bg-red-600'} text-white
            `}>
              {blop.healthData.health_status}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs opacity-90 leading-tight">
            {blop.content}
          </div>
          <div className="text-xs opacity-60 text-center pt-2">
            Double-click to edit
          </div>
        </div>
      )}
    </Card>
  )
}