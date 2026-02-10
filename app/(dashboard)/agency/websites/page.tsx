"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, ExternalLink, Edit, Trash2, Check, X, Loader2 } from "lucide-react"
import { SaveButton } from "@/components/ui/save-button"
import { useUser } from "@clerk/nextjs"

interface Website {
  id: string
  url: string
  name: string
  saved?: boolean // Track if website is saved to database
  techStack: {
    frontend: string
    backend: string
    hosting: string
    analytics: string
    paymentMethod: string
  }
}

export default function WebsitesPage() {
  const { user } = useUser()
  const [websites, setWebsites] = useState<Website[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load websites from database on mount
  useEffect(() => {
    async function loadWebsites() {
      if (!user) return

      try {
        const response = await fetch('/api/websites')
        if (response.ok) {
          const data = await response.json()
          setHasLoadedFromDB(true)

          // Always set websites from database, even if empty
          const loadedWebsites: Website[] = data.websites ? data.websites.map((w: any) => ({
            id: w.id,
            url: w.url,
            name: w.name,
            saved: true, // Mark as saved since loaded from database
            techStack: w.tech_stack || {
              frontend: "",
              backend: "",
              hosting: "",
              analytics: "",
              paymentMethod: "",
            },
          })) : []

          setWebsites(loadedWebsites)
        }
      } catch (error) {
        console.error('Failed to load websites:', error)
        setHasLoadedFromDB(true)
      }
    }

    loadWebsites()
  }, [user])

  const handleAddWebsite = () => {
    const newWebsite: Website = {
      id: crypto.randomUUID(),
      url: "",
      name: "",
      saved: false, // Mark as not saved initially
      techStack: {
        frontend: "",
        backend: "",
        hosting: "",
        analytics: "",
        paymentMethod: "",
      },
    }
    setWebsites([...websites, newWebsite])
  }

  const handleDeleteWebsite = async (id: string) => {
    if (!confirm('Are you sure you want to remove this website?')) {
      return
    }

    setDeletingId(id)

    try {
      const response = await fetch(`/api/websites?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state after successful deletion
        setWebsites(websites.filter(w => w.id !== id))
        // Notify other pages that websites have been updated
        window.dispatchEvent(new CustomEvent('websitesUpdated'))
      } else {
        const error = await response.json()
        alert(`Failed to delete website: ${error.error}`)
      }
    } catch (error: any) {
      console.error('Error deleting website:', error)
      alert('Failed to delete website. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditWebsite = (id: string) => {
    setEditingId(editingId === id ? null : id)
  }

  const updateWebsite = (id: string, updates: Partial<Website>) => {
    setWebsites(websites.map(w => w.id === id ? { ...w, ...updates } : w))
  }

  const updateTechStack = (id: string, techStack: Partial<Website['techStack']>) => {
    setWebsites(websites.map(w =>
      w.id === id
        ? { ...w, techStack: { ...w.techStack, ...techStack } }
        : w
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Filter out incomplete websites (must have both URL and name)
      const validWebsites = websites.filter(website =>
        website.url.trim() && website.name.trim()
      )

      if (validWebsites.length === 0) {
        throw new Error('No valid websites to save. Please fill in both URL and name for your websites.')
      }

      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websites: validWebsites.map(website => ({
            ...website,
            tech_stack: website.techStack, // Convert to snake_case for database
          })),
          workspaceId: null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Mark all valid websites as saved
        setWebsites(currentWebsites =>
          currentWebsites.map(website => ({
            ...website,
            saved: website.url.trim() && website.name.trim() ? true : website.saved
          }))
        )
        // Notify other pages that websites have been updated
        window.dispatchEvent(new CustomEvent('websitesUpdated'))
        return // Success - SaveButton will show success state
      } else {
        let errorMessage = 'Failed to save websites'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (parseError) {
          // If we can't parse JSON, use the response status text
          errorMessage = `Failed to save websites (${response.status}: ${response.statusText})`
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error('Error saving websites:', error)
      throw error // Re-throw so SaveButton can handle it
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Website Portfolio</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage all your websites and their technical details
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleAddWebsite}>
            <Plus className="mr-2 h-4 w-4" />
            Add Website
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {websites.map((website) => (
          <Card key={website.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {editingId === website.id ? (
                    <div className="space-y-2">
                      <Input
                        value={website.name}
                        onChange={(e) => updateWebsite(website.id, { name: e.target.value })}
                        className="font-semibold text-lg"
                        placeholder="Website name"
                      />
                      <Input
                        value={website.url}
                        onChange={(e) => updateWebsite(website.id, { url: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <CardTitle className={`truncate ${!website.name.trim() ? 'text-muted-foreground' : ''}`}>
                          {website.name || 'Unnamed Website'}
                        </CardTitle>
                        {!website.url.trim() || !website.name.trim() ? (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            Incomplete
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1">
                        {website.url ? (
                          <a
                            href={website.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline truncate"
                          >
                            <span className="truncate">{website.url}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No URL set</span>
                        )}
                      </CardDescription>
                    </>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditWebsite(website.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWebsite(website.id)}
                    disabled={deletingId === website.id}
                  >
                    {deletingId === website.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === website.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Frontend</label>
                      <Input
                        value={website.techStack.frontend}
                        onChange={(e) => updateTechStack(website.id, { frontend: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="React, Vue, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Backend</label>
                      <Input
                        value={website.techStack.backend}
                        onChange={(e) => updateTechStack(website.id, { backend: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Node.js, Python, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Hosting</label>
                      <Input
                        value={website.techStack.hosting}
                        onChange={(e) => updateTechStack(website.id, { hosting: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Vercel, Netlify, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Analytics</label>
                      <Input
                        value={website.techStack.analytics}
                        onChange={(e) => updateTechStack(website.id, { analytics: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Google Analytics, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                      <Input
                        value={website.techStack.paymentMethod}
                        onChange={(e) => updateTechStack(website.id, { paymentMethod: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Stripe, PayPal, etc."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={async () => {
                        // Auto-save when done editing
                        try {
                          await handleSave()
                          setEditingId(null)
                        } catch (error) {
                          console.error('Failed to save:', error)
                          // Still allow closing edit mode even if save fails
                          setEditingId(null)
                        }
                      }}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Save & Done
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Frontend:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.frontend || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Backend:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.backend || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Hosting:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.hosting || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Analytics:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.analytics || 'Not set'}
                      </span>
                    </div>
                    {website.techStack.paymentMethod && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm font-medium">Payment Method:</span>
                        <span className="text-sm text-muted-foreground">
                          {website.techStack.paymentMethod}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


