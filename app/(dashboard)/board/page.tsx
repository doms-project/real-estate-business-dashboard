"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, ZoomIn, ZoomOut, Grid, Save } from "lucide-react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
} from "@dnd-kit/core"

interface Blop {
  id: string
  x: number
  y: number
  shape: "circle" | "square" | "pill" | "diamond"
  color: string
  content: string
  type: "text" | "link" | "url" | "file" | "image" | "embed"
}

const initialBlops: Blop[] = [
  {
    id: "1",
    x: 100,
    y: 100,
    shape: "circle",
    color: "bg-blue-500",
    content: "Welcome Blop",
    type: "text",
  },
]

export default function FlexboardPage() {
  const [blops, setBlops] = useState<Blop[]>(initialBlops)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    setBlops((blops) =>
      blops.map((blop) =>
        blop.id === active.id
          ? { ...blop, x: blop.x + delta.x / zoom, y: blop.y + delta.y / zoom }
          : blop
      )
    )
  }

  const addBlop = () => {
    const newBlop: Blop = {
      id: Date.now().toString(),
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100,
      shape: "circle",
      color: "bg-blue-500",
      content: "New Blop",
      type: "text",
    }
    setBlops([...blops, newBlop])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flexboard</h1>
          <p className="text-sm text-muted-foreground">
            Drag and organize your blops
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Save className="h-4 w-4" />
          </Button>
          <Button onClick={addBlop}>
            <Plus className="mr-2 h-4 w-4" />
            Add Blop
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto relative bg-muted/30">
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <div
            className="relative w-full h-full min-h-[800px]"
            style={{
              backgroundImage: showGrid
                ? "radial-gradient(circle, #e5e7eb 1px, transparent 1px)"
                : "none",
              backgroundSize: "20px 20px",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {blops.map((blop) => (
              <BlopComponent key={blop.id} blop={blop} />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}

function BlopComponent({ blop }: { blop: Blop }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: blop.id,
  })

  const style = {
    position: "absolute" as const,
    left: blop.x + (transform?.x ?? 0),
    top: blop.y + (transform?.y ?? 0),
    opacity: isDragging ? 0.5 : 1,
  }

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-lg",
    pill: "rounded-full px-8",
    diamond: "rotate-45",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${blop.color} ${shapeClasses[blop.shape]} w-24 h-24 flex items-center justify-center text-white font-medium cursor-move shadow-lg hover:shadow-xl transition-shadow`}
    >
      <div className={blop.shape === "diamond" ? "rotate-[-45deg]" : ""}>
        {blop.content}
      </div>
    </div>
  )
}

