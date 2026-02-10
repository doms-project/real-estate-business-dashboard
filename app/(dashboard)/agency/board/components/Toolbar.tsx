"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ZoomIn, ZoomOut, RotateCcw, Plus, AlignLeft, Grid, TrendingUp, RefreshCw, Loader2, Link, X } from "lucide-react"
import { CanvasMode, ConnectionType } from "../types"

interface ToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearSearch: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onAddBlop: () => void
  addingBlop: boolean
  onAutoArrange: () => void
  showGrid: boolean
  onToggleGrid: () => void
  showMetrics: boolean
  onToggleMetrics: () => void
  onRefresh: () => void
  refreshing: boolean
  filteredBlopsCount: number
  totalBlopsCount: number
  customBlopsCount: number
  locationBlopsCount: number
  isConnecting: boolean
  onStartConnectionMode: () => void
  onCancelConnectionMode: () => void
}

export const Toolbar = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onAddBlop,
  addingBlop,
  onAutoArrange,
  showGrid,
  onToggleGrid,
  showMetrics,
  onToggleMetrics,
  onRefresh,
  refreshing,
  filteredBlopsCount,
  totalBlopsCount,
  customBlopsCount,
  locationBlopsCount,
  isConnecting,
  onStartConnectionMode,
  onCancelConnectionMode
}: ToolbarProps) => {
  return (
    <div className="bg-white border-b border-gray-200 p-3 lg:p-4">
      <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
            Agency Command Center
          </h1>

          {/* Search */}
          <div className="relative w-full sm:w-auto min-w-[200px] sm:min-w-[250px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="
                w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-colors
              "
              aria-label="Search blops"
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
                className="
                  absolute right-3 top-1/2 transform -translate-y-1/2
                  text-gray-400 hover:text-gray-600 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-gray-400 rounded
                "
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <Badge variant="secondary" className="text-xs px-3 py-1 whitespace-nowrap">
            {filteredBlopsCount}/{totalBlopsCount} blops
            <span className="hidden sm:inline"> ({customBlopsCount} custom, {locationBlopsCount} locations)</span>
          </Badge>

          {isConnecting && (
            <Badge variant="default" className="text-xs px-3 py-1 bg-blue-500">
              Connect Mode - Click source blop, then target blop
            </Badge>
          )}
        </div>

        {/* Right Section - Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-md p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              disabled={zoom <= 0.3}
              className="h-8 w-8 p-0 hover:bg-gray-100"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2 min-w-[3rem] text-center font-medium">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              disabled={zoom >= 3}
              className="h-8 w-8 p-0 hover:bg-gray-100"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetView}
              className="h-8 px-3"
              aria-label="Reset view"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Reset</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onAddBlop}
              disabled={addingBlop}
              className="h-8 px-3"
              aria-label="Add new blop"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Add</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onAutoArrange}
              className="h-8 px-3"
              aria-label="Auto arrange blops"
            >
              <AlignLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Arrange</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleGrid}
              className={`h-8 px-3 ${showGrid ? 'bg-blue-50 border-blue-200' : ''}`}
              aria-label="Toggle grid"
              aria-pressed={showGrid}
            >
              <Grid className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleMetrics}
              className={`h-8 px-3 ${showMetrics ? 'bg-blue-50 border-blue-200' : ''}`}
              aria-label="Toggle metrics"
              aria-pressed={showMetrics}
            >
              <TrendingUp className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 px-3"
              aria-label="Refresh data"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            {/* Connection Controls */}
            {isConnecting ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelConnectionMode}
                className="h-8 px-3"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel Connect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onStartConnectionMode}
                className="h-8 px-3"
              >
                <Link className="h-4 w-4 mr-1" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}