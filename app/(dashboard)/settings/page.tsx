"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { TeamManagement } from "@/components/team/team-management"
import { WorkspaceSettings } from "@/components/workspace/workspace-settings"
import { CreateWorkspaceModal } from "@/components/workspace/create-workspace-modal"
import { WorkspaceRequestsPanel } from "@/components/workspace/workspace-requests-panel"
import { MyWorkspaceRequests } from "@/components/workspace/my-workspace-requests"
import { useWorkspace } from "@/components/workspace-context"
import { useTheme } from "@/lib/theme-context"
import { useFlexboard } from "@/lib/flexboard-context"

export default function SettingsPage() {
  const { currentWorkspace } = useWorkspace()
  const { theme, setTheme } = useTheme()
  const { settings: flexboardSettings, updateSettings: updateFlexboardSettings } = useFlexboard()
  const [canManageRequests, setCanManageRequests] = useState(false)
  const [loadingPermissions, setLoadingPermissions] = useState(true)

  // Check if user can manage workspace requests (admins/owners only)
  useEffect(() => {
    const checkPermissions = async () => {
      if (!currentWorkspace) {
        setLoadingPermissions(false)
        return
      }

      try {
        const response = await fetch(`/api/user/permissions?workspaceId=${currentWorkspace.id}`)
        if (response.ok) {
          const data = await response.json()
          setCanManageRequests(data.permissions.canManageWorkspaceRequests)
        }
      } catch (error) {
        console.error('Failed to check permissions:', error)
        setCanManageRequests(false)
      } finally {
        setLoadingPermissions(false)
      }
    }

    checkPermissions()
  }, [currentWorkspace])

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your workspace preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="ui">UI & Themes</TabsTrigger>
          <TabsTrigger value="flexboard">Flexboard</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {currentWorkspace ? (
            <>
              <TeamManagement workspaceId={currentWorkspace.id} />
              {!loadingPermissions && canManageRequests && <WorkspaceRequestsPanel />}
              {!loadingPermissions && !canManageRequests && <MyWorkspaceRequests />}
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  No workspace available
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 text-center space-y-4">
                <div className="text-muted-foreground">
                  <p>You need to have a workspace to manage team members.</p>
                  <p>Please select or create a workspace first.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <WorkspaceSettings />

          <Card>
            <CardHeader>
              <CardTitle>Workspace Management</CardTitle>
              <CardDescription>
                Create and manage your workspaces
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentWorkspace?.name}</p>
                  <p className="text-sm text-muted-foreground">Current workspace</p>
                </div>
                <CreateWorkspaceModal />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic workspace configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about your workspace
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Coming Soon
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoSave">Auto-save</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically save changes (always enabled)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    ✓ Enabled
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ui" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme" name="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred theme. System will follow your OS setting.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flexboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flexboard Settings</CardTitle>
              <CardDescription>
                Configure your flexboard preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="snapToGrid">Snap to Grid</Label>
                  <p className="text-sm text-muted-foreground">
                    Align blops to grid automatically
                  </p>
                </div>
                <Switch
                  id="snapToGrid"
                  name="snapToGrid"
                  checked={flexboardSettings.snapToGrid}
                  onCheckedChange={(checked) => updateFlexboardSettings({ snapToGrid: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultBlopShape">Default Blop Shape</Label>
                <Select defaultValue="circle">
                  <SelectTrigger id="defaultBlopShape" name="defaultBlopShape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="pill">Pill</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="defaultBlopShape" value="circle" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="boardBackground">Board Background</Label>
                <Select
                  value={flexboardSettings.boardBackground}
                  onValueChange={(value) => updateFlexboardSettings({ boardBackground: value as 'grid' | 'dots' | 'plain' })}
                >
                  <SelectTrigger id="boardBackground" name="boardBackground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="dots">Dots</SelectItem>
                    <SelectItem value="plain">Plain</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the background pattern for the flexboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect external services to your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">GoHighLevel</div>
                  <div className="text-sm text-muted-foreground">
                    CRM and marketing automation
                  </div>
                </div>
                <Button variant="outline">Connect</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Vercel</div>
                  <div className="text-sm text-muted-foreground">
                    Deployment and hosting
                  </div>
                </div>
                <Button variant="outline">Connect</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Stripe</div>
                  <div className="text-sm text-muted-foreground">
                    Payment processing
                  </div>
                </div>
                <Button variant="outline">Connect</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or import your workspace data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Export Data</div>
                  <div className="text-sm text-muted-foreground">
                    Download all your workspace data as JSON
                  </div>
                </div>
                <Button variant="outline">Export</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Import Data</div>
                  <div className="text-sm text-muted-foreground">
                    Upload workspace data from a JSON file
                  </div>
                </div>
                <Button variant="outline">Import</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


