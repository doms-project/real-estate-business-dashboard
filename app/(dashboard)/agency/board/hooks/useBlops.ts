import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AgencyBlop, LocationData, HealthScoreData, Connection, ConnectionType } from '../types'

export const useBlops = (user: any) => {
  const [blops, setBlops] = useState<AgencyBlop[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBlop, setSelectedBlop] = useState<string | null>(null)
  const [addingBlop, setAddingBlop] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const addingBlopRef = useRef(false)

  // Load locations from API
  const loadLocations = useCallback(async (): Promise<LocationData[]> => {
    try {
      const response = await fetch('/api/ghl/locations')
      if (response.ok) {
        const data = await response.json()
        return data.locations || []
      }
    } catch (error) {
      console.error('Error loading locations:', error)
    }
    return []
  }, [])

  // Load health scores from API
  const loadHealthScores = useCallback(async (): Promise<HealthScoreData[]> => {
    try {
      const response = await fetch('/api/health-scoring')
      if (response.ok) {
        const data = await response.json()
        return data.data || []
      }
    } catch (error) {
      console.error('Error loading health scores:', error)
    }
    return []
  }, [])

  // Load custom blops from database
  const loadCustomBlops = useCallback(async (): Promise<AgencyBlop[]> => {
    try {
      const response = await fetch('/api/blops')
      if (response.ok) {
        const data = await response.json()
        return data.blops || []
      }
    } catch (error) {
      console.error('Error loading custom blops:', error)
    }
    return []
  }, [])

  // Save custom blops to database
  const saveCustomBlops = useCallback(async (blopsToSave: AgencyBlop[], incremental = false, skipActivityLog = false) => {
    try {
      const customBlops = blopsToSave.filter(blop => !blop.id.startsWith('location-'))
      if (customBlops.length === 0) return

      const response = await fetch('/api/blops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blops: customBlops.map(blop => ({
            id: blop.id,
            x: blop.x,
            y: blop.y,
            shape: blop.shape,
            color: blop.color,
            title: blop.title,
            content: blop.content,
            type: blop.type,
            status: blop.status,
            connections: (blop.connections || []).map((conn: any) => JSON.stringify(conn)),
          })),
          incremental,
          skipActivityLog,
        }),
      })

      if (!response.ok) {
        console.error('Failed to save custom blops:', await response.text())
      }
    } catch (error) {
      console.error('Error saving custom blops:', error)
    }
  }, [])

  // Load saved positions from localStorage
  const loadSavedPositions = useCallback((): Record<string, { x: number; y: number }> => {
    try {
      const saved = localStorage.getItem('flexboard-positions')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  }, [])

  // Save positions to localStorage
  const savePositions = useCallback((blops: AgencyBlop[]) => {
    try {
      const positions: Record<string, { x: number; y: number }> = {}
      blops.forEach(blop => {
        positions[blop.id] = { x: blop.x, y: blop.y }
      })
      localStorage.setItem('flexboard-positions', JSON.stringify(positions))
    } catch (error) {
      console.warn('Failed to save positions:', error)
    }
  }, [])

  // Create blops from locations and health data
  const createBlops = useCallback((
    locations: LocationData[],
    healthScores: HealthScoreData[],
    savedPositions?: Record<string, { x: number; y: number }>
  ): AgencyBlop[] => {
    return locations.map((location, index) => {
      const healthScore = healthScores.find(h => h.location_id === location.id)

      const status = healthScore?.health_status || 'info'
      const color = status === "healthy" ? "bg-green-500" :
                   status === "warning" ? "bg-yellow-500" :
                   status === "critical" ? "bg-red-500" : "bg-blue-500"

      const blopId = `location-${location.id}`
      const savedPos = savedPositions?.[blopId]

      return {
        id: blopId,
        x: savedPos ? savedPos.x : 200 + (index * 320),
        y: savedPos ? savedPos.y : 200 + (Math.floor(index / 3) * 200),
        shape: "square",
        color,
        title: location.name,
        content: `${location.city || 'Unknown City'}, ${location.state || 'Unknown State'}\n\nLeads: ${healthScore?.total_leads || 'N/A'}\nDeals: ${healthScore?.total_deals || 'N/A'}\nRevenue: $${healthScore?.current_revenue ? (healthScore.current_revenue / 1000).toFixed(0) + 'K' : 'N/A'}`,
        type: "location-status",
        status,
        data: { locationId: location.id, locationData: location },
        healthData: healthScore
      }
    })
  }, [])

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      if (!user) return

      setLoading(true)
      try {
        const [locations, healthScores, customBlops] = await Promise.all([
          loadLocations(),
          loadHealthScores(),
          loadCustomBlops()
        ])

        const savedPositions = loadSavedPositions()

        // Create location-based blops
        const locationBlops = createBlops(locations, healthScores, savedPositions)

        // Convert database blops to our format
        const formattedCustomBlops = customBlops.map((blop: any) => {
          const formatted = formatBlopData(blop)
          const savedPos = savedPositions[blop.id]
          return {
            ...formatted,
            x: savedPos ? savedPos.x : formatted.x,
            y: savedPos ? savedPos.y : formatted.y,
          }
        })

        setBlops([...locationBlops, ...formattedCustomBlops])
      } catch (error) {
        console.error('Error initializing data:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [user, loadLocations, loadHealthScores, loadCustomBlops, createBlops, loadSavedPositions])

  // Auto-save positions when blops change
  useEffect(() => {
    if (blops.length > 0 && !loading) {
      const timeoutId = setTimeout(() => savePositions(blops), 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [blops, loading, savePositions])

  // Track blops that need saving (exclude location blops and position-only changes)
  const blopsRef = useRef<AgencyBlop[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Check for meaningful changes (not just positions)
  useEffect(() => {
    const customBlops = blops.filter(blop => !blop.id.startsWith('location-'))
    const prevCustomBlops = blopsRef.current

    // Check if content/structure changed (not just positions)
    const hasContentChanges = customBlops.length !== prevCustomBlops.length ||
      customBlops.some(blop => {
        const prev = prevCustomBlops.find(p => p.id === blop.id)
        return !prev ||
          prev.title !== blop.title ||
          prev.content !== blop.content ||
          prev.type !== blop.type ||
          prev.connections !== blop.connections
      })

    if (hasContentChanges) {
      blopsRef.current = [...customBlops]
      setHasUnsavedChanges(true)
    }
  }, [blops])

  // DISABLED: Auto-save causing issues
  // useEffect(() => {
  //   if (hasUnsavedChanges && !loading) {
  //     const timeoutId = setTimeout(() => {
  //       const customBlops = blops.filter(blop => !blop.id.startsWith('location-'))
  //       if (customBlops.length > 0) {
  //         saveCustomBlops(customBlops, true, true) // Incremental upsert but skip activity logging for sync
  //         setHasUnsavedChanges(false)
  //       }
  //     }, 2000)
  //     return () => clearTimeout(timeoutId)
  //   }
  // }, [hasUnsavedChanges, loading, saveCustomBlops])

  // Filtered blops based on search
  const filteredBlops = useMemo(() =>
    blops.filter(blop => {
      const title = blop.title || ''
      const content = blop.content || ''
      const query = searchQuery.toLowerCase()
      return title.toLowerCase().includes(query) || content.toLowerCase().includes(query)
    }), [blops, searchQuery]
  )

  // Count different types of blops
  const blopCounts = useMemo(() => {
    const custom = blops.filter(blop => !blop.id.startsWith('location-')).length
    const locations = blops.filter(blop => blop.id.startsWith('location-')).length
    return { custom, locations, total: blops.length, filtered: filteredBlops.length }
  }, [blops, filteredBlops])

  // Generate a proper UUID for new blops
  const generateUUID = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }, [])

  // Format blop data from database/external sources to frontend format
  const formatBlopData = useCallback((blopData: any) => {
    let connections = []
    try {
      if (Array.isArray(blopData.connections)) {
        // Parse each JSON string in the array
        const parsedConnections: any[] = []
        for (const conn of blopData.connections) {
          try {
            if (typeof conn === 'string') {
              const parsed = JSON.parse(conn)
              // Validate that parsed connection has required fields
              if (parsed && typeof parsed === 'object' && 'targetId' in parsed && 'type' in parsed) {
                parsedConnections.push(parsed)
              } else {
                console.warn('Invalid connection format for blop', blopData.id, ':', conn)
              }
            } else if (conn && typeof conn === 'object' && 'targetId' in conn && 'type' in conn) {
              // Already parsed object
              parsedConnections.push(conn)
            } else {
              console.warn('Invalid connection object for blop', blopData.id, ':', conn)
            }
          } catch (e) {
            console.error('Error parsing connection for blop', blopData.id, ':', conn, e)
          }
        }
        connections = parsedConnections
      }
    } catch (error) {
      console.error('Error parsing connections array for blop', blopData.id, ':', error)
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
  }, [])

  // Add new blop
  const addBlop = useCallback(async () => {
    if (addingBlopRef.current) {
      return
    }

    addingBlopRef.current = true
    setAddingBlop(true)

    const newBlop: AgencyBlop = {
      id: generateUUID(),
      x: Math.random() * 400 + 200,
      y: Math.random() * 300 + 150,
      shape: "square",
      color: "bg-blue-500",
      title: "New Task",
      content: "Double-click to edit this task",
      type: "text",
      status: "info",
    }

    setBlops(prev => [...prev, newBlop])

    // Save immediately (not incremental for new blops)
    try {
      await saveCustomBlops([newBlop], false)
    } catch (error) {
      console.error('Failed to save new blop:', error)
    } finally {
      setAddingBlop(false)
      addingBlopRef.current = false
    }
  }, [generateUUID, saveCustomBlops, addingBlop])

  // Edit blop
  const editBlop = useCallback(async (blopId: string, newTitle?: string, newContent?: string) => {
    if (!newTitle && !newContent) return

    const updatedBlop = blops.find(blop => blop.id === blopId)
    if (!updatedBlop) {
      return
    }

    const finalBlop = {
      ...updatedBlop,
      title: newTitle || updatedBlop.title,
      content: newContent || updatedBlop.content
    }

    setBlops(prev => prev.map(blop =>
      blop.id === blopId ? finalBlop : blop
    ))

    // Save if it's a custom blop
    if (!blopId.startsWith('location-')) {
      try {
        const response = await fetch(`/api/blops/${blopId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            x: finalBlop.x,
            y: finalBlop.y,
            shape: finalBlop.shape,
            color: finalBlop.color,
            title: finalBlop.title,
            content: finalBlop.content,
            type: finalBlop.type,
            tags: null,
            connections: finalBlop.connections || null,
          }),
        })

        if (!response.ok) {
          console.error('Failed to update blop:', await response.text())
        }
      } catch (error) {
        console.error('Error updating blop:', error)
      }
    }
  }, [blops, saveCustomBlops])

  // Delete blop
  const deleteBlop = useCallback(async (blopId: string) => {
    if (confirm('Are you sure you want to delete this blop?')) {
      // First, clean up connections that reference this blop
      setBlops(prev => prev.map(blop => {
        if (blop.id !== blopId && blop.connections) {
          // Remove any connections that point to the deleted blop
          const cleanedConnections = blop.connections.filter(conn => conn.targetId !== blopId)
          if (cleanedConnections.length !== blop.connections.length) {
            // Update the blop in database if it's a custom blop
            if (!blop.id.startsWith('location-')) {
              // Update the blop with cleaned connections (don't await to avoid blocking)
              fetch(`/api/blops/${blop.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connections: cleanedConnections }),
              }).catch(error => console.error('Failed to update connections after deletion:', error))
            }
            return { ...blop, connections: cleanedConnections }
          }
        }
        return blop
      }))

      // Then remove the blop itself
      setBlops(prev => prev.filter(blop => blop.id !== blopId))
      setSelectedBlop(null)

      // Delete from database if it's a custom blop
      if (!blopId.startsWith('location-')) {
        try {
          const response = await fetch(`/api/blops/${blopId}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            console.error('Failed to delete blop from database:', response.status, await response.text())
          }
        } catch (error) {
          console.error('Error deleting blop:', error)
        }
      }
    }
  }, [blops])

  // Auto-arrange blops
  const autoArrange = useCallback(() => {
    setBlops(prevBlops =>
      prevBlops.map((blop, index) => ({
        ...blop,
        x: 200 + (index % 4) * 320,
        y: 200 + Math.floor(index / 4) * 220
      }))
    )
  }, [])

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("")
    setSelectedBlop(null)
  }, [])

  // Create connection between blops
  const createConnection = useCallback(async (
    fromId: string,
    toId: string,
    type: ConnectionType,
    label?: string,
    bidirectional = false
  ) => {
    const connection: Connection = {
      targetId: toId,
      type,
      label,
      bidirectional
    }

    // Update local state
    setBlops(prev => prev.map(blop => {
      if (blop.id === fromId) {
        const existingConnections = blop.connections || []
        // Check if connection already exists
        const connectionExists = existingConnections.some(conn => conn.targetId === toId)
        if (!connectionExists) {
          return {
            ...blop,
            connections: [...existingConnections, connection]
          }
        }
      }
      return blop
    }))

    // Save to database
    if (!fromId.startsWith('location-')) {
      try {
        // Update the specific blop with new connections
        const currentConnections = blops.find(blop => blop.id === fromId)?.connections || []
        const updatedConnections = [...currentConnections, connection]

        const response = await fetch(`/api/blops/${fromId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connections: updatedConnections
          }),
        })

        if (!response.ok) {
          console.error('Failed to save connection:', await response.text())
        }
      } catch (error) {
        console.error('Failed to save connection:', error)
      }
    }
  }, [blops, saveCustomBlops])

  // Remove connection between blops
  const removeConnection = useCallback(async (fromId: string, toId: string) => {
    setBlops(prev => prev.map(blop => {
      if (blop.id === fromId) {
        const filteredConnections = (blop.connections || []).filter(conn => conn.targetId !== toId)
        return {
          ...blop,
          connections: filteredConnections.length > 0 ? filteredConnections : undefined
        }
      }
      return blop
    }))

    // Save to database
    try {
      const blopToUpdate = blops.find(blop => blop.id === fromId)
      if (blopToUpdate) {
        const filteredConnections = (blopToUpdate.connections || []).filter(conn => conn.targetId !== toId)
        await saveCustomBlops([{
          ...blopToUpdate,
          connections: filteredConnections.length > 0 ? filteredConnections : undefined
        }], true)
      }
    } catch (error) {
      console.error('Failed to remove connection:', error)
    }
  }, [blops, saveCustomBlops])

  // Refresh health data
  const refreshData = useCallback(async () => {
    try {
      const newHealthScores = await loadHealthScores()
      setBlops(prevBlops =>
        prevBlops.map(blop => {
          if (blop.id.startsWith('location-')) {
            const healthScore = newHealthScores.find(h => h.location_id === blop.data?.locationId)
            if (healthScore) {
              const status = healthScore.health_status
              const color = status === "healthy" ? "bg-green-500" :
                           status === "warning" ? "bg-yellow-500" :
                           status === "critical" ? "bg-red-500" : "bg-blue-500"

              return {
                ...blop,
                status,
                color,
                healthData: healthScore,
                content: `${blop.data?.locationData.city || 'Unknown City'}, ${blop.data?.locationData.state || 'Unknown State'}\n\nLeads: ${healthScore.total_leads || 'N/A'}\nDeals: ${healthScore.total_deals || 'N/A'}\nRevenue: $${healthScore.current_revenue ? (healthScore.current_revenue / 1000).toFixed(0) + 'K' : 'N/A'}`
              }
            }
          }
          return blop
        })
      )
    } catch (error) {
      console.error('Error refreshing data:', error)
    }
  }, [loadHealthScores])

  return {
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
  }
}