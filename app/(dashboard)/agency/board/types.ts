export interface LocationData {
  id: string
  name: string
  city?: string
  state?: string
  country: string
}

export interface HealthScoreData {
  location_id: string
  overall_score: number
  health_status: 'healthy' | 'warning' | 'critical'
  total_leads?: number
  total_deals?: number
  current_revenue?: number
  conversion_rate?: number
}

export interface Connection {
  targetId: string
  type: ConnectionType
  label?: string
  bidirectional?: boolean
}

export type ConnectionType =
  | 'subscription'
  | 'parent-child'
  | 'workflow'
  | 'data-flow'
  | 'reference'

export interface AgencyBlop {
  id: string
  x: number
  y: number
  shape: "circle" | "square" | "pill" | "diamond"
  color: string
  title: string
  content: string
  type: "text" | "link" | "url" | "file" | "image" | "embed" | "location-status" | "task-reminder"
  status: "healthy" | "warning" | "critical" | "info"
  data?: { locationId: string, locationData: LocationData }
  healthData?: HealthScoreData
  connections?: Connection[]
}

export interface BlopComponentProps {
  blop: AgencyBlop
  onDelete: (blopId: string) => void
  onDoubleClick: (blopId: string, newTitle?: string, newContent?: string) => void
  isSelected: boolean
  onSelect: (blopId: string) => void
  onConnectionStart?: (blopId: string, anchor?: 'top' | 'bottom' | 'left' | 'right') => void
  onHover?: (blopId: string | null) => void
  canvasMode?: CanvasMode
  isConnectionSource?: boolean
  isHoveredTarget?: boolean
}

export enum CanvasMode {
  VIEW = 'view',
  PAN = 'pan',
  CONNECT = 'connect',
  SELECT = 'select',
  DRAG_CONNECT = 'drag-connect'
}

export interface CanvasState {
  zoom: number
  pan: { x: number; y: number }
  showGrid: boolean
  isPanning: boolean
  panStart: { x: number; y: number }
  mode: CanvasMode
  connectionSourceId?: string
  connectionType?: ConnectionType
}