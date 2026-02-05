"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertTriangle,
  RefreshCw,
  Key,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink
} from "lucide-react"

interface FailedToken {
  location_id: string
  location_name: string
  first_failure: string
  endpoints: string[]
  error_message: string
}

export function PitTokenManager() {
  const { user, isLoaded } = useUser()
  const [failedTokens, setFailedTokens] = useState<FailedToken[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<FailedToken | null>(null)
  const [newToken, setNewToken] = useState('')
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const loadFailedTokens = async () => {
    if (!isLoaded || !user) {
      console.log('PitTokenManager: Waiting for authentication...')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ghl/data?endpoint=get-failed-tokens')
      const data = await response.json()
      setFailedTokens(data.failedTokens || [])
    } catch (error) {
      console.error('Failed to load failed tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateToken = async (locationId: string, token: string) => {
    if (!user) {
      setUpdateError('Authentication required')
      return
    }

    setUpdating(locationId)
    setUpdateError(null)

    try {
      const response = await fetch(`/api/ghl/data?endpoint=update-pit-token&locationId=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newToken: token })
      })

      const data = await response.json()

      if (data.success) {
        setUpdateSuccess(`${selectedLocation?.location_name} token updated successfully!`)
        setSelectedLocation(null)
        setNewToken('')
        await loadFailedTokens() // Refresh the list
      } else {
        setUpdateError(data.error || 'Failed to update token')
      }
    } catch (error) {
      setUpdateError('Network error while updating token')
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    loadFailedTokens()
  }, [isLoaded, user])

  // Also check sessionStorage for client-side detected failures
  useEffect(() => {
    const checkSessionStorage = () => {
      const sessionFailed = JSON.parse(sessionStorage.getItem('failedPitTokens') || '[]')
      if (sessionFailed.length > 0) {
        console.log('Found client-side failed tokens:', sessionFailed)
        // You could show these in the UI as well
      }
    }
    checkSessionStorage()
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                PIT Token Manager
              </CardTitle>
              <CardDescription>
                Manage expired PIT tokens for GoHighLevel locations
              </CardDescription>
            </div>
            <Button
              onClick={loadFailedTokens}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {updateSuccess && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {updateSuccess}
              </AlertDescription>
            </Alert>
          )}

          {failedTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All tokens are working!</p>
              <p>No failed PIT tokens detected in the last 24 hours.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {failedTokens.length} location{failedTokens.length !== 1 ? 's' : ''} need new PIT tokens.
                  Click &quot;Update Token&quot; for each location to fix.
                </AlertDescription>
              </Alert>

              {failedTokens.map((token) => (
                <Card key={token.location_id} className="border-red-200 bg-red-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <h3 className="font-semibold">{token.location_name}</h3>
                          <Badge variant="destructive">Token Expired</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Location ID:</strong> {token.location_id}</p>
                          <p><strong>First Failed:</strong> {new Date(token.first_failure).toLocaleString()}</p>
                          <p><strong>Failed Endpoints:</strong> {token.endpoints.join(', ')}</p>
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLocation(token)
                              setNewToken('')
                              setUpdateError(null)
                            }}
                          >
                            Update Token
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update PIT Token for {token.location_name}</DialogTitle>
                            <DialogDescription>
                              Enter the new PIT token from GoHighLevel. You can generate a new token at:
                              <br />
                              <a
                                href="https://app.gohighlevel.com/settings/api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                              >
                                GoHighLevel API Settings <ExternalLink className="h-3 w-3" />
                              </a>
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            {updateError && (
                              <Alert variant="destructive">
                                <AlertDescription>{updateError}</AlertDescription>
                              </Alert>
                            )}

                            <div>
                              <Label htmlFor="newToken">New PIT Token</Label>
                              <Input
                                id="newToken"
                                type="password"
                                placeholder="pit-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                                className="font-mono"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Token will be stored securely in the database
                              </p>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedLocation(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => updateToken(token.location_id, newToken)}
                                disabled={!newToken.trim() || updating === token.location_id}
                              >
                                {updating === token.location_id ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  'Update Token'
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}