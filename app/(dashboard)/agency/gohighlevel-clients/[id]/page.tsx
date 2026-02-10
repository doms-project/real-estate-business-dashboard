"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WebsiteAnalyticsDashboard } from "@/components/analytics/website-analytics-dashboard"
import { LocationAIInsights } from "@/components/location-ai-insights"
import {
  Building2,
  MessageSquare,
  Users,
  TrendingUp,
  Loader2,
  Clock,
  ArrowLeft,
  RefreshCw,
  Phone,
  Mail,
  MessageCircle,
  BarChart3,
  Activity,
  Zap,
  GitBranch,
  Target,
  Play,
  Edit,
  AlertCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  PieChart,
  Calendar,
  UserCheck,
  FileText,
  FileCheck,
  Eye,
  Send,
  Settings,
  Copy,
  ChevronDown,
  ChevronRight,
  Trophy,
  MapPin,
  Shield,
  Smartphone,
  AlertTriangle,
  Layers,
  MousePointerClick,
  Info,
  Globe,
  ArrowRight,
  ExternalLink,
  ShoppingCart,
  Plus
} from "lucide-react"
import { useUser } from "@clerk/nextjs"

// Location interface
interface GHLLocation {
  id: string
  name: string
  city: string
  state: string
  country: string
  address: string
  pitToken?: string
}

// Comprehensive analytics interface
interface LocationAnalytics {
  // Core metrics
  contacts: number
  opportunities: number
  conversations: number
  healthScore: number
  lastUpdated: string

  // Extended data objects
  contactsData?: { total: number }
  opportunitiesData?: { total: number }
  conversationsData?: { total: number }

  // Conversation analytics
  conversationMetrics: {
    totalConversations: number
    activeConversations: number
    avgResponseTime: number
    responseRate: number
    channelBreakdown: {
      sms: number
      email: number
      phone: number
    }
  }

  // Lead sources
  leadSources: {
    totalLeads: number
    sources: Array<{
      source: string
      count: number
      percentage: number
    }>
    dataQuality?: {
      contactsWithAnySource: number
      contactsWithoutSource: number
      completionRate: number
      totalSourceAttributions?: number
      bestFieldUsed: string
      fieldAnalysis: Record<string, number>
    }
  }

  // Social media analytics
  socialAnalytics: {
    summary: {
      totalAccounts: number
      totalPosts: number
      totalEngagement: number
      averageEngagementRate: number
    }
    accounts: Array<any>
    platformBreakdown: Record<string, any>
    trends: Record<string, any>
    lastUpdated: string
    locationId?: string
    error?: string
    note?: string
  }

  // Available pipelines
  pipelines: Array<{
    id: string
    name: string
    stages?: Array<{
      id: string
      name: string
      order?: number
    }>
  }>

  // Pipeline-specific opportunity counts
  pipelineOpportunityCounts: Record<string, number>

  // Pipeline activity details (real data with timestamps)
  pipelineActivityDetails: {
    pipelineActivity: Record<string, {
      totalOpportunities: number
      newThisWeek: number
      newThisMonth: number
      recentStageChanges: number
      velocity: number
      lastActivity: Date | null
    }>
    summary: {
      totalOpportunities: number
      newOpportunities7Days: number
      newOpportunities30Days: number
      recentStageChanges: number
    }
    timelineEvents: Array<{
      id: string
      type: string
      title: string
      description: string
      pipelineId: string
      time: Date
      count: number
    }>
  }

  // Pipeline analysis
  pipelineAnalysis: {
    totalOpportunities: number
    totalValue: number
    totalWon?: number
    totalLost?: number
    totalClosedValue?: number
    winRate?: number
    avgTimeToClose?: number
    agingOpportunities?: number
    stages: Array<{
      stage: string
      count: number
      value: number
      avgValue: number
      wonCount?: number
      lostCount?: number
      winRate?: number
      avgDaysInStage?: number
      agingCount?: number
      percentage: number
    }>
  }

  // Activity metrics
  activityMetrics: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    completionRate: number
    activeContactsThisWeek: number
    recentActivity: Array<{
      id: string
      title: string
      type: string
      completed: boolean
      dueDate: string
      assignedTo: string
    }>
  }

  // Revenue metrics
  revenueMetrics: {
    totalRevenue: number
    totalOpportunities: number
    wonOpportunities: number
    lostOpportunities: number
    avgDealSize: number
    winRate: number
    totalLostValue: number
    monthlyRevenue: Array<{
      month: string
      revenue: number
    }>
    disabled?: boolean // Optional flag to indicate if revenue data is disabled/unavailable
  }

  // Real forms and surveys data
  formsData: {
    forms: Array<{
      id: string
      locationId: string
      name: string
      // Add other form properties as needed
    }>
    totalForms: number
  }
  formsSubmissions: {
    submissions: Array<{
      id: string
      contactId: string
      formId: string
      name: string
      others: any
      createdAt: string
      // Add other submission properties as needed
    }>
    totalSubmissions: number
  }
  surveysData: {
    surveys: Array<{
      id: string
      locationId: string
      name: string
      // Add other survey properties as needed
    }>
    totalSurveys: number
  }
  surveysSubmissions: {
    submissions: Array<{
      id: string
      contactId: string
      surveyId: string
      name: string
      email: string
      submittedAt?: string
      createdAt?: string
      answers?: Record<string, any>
      others: any
      // Add other survey response properties as needed
    }>
    totalSurveyResponses: number
  }

  // Workflows data
  workflows: Array<{
    id: string
    name: string
    status: string
    version: number
    locationId: string
    createdAt?: string
    updatedAt?: string
    triggers?: Array<{
      type: string
      conditions?: any[]
    }>
    actions?: Array<{
      type: string
      config?: any
    }>
  }>

  // Funnels data
  funnelsData: {
    funnels: Array<{
      id: string
      name: string
      type?: string
      status?: string
      source: 'ghl_official' | 'custom_analytics'
      totalOpportunities?: number
      totalValue?: number
      wonOpportunities?: number
      winRate?: number
      avgDealSize?: number
      stages?: Array<{
        name: string
        count: number
        value?: number
        percentage: number
        conversionRate?: number
      }>
      pages?: Array<any>
      url?: string
      published?: boolean
      createdAt?: string
      updatedAt?: string
    }>
    summary: {
      totalFunnels: number
      officialFunnels: number
      customAnalyticsFunnels: number
      totalOpportunities: number
      totalValue: number
      avgWinRate: number
    }
    funnelPages: Array<any>
    funnelPagesCount: number
    apiStatus: {
      officialApiAvailable: boolean
      customAnalyticsAvailable: boolean
      hasFunnelPages: boolean
      hasFunnelPagesCount: boolean
    }
    success: boolean
    message?: string
    error?: string
  }

  // Location details from GHL API
  locationData?: {
    location: {
      id: string
      name: string
      address: string
      city: string
      state: string
      postalCode: string
      country: string
      email: string
      phone: string
      firstName: string
      lastName: string
      website: string
      logoUrl: string
      timezone: string
      googlePlacesId: string
      dateAdded: string
      permissions?: Record<string, boolean>
      social?: Record<string, string>
      settings?: any
    }
    success: boolean
    message: string
  }

  // Website analytics (custom implementation)
  websiteAnalytics?: {
    pageViews: number
    uniqueVisitors: number
    sessions: number
    avgSessionDuration: number
    eventsCount: number
    topPages: Array<{page: string, views: number}>
    trafficSources: Record<string, number>
    recentPageViews: Array<any>
    recentEvents: Array<any>
    websites?: Array<{
      siteId: string
      analytics?: {
        pageViews: number
        uniqueVisitors: number
        sessions: number
        eventsCount: number
      }
    }>
    lastUpdated: string
  }
}

// Activity Dashboard Component - Shows real data changes as activities
function ActivityDashboard({ analytics }: { analytics: LocationAnalytics }) {
  // Load previous data for comparison
  const loadPreviousData = () => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(`activity_previous_${(location as unknown as GHLLocation)?.id || 'default'}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  // Detect item updates by comparing timestamps
  const detectItemUpdates = (currentItems: any[], previousItems: any[], itemType: string) => {
    if (!currentItems || !previousItems) return [];

    const updates = currentItems.filter((current: any) => {
      const previous = previousItems.find((prev: any) => prev.id === current.id);
      if (!previous) return false;

      // Check if updated_at timestamp is newer
      const currentTime = new Date(current.updated_at || current.created_at || 0);
      const previousTime = new Date(previous.updated_at || previous.created_at || 0);

      return currentTime > previousTime;
    });

    return updates.map(item => ({
      id: `${itemType}-update-${item.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: itemType as any,
      title: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} updated`,
      description: `"${item.name || item.title || `Item ${item.id}`}" was modified`,
      icon: itemType === 'form' ? FileText : itemType === 'survey' ? FileCheck : itemType === 'funnel' ? Target : itemType === 'workflow' ? Zap : Activity,
      color: itemType === 'form' ? 'text-orange-600' : itemType === 'survey' ? 'text-cyan-600' : itemType === 'funnel' ? 'text-pink-600' : 'text-yellow-600'
    }));
  };

  // Save current data for next comparison
  const saveCurrentData = (data: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`activity_previous_${(location as unknown as GHLLocation)?.id || 'default'}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save activity data:', error);
    }
  };

  // Generate activity feed from real data changes
  const generateActivityFeed = () => {
    // Filter activities to last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activities: Array<{
      id: string;
      timestamp: string;
      type: 'contact' | 'opportunity' | 'pipeline' | 'communication' | 'form' | 'survey' | 'funnel' | 'workflow' | 'system';
      title: string;
      description: string;
      icon: any;
      color: string;
    }> = [];

    const previousData = loadPreviousData();
    const currentData = {
      contacts: analytics.contactsData?.total || 0,
      opportunities: analytics.opportunitiesData?.total || 0,
      conversations: analytics.conversationsData?.total || 0,
      formsSubmissions: analytics.formsSubmissions?.totalSubmissions || 0,
      surveysSubmissions: analytics.surveysSubmissions?.totalSurveyResponses || 0,
      totalRevenue: analytics.revenueMetrics?.totalRevenue || 0,
      activeContacts: analytics.activityMetrics?.activeContactsThisWeek || 0,
      forms: analytics.formsData?.forms?.length || 0,
      surveys: analytics.surveysData?.surveys?.length || 0,
      funnels: analytics.funnelsData?.funnels?.length || 0,
      workflows: analytics.workflows?.length || 0,
      formsData: analytics.formsData?.forms || [],
      surveysData: analytics.surveysData?.surveys || [],
      funnelsData: analytics.funnelsData?.funnels || [],
      workflowsData: analytics.workflows || []
    };

    // Detect changes and create activities
    const now = new Date().toISOString();

    // Contact changes
    if (currentData.contacts > (previousData.contacts || 0)) {
      const newContacts = currentData.contacts - (previousData.contacts || 0);
      activities.push({
        id: `contacts-${Date.now()}`,
        timestamp: now,
        type: 'contact',
        title: `${newContacts} new contact${newContacts > 1 ? 's' : ''} detected`,
        description: `Contact count increased by ${newContacts} (detected at ${new Date(now).toLocaleTimeString()})`,
        icon: Users,
        color: 'text-green-600'
      });
    }

    // Opportunity changes
    if (currentData.opportunities > (previousData.opportunities || 0)) {
      const newOpportunities = currentData.opportunities - (previousData.opportunities || 0);
      activities.push({
        id: `opportunities-${Date.now()}`,
        timestamp: now,
        type: 'opportunity',
        title: `${newOpportunities} new opportunit${newOpportunities > 1 ? 'ies' : 'y'} detected`,
        description: `Pipeline expanded with ${newOpportunities} new deal${newOpportunities > 1 ? 's' : ''} (detected at ${new Date(now).toLocaleTimeString()})`,
        icon: TrendingUp,
        color: 'text-blue-600'
      });
    }

    // Conversation changes
    if (currentData.conversations > (previousData.conversations || 0)) {
      const newConversations = currentData.conversations - (previousData.conversations || 0);
      activities.push({
        id: `conversations-${Date.now()}`,
        timestamp: now,
        type: 'communication',
        title: `${newConversations} new conversation${newConversations > 1 ? 's' : ''} started`,
        description: `Customer engagement increased with ${newConversations} new interaction${newConversations > 1 ? 's' : ''}`,
        icon: MessageSquare,
        color: 'text-purple-600'
      });
    }

    // Form submission changes
    if (currentData.formsSubmissions > (previousData.formsSubmissions || 0)) {
      const newSubmissions = currentData.formsSubmissions - (previousData.formsSubmissions || 0);
      activities.push({
        id: `forms-${Date.now()}`,
        timestamp: now,
        type: 'form',
        title: `${newSubmissions} form${newSubmissions > 1 ? 's' : ''} submitted`,
        description: `Lead capture increased with ${newSubmissions} new form response${newSubmissions > 1 ? 's' : ''}`,
        icon: FileText,
        color: 'text-orange-600'
      });
    }

    // Survey submission changes
    if (currentData.surveysSubmissions > (previousData.surveysSubmissions || 0)) {
      const newSurveys = currentData.surveysSubmissions - (previousData.surveysSubmissions || 0);
      activities.push({
        id: `surveys-${Date.now()}`,
        timestamp: now,
        type: 'survey',
        title: `${newSurveys} survey${newSurveys > 1 ? 's' : ''} completed`,
        description: `Customer feedback received from ${newSurveys} response${newSurveys > 1 ? 's' : ''}`,
        icon: FileCheck,
        color: 'text-indigo-600'
      });
    }

    // Pipeline activity (real opportunity changes)
    if (analytics.pipelineActivityDetails?.timelineEvents) {
      analytics.pipelineActivityDetails.timelineEvents
        .slice(0, 10) // Limit recent events
        .forEach((event, index) => {
          activities.push({
            id: `pipeline-${Date.now()}-${index}`,
            timestamp: event.time && typeof event.time.toISOString === 'function' ? event.time.toISOString() : now,
            type: 'pipeline',
            title: 'Pipeline stage changed',
            description: event.description || `Opportunity progressed in sales funnel`,
            icon: GitBranch,
            color: 'text-blue-600'
          });
        });
    }

    // Revenue changes
    if (currentData.totalRevenue > (previousData.totalRevenue || 0)) {
      const revenueIncrease = currentData.totalRevenue - (previousData.totalRevenue || 0);
      activities.push({
        id: `revenue-${Date.now()}`,
        timestamp: now,
        type: 'system',
        title: `Revenue increased by $${revenueIncrease.toLocaleString()}`,
        description: `Total revenue grew to $${currentData.totalRevenue.toLocaleString()}`,
        icon: DollarSign,
        color: 'text-emerald-600'
      });
    }

    // New forms added
    if (currentData.forms > (previousData.forms || 0)) {
      const newForms = currentData.forms - (previousData.forms || 0);
      // Forms don't have creation timestamps, use detection time
      activities.push({
        id: `forms-added-${Date.now()}`,
        timestamp: now,
        type: 'form',
        title: `${newForms} new form${newForms > 1 ? 's' : ''} created`,
        description: `Form${newForms > 1 ? 's' : ''} added to capture leads and data`,
        icon: FileText,
        color: 'text-orange-600'
      });
    }

    // New surveys added
    if (currentData.surveys > (previousData.surveys || 0)) {
      const newSurveys = currentData.surveys - (previousData.surveys || 0);
      // Surveys don't have creation timestamps, use detection time
      activities.push({
        id: `surveys-added-${Date.now()}`,
        timestamp: now,
        type: 'survey',
        title: `${newSurveys} new survey${newSurveys > 1 ? 's' : ''} created`,
        description: `Survey${newSurveys > 1 ? 's' : ''} added for customer feedback`,
        icon: FileCheck,
        color: 'text-cyan-600'
      });
    }

    // New funnels added
    if (currentData.funnels > (previousData.funnels || 0)) {
      const newFunnels = currentData.funnels - (previousData.funnels || 0);
      // Funnels don't have creation timestamps, use detection time
      activities.push({
        id: `funnels-added-${Date.now()}`,
        timestamp: now,
        type: 'funnel',
        title: `${newFunnels} new funnel${newFunnels > 1 ? 's' : ''} created`,
        description: `Marketing funnel${newFunnels > 1 ? 's' : ''} added to convert leads`,
        icon: Target,
        color: 'text-pink-600'
      });
    }

    // New workflows added
    if (currentData.workflows > (previousData.workflows || 0)) {
      const newWorkflows = currentData.workflows - (previousData.workflows || 0);
      // Find the most recently created workflow for accurate timestamp
      const newWorkflowItems = currentData.workflowsData.filter((workflow: any) =>
        !previousData.workflowsData?.find((prev: any) => prev.id === workflow.id)
      );
      const latestWorkflow = newWorkflowItems.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0];

      activities.push({
        id: `workflows-added-${Date.now()}`,
        timestamp: latestWorkflow?.createdAt || now,
        type: 'workflow',
        title: `${newWorkflows} new workflow${newWorkflows > 1 ? 's' : ''} created`,
        description: latestWorkflow ? `Workflow "${latestWorkflow.name || `Workflow ${latestWorkflow.id}`}" added for automation` : `Automation workflow${newWorkflows > 1 ? 's' : ''} added for process automation`,
        icon: Zap,
        color: 'text-yellow-600'
      });
    }

    // Pipeline stage changes and opportunity movements (from real pipeline data)
    if (analytics.pipelineActivityDetails?.timelineEvents) {
      // Get recent pipeline events (last 7 days)
      const recentPipelineEvents = analytics.pipelineActivityDetails.timelineEvents
        .filter(event => {
          const eventTime = event.time;
          return eventTime >= sevenDaysAgo;
        })
        .slice(0, 5); // Limit to avoid overwhelm

      recentPipelineEvents.forEach((event, index) => {
        activities.push({
          id: `pipeline-event-${Date.now()}-${index}`,
          timestamp: event.time && typeof event.time.toISOString === 'function' ? event.time.toISOString() : now,
          type: 'pipeline',
          title: 'Pipeline opportunity updated',
          description: event.description || `Opportunity progressed in sales pipeline`,
          icon: GitBranch,
          color: 'text-blue-600'
        });
      });
    }

    // Detect item updates (existing items modified)
    const formUpdates = detectItemUpdates(currentData.formsData, previousData.formsData || [], 'form');
    const surveyUpdates = detectItemUpdates(currentData.surveysData, previousData.surveysData || [], 'survey');
    const funnelUpdates = detectItemUpdates(currentData.funnelsData, previousData.funnelsData || [], 'funnel');
    const workflowUpdates = detectItemUpdates(currentData.workflowsData, previousData.workflowsData || [], 'workflow');

    // Add all update activities
    activities.push(...formUpdates, ...surveyUpdates, ...funnelUpdates, ...workflowUpdates);

    // Save current data for next comparison
    saveCurrentData(currentData);

    // Sort by timestamp (most recent first)
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const activityFeed = generateActivityFeed();

  // Activity type counts for summary
  const activityCounts = {
    contact: activityFeed.filter(a => a.type === 'contact').length,
    opportunity: activityFeed.filter(a => a.type === 'opportunity').length,
    pipeline: activityFeed.filter(a => a.type === 'pipeline').length,
    communication: activityFeed.filter(a => a.type === 'communication').length,
    form: activityFeed.filter(a => a.type === 'form').length,
    survey: activityFeed.filter(a => a.type === 'survey').length,
    funnel: activityFeed.filter(a => a.type === 'funnel').length,
    workflow: activityFeed.filter(a => a.type === 'workflow').length,
    system: activityFeed.filter(a => a.type === 'system').length
  };

  // Get top activity types
  const topActivityTypes = Object.entries(activityCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Activity Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Dashboard</h2>
          <p className="text-gray-600">Complete view of every change in your GoHighLevel account (Last 7 days)</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          <span>{activityFeed.length} events tracked</span>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Changes</p>
                <p className="text-2xl font-bold text-gray-900">{activityFeed.length}</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.contactsData?.total || 0}</p>
                <p className="text-xs text-gray-500">In CRM</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Pipeline</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.opportunitiesData?.total || 0}</p>
                <p className="text-xs text-gray-500 capitalize">{topActivityTypes[0]?.[0] || 'opportunities'}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                {analytics.revenueMetrics?.disabled ? (
                  <div className="text-xs text-amber-600 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                    Revenue data disabled - manually entered values may be inaccurate
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">${(analytics.revenueMetrics?.totalRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{analytics.revenueMetrics?.winRate || 0}% win rate</p>
                  </>
                )}
              </div>
              <DollarSign className={`h-8 w-8 ${analytics.revenueMetrics?.disabled ? 'text-gray-400' : 'text-emerald-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Types Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Activity Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(activityCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {type === 'contact' && <Users className="h-4 w-4 text-green-600" />}
                  {type === 'opportunity' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                  {type === 'pipeline' && <GitBranch className="h-4 w-4 text-indigo-600" />}
                  {type === 'communication' && <MessageSquare className="h-4 w-4 text-purple-600" />}
                  {type === 'form' && <FileText className="h-4 w-4 text-orange-600" />}
                  {type === 'survey' && <FileCheck className="h-4 w-4 text-cyan-600" />}
                  {type === 'funnel' && <Target className="h-4 w-4 text-pink-600" />}
                  {type === 'workflow' && <Zap className="h-4 w-4 text-yellow-600" />}
                  {type === 'system' && <DollarSign className="h-4 w-4 text-emerald-600" />}
                  <span className="text-sm capitalize">{type}</span>
                </div>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activityFeed.length > 0 ? (
                activityFeed.slice(0, 10).map((activity) => {
                  const IconComponent = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <IconComponent className={`h-4 w-4 mt-0.5 ${activity.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-600">{activity.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No recent changes detected</p>
                  <p className="text-xs mt-1">Activity will appear here when any changes happen in GoHighLevel:</p>
                  <ul className="text-xs mt-2 space-y-1 text-gray-400">
                    <li>• New contacts, opportunities, or conversations</li>
                    <li>• Forms, surveys, funnels, or workflows added/updated</li>
                    <li>• Pipeline stage changes or revenue updates</li>
                  </ul>
                  <p className="text-xs mt-2 text-blue-600">💡 Refresh the page after making changes to see them tracked</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      {activityFeed.length > 0 && (
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Complete Activity Timeline (Last 7 Days)
          </CardTitle>
          <CardDescription>
            Every single change, addition, and update in your GoHighLevel account
          </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activityFeed.map((activity, index) => {
                const IconComponent = activity.icon;
                const isToday = new Date(activity.timestamp).toDateString() === new Date().toDateString();
                const isYesterday = new Date(activity.timestamp).toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

                return (
                  <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-b-0">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-blue-100' :
                      isYesterday ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <IconComponent className={`h-5 w-5 ${
                        isToday ? 'text-blue-600' :
                        isYesterday ? 'text-orange-600' : activity.color
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isToday ? 'bg-blue-100 text-blue-800' :
                          isYesterday ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isToday ? 'Today' : isYesterday ? 'Yesterday' : new Date(activity.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{activity.description}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LocationAnalyticsPage() {
  console.log('🚀 COMPONENT: LocationAnalyticsPage rendering')

  const params = useParams()
  const router = useRouter()

  console.log('📋 COMPONENT: params received:', params)
  console.log('📋 COMPONENT: params type:', typeof params)
  console.log('📋 COMPONENT: params.id type:', params?.id ? typeof params.id : 'null/undefined')

  // Helper functions for calculating totals
  const getTotalFormSubmissions = () => {
    return analytics?.formsSubmissions?.submissions?.length || 0;
  };

  const getTotalSurveyResponses = () => {
    return analytics?.surveysSubmissions?.submissions?.length || 0;
  };

  // Save monthly metrics to database for growth calculations
  const saveMonthlyMetrics = async (locationId: string, currentAnalytics: any) => {
    try {
      const response = await fetch('/api/monthly-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          analytics: currentAnalytics
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Error saving monthly metrics:', data.error)
      } else {
        console.log('✅ Monthly metrics saved for', locationId)
      }
    } catch (error) {
      console.error('❌ Error in saveMonthlyMetrics:', error)
    }
  }


  // Geographic analysis from submission IPs
  const analyzeGeographicPerformance = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    const geoStats: Record<string, { count: number, quality: number }> = {};

    submissions.forEach(submission => {
      // Extract state from form data (assuming US addresses)
      const state = submission.others?.state || submission.others?.State ||
                   submission.others?.shipping_state || submission.others?.billing_state;

      if (state) {
        if (!geoStats[state]) {
          geoStats[state] = { count: 0, quality: 0 };
        }
        geoStats[state].count++;
        // Basic quality score based on field completion
        const fieldCount = Object.keys(submission.others || {}).length;
        geoStats[state].quality += fieldCount > 5 ? 3 : fieldCount > 3 ? 2 : 1;
      }
    });

    return Object.entries(geoStats)
      .map(([state, data]) => ({
        state,
        submissions: data.count,
        avgQuality: Math.round(data.quality / data.count)
      }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 5); // Top 5 states
  };

  // Spam detection algorithms
  const detectSpamSubmissions = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    let spamCount = 0;
    let suspiciousCount = 0;

    submissions.forEach(submission => {
      const email = submission.others?.email || '';
      const phone = submission.others?.phone || '';
      const name = submission.name || submission.others?.first_name + ' ' + submission.others?.last_name || '';

      // Spam detection rules
      const isSpam = (
        // Common spam patterns
        email.includes('test@') ||
        email.includes('@example.com') ||
        email.includes('@test.com') ||
        name.toLowerCase().includes('test') ||
        phone === '1234567890' ||
        phone === '0000000000' ||
        // Suspicious patterns
        email.match(/\d{8,}@/) || // Long number before @
        name.match(/^[a-zA-Z]$/) // Single character name
      );

      if (isSpam) {
        spamCount++;
      } else if (
        // Suspicious but not definitive spam
        !email.includes('@') ||
        phone.length < 10 ||
        name.length < 2
      ) {
        suspiciousCount++;
      }
    });

    return {
      total: submissions.length,
      spam: spamCount,
      suspicious: suspiciousCount,
      clean: submissions.length - spamCount - suspiciousCount,
      spamRate: submissions.length > 0 ? Math.round((spamCount / submissions.length) * 100) : 0
    };
  };

  // Duplicate detection
  const detectDuplicateSubmissions = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const duplicates: any[] = [];

    submissions.forEach(submission => {
      const email = (submission.others?.email || '').toLowerCase().trim();
      const phone = (submission.others?.phone || '').replace(/\D/g, '');

      const isDuplicate = (
        (email && seenEmails.has(email)) ||
        (phone && phone.length >= 10 && seenPhones.has(phone))
      );

      if (isDuplicate) {
        duplicates.push(submission);
      }

      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
    });

    return {
      total: submissions.length,
      duplicates: duplicates.length,
      unique: submissions.length - duplicates.length,
      duplicateRate: submissions.length > 0 ? Math.round((duplicates.length / submissions.length) * 100) : 0
    };
  };

  // Mobile vs Desktop analysis
  const analyzeDevicePerformance = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    const deviceStats = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };

    submissions.forEach(submission => {
      // Check user agent or device info in submission data
      const userAgent = submission.others?.user_agent || submission.others?.UserAgent || '';
      const device = submission.others?.device || submission.others?.Device || '';

      if (userAgent.toLowerCase().includes('mobile') ||
          device.toLowerCase().includes('mobile') ||
          userAgent.includes('Android') ||
          userAgent.includes('iPhone')) {
        deviceStats.mobile++;
      } else if (userAgent.toLowerCase().includes('tablet') ||
                 device.toLowerCase().includes('tablet') ||
                 userAgent.includes('iPad')) {
        deviceStats.tablet++;
      } else if (userAgent.includes('Windows') ||
                 userAgent.includes('Macintosh') ||
                 userAgent.includes('Linux') ||
                 device.toLowerCase().includes('desktop')) {
        deviceStats.desktop++;
      } else {
        deviceStats.unknown++;
      }
    });

    const total = submissions.length;
    return {
      mobile: { count: deviceStats.mobile, percentage: total > 0 ? Math.round((deviceStats.mobile / total) * 100) : 0 },
      desktop: { count: deviceStats.desktop, percentage: total > 0 ? Math.round((deviceStats.desktop / total) * 100) : 0 },
      tablet: { count: deviceStats.tablet, percentage: total > 0 ? Math.round((deviceStats.tablet / total) * 100) : 0 },
      unknown: { count: deviceStats.unknown, percentage: total > 0 ? Math.round((deviceStats.unknown / total) * 100) : 0 }
    };
  };

  // Peak usage time analysis
  const analyzePeakUsageTimes = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    const hourlyStats: Record<number, number> = {};

    submissions.forEach(submission => {
      if (submission.createdAt) {
        const date = new Date(submission.createdAt);
        const hour = date.getHours();
        hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
      }
    });

    // Find peak hours
    const sortedHours = Object.entries(hourlyStats)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    return {
      peakHour: sortedHours[0]?.hour || 0,
      peakCount: sortedHours[0]?.count || 0,
      hourlyBreakdown: hourlyStats
    };
  };

  // Proxy analytics for advanced form performance (using existing data patterns)
  const analyzeFormLoadPerformance = () => {
    const submissions = analytics?.formsSubmissions?.submissions || [];
    if (submissions.length < 5) return { score: 0, rating: 'Insufficient Data', insights: [] };

    // Analyze submission velocity as proxy for load performance
    const sortedSubmissions = submissions
      .filter(s => s.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let totalIntervals = 0;
    let intervalCount = 0;

    // Calculate average time between submissions (proxy for load speed)
    for (let i = 1; i < sortedSubmissions.length; i++) {
      const timeDiff = new Date(sortedSubmissions[i].createdAt).getTime() -
                      new Date(sortedSubmissions[i-1].createdAt).getTime();
      if (timeDiff > 0 && timeDiff < 300000) { // Only count intervals under 5 minutes
        totalIntervals += timeDiff;
        intervalCount++;
      }
    }

    const avgInterval = intervalCount > 0 ? totalIntervals / intervalCount : 0;
    // Faster submissions = better performance (lower intervals)
    const performanceScore = avgInterval > 0 ? Math.max(0, Math.min(100, 100 - (avgInterval / 1000))) : 50;

    let rating = 'Poor';
    if (performanceScore >= 80) rating = 'Excellent';
    else if (performanceScore >= 60) rating = 'Good';
    else if (performanceScore >= 40) rating = 'Fair';

    return {
      score: Math.round(performanceScore),
      rating,
      avgInterval: Math.round(avgInterval / 1000), // seconds
      insights: [
        avgInterval < 2000 ? 'Fast submission patterns detected' : 'Slow submission intervals may indicate performance issues',
        submissions.length > 50 ? 'High volume suggests good form accessibility' : 'Low volume may indicate visibility issues'
      ]
    };
  };

  // Proxy for abandonment rates using engagement patterns
  const calculateAbandonmentRisk = () => {
    const forms = analytics?.formsData?.forms || [];
    const submissions = analytics?.formsSubmissions?.submissions || [];
    const contacts = analytics?.contacts || 1;

    if (forms.length === 0) return { risk: 'low', score: 0, factors: [] };

    const avgSubmissionsPerForm = submissions.length / forms.length;
    const overallConversionRate = (submissions.length / contacts) * 100;
    const spamRate = detectSpamSubmissions().spamRate;
    const duplicateRate = detectDuplicateSubmissions().duplicateRate;

    // Calculate risk factors
    let riskScore = 0;
    const factors = [];

    if (avgSubmissionsPerForm < 2) {
      riskScore += 30;
      factors.push('Low submissions per form');
    }
    if (overallConversionRate < 2) {
      riskScore += 25;
      factors.push('Very low conversion rate');
    }
    if (spamRate > 20) {
      riskScore += 20;
      factors.push('High spam rate indicates poor targeting');
    }
    if (duplicateRate > 10) {
      riskScore += 15;
      factors.push('High duplicate submissions');
    }

    let risk = 'low';
    if (riskScore >= 60) risk = 'high';
    else if (riskScore >= 30) risk = 'medium';

    return {
      risk,
      score: Math.min(riskScore, 100),
      factors,
      recommendations: risk === 'high' ?
        ['Review form targeting', 'Simplify form design', 'Check for technical issues'] :
        risk === 'medium' ?
        ['Monitor conversion rates', 'Consider A/B testing'] :
        ['Forms performing well']
    };
  };

  // Proxy for multi-step analytics using form complexity
  const analyzeFormComplexity = () => {
    const forms = analytics?.formsData?.forms || [];
    const submissions = analytics?.formsSubmissions?.submissions || [];

    if (forms.length === 0) return { complexity: 'simple', score: 0, insights: [] };

    // Analyze form complexity based on available data
    const formAnalysis = forms.map(form => {
      const formSubmissions = submissions.filter(s => s.formId === form.id);
      const avgFieldCount = formSubmissions.length > 0 ?
        formSubmissions.reduce((sum, s) => sum + Object.keys(s.others || {}).length, 0) / formSubmissions.length : 0;

      return {
        formId: form.id,
        name: form.name,
        submissionCount: formSubmissions.length,
        avgFields: Math.round(avgFieldCount),
        complexity: avgFieldCount > 8 ? 'complex' : avgFieldCount > 4 ? 'medium' : 'simple'
      };
    });

    const avgComplexity = formAnalysis.reduce((sum, f) => sum + f.avgFields, 0) / formAnalysis.length;
    const complexityScore = Math.min(100, avgComplexity * 10);

    return {
      overallComplexity: avgComplexity > 6 ? 'High' : avgComplexity > 3 ? 'Medium' : 'Low',
      score: Math.round(complexityScore),
      forms: formAnalysis,
      insights: [
        `Average of ${avgComplexity.toFixed(1)} fields per form`,
        complexityScore > 70 ? 'Complex forms may need simplification' : 'Form complexity appears optimal',
        formAnalysis.filter(f => f.complexity === 'complex').length > 0 ?
          `${formAnalysis.filter(f => f.complexity === 'complex').length} forms may benefit from multi-step design` : 'Most forms are appropriately sized'
      ]
    };
  };

  // Real-time performance monitoring (Forms + Surveys)
  const monitorRealTimePerformance = () => {
    const formSubmissions = analytics?.formsSubmissions?.submissions || [];
    const surveySubmissions = analytics?.surveysSubmissions?.submissions || [];
    const allSubmissions = [...formSubmissions, ...surveySubmissions];

    const now = new Date();
    const last24Hours = allSubmissions.filter(s =>
      s.createdAt && (now.getTime() - new Date(s.createdAt).getTime()) < 24 * 60 * 60 * 1000
    );
    const lastHour = allSubmissions.filter(s =>
      s.createdAt && (now.getTime() - new Date(s.createdAt).getTime()) < 60 * 60 * 1000
    );

    const hourlyRate = lastHour.length;
    const dailyRate = last24Hours.length / 24; // per hour average

    // Performance indicators
    const spamRate = detectSpamSubmissions().spamRate;
    const duplicateRate = detectDuplicateSubmissions().duplicateRate;
    const errorRate = allSubmissions.length > 0 ? (allSubmissions.filter(s => !s.createdAt || !('email' in s) || !s.email).length / allSubmissions.length * 100) : 0;

    // Debug logging
    console.log('📊 Health Score Debug:', {
      totalSubmissions: allSubmissions.length,
      last24Hours: last24Hours.length,
      lastHour: lastHour.length,
      spamRate,
      duplicateRate,
      errorRate
    });

    // Overall health score (more lenient penalties)
    let healthScore = 100;
    healthScore -= spamRate * 0.3; // Reduced spam penalty
    healthScore -= duplicateRate * 0.2; // Reduced duplicate penalty
    healthScore -= errorRate * 1; // Reduced error penalty
    healthScore -= allSubmissions.length === 0 ? 20 : 0; // Penalty for no recent activity

    // Bonus for high activity
    if (hourlyRate > 5) healthScore += 10;
    if (last24Hours.length > 20) healthScore += 5;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      currentHourlyRate: hourlyRate,
      dailyAverageRate: Math.round(dailyRate * 10) / 10,
      healthScore: Math.round(healthScore),
      status: healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Poor',
      alerts: [
        hourlyRate === 0 ? 'No submissions in last hour' : null,
        spamRate > 15 ? `High spam rate: ${spamRate}%` : null,
        duplicateRate > 10 ? `High duplicate rate: ${duplicateRate}%` : null,
        errorRate > 5 ? `Data quality issues: ${errorRate.toFixed(1)}%` : null
      ].filter(Boolean)
    };
  };

  // Stage conversion rates - calculates conversion between consecutive stages
  const calculateStageConversionRates = () => {
    if (!analytics?.pipelineAnalysis?.stages || analytics.pipelineAnalysis.stages.length < 2) {
      return [];
    }

    const stages = analytics.pipelineAnalysis.stages;
    const conversionRates = [];

    for (let i = 0; i < stages.length - 1; i++) {
      const currentStage = stages[i];
      const nextStage = stages[i + 1];

      const conversionRate = (nextStage.count / Math.max(1, currentStage.count)) * 100;
      const dropOffRate = ((currentStage.count - nextStage.count) / Math.max(1, currentStage.count)) * 100;

      conversionRates.push({
        fromStage: currentStage.stage,
        toStage: nextStage.stage,
        conversionRate: Math.round(conversionRate * 100) / 100, // Round to 2 decimal places
        dropOffRate: Math.round(dropOffRate * 100) / 100,
        opportunitiesIn: currentStage.count,
        opportunitiesOut: nextStage.count,
        valueAtRisk: currentStage.value - nextStage.value
      });
    }

    return conversionRates;
  };

  // Deal size distribution - categorizes opportunities by value ranges
  const calculateDealSizeDistribution = () => {
    if (!analytics?.pipelineAnalysis?.stages) {
      return {
        small: { count: 0, value: 0, percentage: 0 },
        medium: { count: 0, value: 0, percentage: 0 },
        large: { count: 0, value: 0, percentage: 0 },
        enterprise: { count: 0, value: 0, percentage: 0 }
      };
    }

    const stages = analytics.pipelineAnalysis.stages;
    let totalOpportunities = 0;
    let totalValue = 0;

    const distribution = {
      small: { count: 0, value: 0, percentage: 0 },      // <$5K
      medium: { count: 0, value: 0, percentage: 0 },     // $5K-$25K
      large: { count: 0, value: 0, percentage: 0 },      // $25K-$100K
      enterprise: { count: 0, value: 0, percentage: 0 }  // >$100K
    };

    stages.forEach(stage => {
      totalOpportunities += stage.count;
      totalValue += stage.value;

      // Categorize by average deal value in this stage
      const avgValue = stage.avgValue || 0;

      if (avgValue < 5000) {
        distribution.small.count += stage.count;
        distribution.small.value += stage.value;
      } else if (avgValue < 25000) {
        distribution.medium.count += stage.count;
        distribution.medium.value += stage.value;
      } else if (avgValue < 100000) {
        distribution.large.count += stage.count;
        distribution.large.value += stage.value;
      } else {
        distribution.enterprise.count += stage.count;
        distribution.enterprise.value += stage.value;
      }
    });

    // Calculate percentages
    if (totalOpportunities > 0) {
      distribution.small.percentage = Math.round((distribution.small.count / totalOpportunities) * 100);
      distribution.medium.percentage = Math.round((distribution.medium.count / totalOpportunities) * 100);
      distribution.large.percentage = Math.round((distribution.large.count / totalOpportunities) * 100);
      distribution.enterprise.percentage = Math.round((distribution.enterprise.count / totalOpportunities) * 100);
    }

    return distribution;
  };

  // Stage bottleneck detection - analyzes pipeline stages for performance issues
  const detectStageBottlenecks = () => {

    if (!analytics?.pipelineAnalysis?.stages || analytics.pipelineAnalysis.stages.length === 0) {
      return {
        bottlenecks: [],
        slowestStage: null,
        averageCycleTime: 0,
        hasBottlenecks: false
      };
    }

    const stages = analytics.pipelineAnalysis.stages;
    const avgCycleTime = stages.reduce((sum, stage) => sum + (stage.avgDaysInStage || 0), 0) / stages.length;

    // Identify bottlenecks: stages that take significantly longer than average
    const bottlenecks = stages
      .filter(stage => (stage.avgDaysInStage || 0) > avgCycleTime * 1.5) // 50% slower than average
      .map(stage => ({
        stage: stage.stage,
        daysStuck: stage.avgDaysInStage || 0,
        opportunitiesAffected: stage.count,
        valueAtRisk: stage.value,
        severity: (stage.avgDaysInStage || 0) > avgCycleTime * 2 ? 'critical' : 'warning'
      }))
      .sort((a, b) => b.daysStuck - a.daysStuck);

    // Find the absolute slowest stage
    const slowestStage = stages.reduce((slowest, stage) =>
      (stage.avgDaysInStage || 0) > (slowest.avgDaysInStage || 0) ? stage : slowest
    );

    return {
      bottlenecks,
      slowestStage: (slowestStage.avgDaysInStage || 0) > avgCycleTime * 1.2 ? slowestStage : null,
      averageCycleTime: Math.round(avgCycleTime),
      hasBottlenecks: bottlenecks.length > 0
    };
  };

  // Smart stage matching for pipeline opportunity counts
  const getStageOpportunityCount = (pipelineStageName: string) => {
    if (!analytics?.pipelineAnalysis?.stages) return 0;

    // Normalize pipeline stage name
    const normalized = pipelineStageName.toLowerCase();

    // Try multiple matching strategies
    const possibleMatches: string[] = [
      normalized,  // exact match
      normalized.replace(/\s+/g, ''),  // remove spaces
      normalized.split(' ')[0],  // first word only
    ];

    // Add conditional matches
    if (normalized.includes('lead') || normalized.includes('contact') || normalized.includes('initial')) {
      possibleMatches.push('lead');
    }
    if (normalized.includes('qualif') || normalized.includes('qual')) {
      possibleMatches.push('qualified');
    }
    if (normalized.includes('propos') || normalized.includes('prop')) {
      possibleMatches.push('proposal');
    }
    if (normalized.includes('negoti') || normalized.includes('neg')) {
      possibleMatches.push('negotiation');
    }
    if (normalized.includes('close') || normalized.includes('won')) {
      possibleMatches.push('closed');
    }
    if (normalized.includes('lost') || normalized.includes('disqual')) {
      possibleMatches.push('lost');
    }

    // Try each possible match
    for (const match of possibleMatches) {
      const stages = analytics.pipelineAnalysis.stages as any; // Type assertion for runtime compatibility
      const stageData = stages[match];
      if (stageData?.count) {
        return stageData.count;
      }
    }

    return 0;
  };
  const { user } = useUser()
  // Handle async params (Next.js 13+ app router)
  const locationId = params?.id as string

  console.log('🔍 COMPONENT: ===== COMPONENT MOUNTED =====')
  console.log('🔍 COMPONENT: Loading location with ID:', locationId)
  console.log('🔍 COMPONENT: Raw params.id:', params?.id)
  console.log('🔍 COMPONENT: Decoded locationId:', locationId ? decodeURIComponent(locationId) : 'undefined')
  console.log('🔍 COMPONENT: Params object:', params)

  const [location, setLocation] = useState<GHLLocation | null>(null)
  const [analytics, setAnalytics] = useState<LocationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastManualRefresh, setLastManualRefresh] = useState<number>(0)
  const [showWebsiteManager, setShowWebsiteManager] = useState(false)
  const [showAddWebsite, setShowAddWebsite] = useState(false)
  const [newWebsiteId, setNewWebsiteId] = useState('')
  const [selectedTrafficItem, setSelectedTrafficItem] = useState<{type: 'website' | 'funnel', data: any} | null>(null)
  const [loadingTrafficDetails, setLoadingTrafficDetails] = useState(false)
  const [availableLocations, setAvailableLocations] = useState<any[]>([])
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set())
  
  // Per-funnel analytics state
  const [funnelAnalytics, setFunnelAnalytics] = useState<Record<string, any>>({})
  const [loadingFunnelAnalytics, setLoadingFunnelAnalytics] = useState<Record<string, boolean>>({})
  const [funnelAnalyticsError, setFunnelAnalyticsError] = useState<Record<string, string>>({})

  // Analytics auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pipeline activity filters
  const [pipelineTimeFilter, setPipelineTimeFilter] = useState('7') // 7, 30, 90, all
  const [pipelineFilter, setPipelineFilter] = useState('all') // all, active, high-stage, low-stage
  const [activityFilter, setActivityFilter] = useState('all') // all, new-opportunities, stage-changes, high-activity

  // Social analytics filters (separate from pipeline)
  const [socialTimeFilter, setSocialTimeFilter] = useState('7') // 7, 30, 90, all

  // Pipeline expansion loading state
  const [loadingPipelineDetails, setLoadingPipelineDetails] = useState<Record<string, boolean>>({})

  // Toggle pipeline expansion
  const togglePipeline = async (pipelineId: string) => {
    setLoadingPipelineDetails(prev => ({ ...prev, [pipelineId]: true }))
    try {
      const newExpanded = new Set(expandedPipelines)
      if (newExpanded.has(pipelineId)) {
        newExpanded.delete(pipelineId)
      } else {
        newExpanded.add(pipelineId)
      }
      setExpandedPipelines(newExpanded)
    } finally {
      setLoadingPipelineDetails(prev => ({ ...prev, [pipelineId]: false }))
    }
  }

  // Survey responses modal state
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null)
  const [showLocationDetails, setShowLocationDetails] = useState(false)
  const [surveyResponses, setSurveyResponses] = useState<any[]>([])
  const [responsesPage, setResponsesPage] = useState(1)
  const [responsesPerPage] = useState(10)
  const [responsesLoading, setResponsesLoading] = useState(false)
  const [apiProgress, setApiProgress] = useState({ completed: 0, total: 0, currentEndpoint: '' })

  // Form submissions modal state
  const [selectedForm, setSelectedForm] = useState<any>(null)
  const [formSubmissions, setFormSubmissions] = useState<any[]>([])
  const [submissionsPage, setSubmissionsPage] = useState(1)
  const [submissionsPerPage] = useState(10)
  const [loadingFormDetails, setLoadingFormDetails] = useState(false)
  const [loadingSurveyDetails, setLoadingSurveyDetails] = useState(false)

  // Funnel modal state
  const [selectedFunnel, setSelectedFunnel] = useState<any>(null)
  const [loadingFunnelDetails, setLoadingFunnelDetails] = useState(false)

  // Growth calculation state
  const [contactsGrowth, setContactsGrowth] = useState(0)

  // Copy feedback state
  const [copySuccess, setCopySuccess] = useState<string | null>(null)



  // Helper functions to transform API data
  const transformFormsData = (formsResponse: any) => {
    return formsResponse ? {
      forms: formsResponse.forms || [],
      totalForms: formsResponse.totalForms || 0
    } : { forms: [], totalForms: 0 };
  };

  // Calculate true month-over-month growth percentage
  const calculateContactsGrowth = useCallback(async () => {
    try {
      const response = await fetch(`/api/contact-growth?locationId=${encodeURIComponent(locationId)}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Error fetching contact growth:', data.error)
        // Fallback to engagement-based calculation
        const totalContacts = analytics?.contacts || 0;
        const conversations = analytics?.conversations || 0;
        const opportunities = analytics?.pipelineAnalysis?.totalOpportunities || 0;

        if (totalContacts === 0) return 0;

        const engagementRate = ((conversations + opportunities) / Math.max(totalContacts, 1)) * 100;
        return Math.min(Math.round(engagementRate * 0.3), 50);
      }

      return data.growth || 0

    } catch (error) {
      console.error('❌ Error calculating contacts growth:', error)
      // Fallback to engagement-based calculation
      const totalContacts = analytics?.contacts || 0;
      const conversations = analytics?.conversations || 0;
      const opportunities = analytics?.pipelineAnalysis?.totalOpportunities || 0;

      if (totalContacts === 0) return 0;

      const engagementRate = ((conversations + opportunities) / Math.max(totalContacts, 1)) * 100;
      return Math.min(Math.round(engagementRate * 0.3), 50);
    }
  }, [analytics, locationId]);

  // Generate unique siteId from funnel/website data
  const generateFunnelSiteId = (funnel: any): string => {
    try {
      // Use funnel.id as primary identifier (most reliable)
      if (funnel.id) {
        return `funnel-${funnel.id}`;
      }
      // Fallback to normalized name
      if (funnel.name) {
        return funnel.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      // Last resort: use URL if available
      if (funnel.url) {
        try {
          const url = new URL(funnel.url);
          return url.hostname.replace(/^www\./, '').replace(/\./g, '-');
        } catch {
          return `site-${Date.now()}`;
        }
      }
      return `site-${Date.now()}`;
    } catch (error) {
      console.error('Error generating funnel siteId:', error);
      return `site-${Date.now()}`;
    }
  };

  // Generate analytics script for a website/funnel
  const generateWebsiteScript = (siteId: string, locationId: string) => {
    return `<script src="${window.location.origin}/api/analytics/script?siteId=${siteId}&locationId=${locationId}"></script>`;
  };

  // Refresh analytics for a specific cacheKey (used by auto-refresh)
  const refreshFunnelAnalytics = useCallback(async (cacheKey: string) => {
    if (!location?.id) {
      console.error('🔴 refreshFunnelAnalytics: Missing location');
      return null;
    }

    // Extract funnel identifier from cacheKey using ::: separator
    const separatorIndex = cacheKey.indexOf(':::');
    if (separatorIndex === -1) {
      console.error('🔴 refreshFunnelAnalytics: Invalid cacheKey format:', cacheKey);
      return null;
    }

    const funnelIdentifier = cacheKey.substring(0, separatorIndex);
    const siteId = cacheKey.substring(separatorIndex + 3); // Skip the :::

    // Check if already loading
    if (loadingFunnelAnalytics[cacheKey]) {
      console.log('⏳ refreshFunnelAnalytics: Already loading for', cacheKey);
      return null;
    }

    setLoadingFunnelAnalytics(prev => ({ ...prev, [cacheKey]: true }));

    try {
      console.log('🔄 refreshFunnelAnalytics: Fetching data for', cacheKey);

      const response = await fetch(`/api/analytics?siteId=${encodeURIComponent(siteId)}&days=30`);

      if (!response.ok) {
        throw new Error(`Analytics API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ refreshFunnelAnalytics: Received data for', cacheKey, {
        pageViews: data.pageViews || 0,
        uniqueVisitors: data.uniqueVisitors || 0,
        sessions: data.sessions || 0
      });

      const analyticsData = {
        ...data,
        siteId,
        funnelId: funnelIdentifier,
        funnelName: funnelIdentifier,
        lastFetched: Date.now()
      };

      setFunnelAnalytics(prev => ({ ...prev, [cacheKey]: analyticsData }));
      setFunnelAnalyticsError(prev => {
        const newState = { ...prev };
        delete newState[cacheKey];
        return newState;
      });

      return analyticsData;
    } catch (error) {
      console.error('❌ refreshFunnelAnalytics: Failed for', cacheKey, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setFunnelAnalyticsError(prev => ({ ...prev, [cacheKey]: errorMessage }));
      return null;
    } finally {
      setLoadingFunnelAnalytics(prev => {
        const newState = { ...prev };
        delete newState[cacheKey];
        return newState;
      });
    }
  }, [location?.id, loadingFunnelAnalytics]);

  // Fetch analytics for a specific funnel/website
  const fetchFunnelAnalytics = useCallback(async (funnel: any) => {
    if (!funnel || !location?.id) {
      console.error('🔴 fetchFunnelAnalytics: Missing funnel or location');
      return null;
    }

    const siteId = generateFunnelSiteId(funnel);
    const cacheKey = `${funnel.id || funnel.name}:::${siteId}`;

    // Check if already loading
    if (loadingFunnelAnalytics[cacheKey]) {
      console.log('⏳ fetchFunnelAnalytics: Already loading for', cacheKey);
      return null;
    }

    // Check cache first
    if (funnelAnalytics[cacheKey]) {
      console.log('✅ fetchFunnelAnalytics: Using cached data for', cacheKey);
      return funnelAnalytics[cacheKey];
    }

    try {
      console.log('📊 fetchFunnelAnalytics: Fetching analytics for', {
        funnelName: funnel.name,
        funnelId: funnel.id,
        siteId,
        locationId: location.id
      });

      setLoadingFunnelAnalytics(prev => ({ ...prev, [cacheKey]: true }));
      setFunnelAnalyticsError(prev => {
        const newState = { ...prev };
        delete newState[cacheKey];
        return newState;
      });

      const response = await fetch(`/api/analytics?siteId=${encodeURIComponent(siteId)}&days=30`);
      
      if (!response.ok) {
        throw new Error(`Analytics API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ fetchFunnelAnalytics: Received data for', cacheKey, {
        pageViews: data.pageViews || 0,
        uniqueVisitors: data.uniqueVisitors || 0,
        sessions: data.sessions || 0
      });

      const analyticsData = {
        ...data,
        siteId,
        funnelId: funnel.id,
        funnelName: funnel.name,
        lastFetched: Date.now()
      };

      setFunnelAnalytics(prev => ({ ...prev, [cacheKey]: analyticsData }));
      setLoadingFunnelAnalytics(prev => {
        const newState = { ...prev };
        delete newState[cacheKey];
        return newState;
      });

      return analyticsData;
    } catch (error) {
      console.error('❌ fetchFunnelAnalytics: Error fetching analytics for', cacheKey, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setFunnelAnalyticsError(prev => ({ ...prev, [cacheKey]: errorMessage }));
      setLoadingFunnelAnalytics(prev => {
        const newState = { ...prev };
        delete newState[cacheKey];
        return newState;
      });
      return null;
    }
  }, [location?.id, funnelAnalytics, loadingFunnelAnalytics]);



  // Toggle auto-refresh
  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => {
      const newState = !prev;
      console.log(`🔄 Auto-refresh ${newState ? 'enabled' : 'disabled'}`);
      return newState;
    });
  }, []);

  // Copy text to clipboard
  const copyToClipboard = async (text: string, description?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(description || 'Script copied to clipboard!');
      setTimeout(() => setCopySuccess(null), 3000);
      console.log('Script copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(description || 'Script copied to clipboard!');
        setTimeout(() => setCopySuccess(null), 3000);
        console.log('Script copied to clipboard (fallback):', text);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        setCopySuccess('Failed to copy script');
        setTimeout(() => setCopySuccess(null), 3000);
      }
      document.body.removeChild(textArea);
    }
  };

  const transformSurveysData = (surveysResponse: any) => {
    return surveysResponse ? {
      surveys: surveysResponse.surveys || [],
      totalSurveys: surveysResponse.totalSurveys || 0
    } : { surveys: [], totalSurveys: 0 };
  };

  // Fetch data with caching optimization
  useEffect(() => {
    console.log('🔄 INDIVIDUAL LOCATION useEffect triggered for locationId:', locationId, 'exists:', !!locationId)
    console.log('🔄 Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR')
    console.log('🔄 Analytics state before load:', analytics ? 'EXISTS' : 'NULL')

    // Guard: Make sure we have a locationId before proceeding
    if (!locationId) {
      console.log('⚠️ No locationId available yet, skipping location load')
      return
    }

    // Create AbortController for cancelling API calls when component unmounts
    const abortController = new AbortController()
    const signal = abortController.signal

    const loadLocationData = async () => {
      try {
        // 🔒 SECURITY FIX: Clear old analytics data immediately when changing locations
        // This prevents cross-location data leakage where Location A sees Location B's data
        setAnalytics(null)

        // Get location details from unified system via API (works in browser)
        console.log('🔄 Fetching locations from API...')
        const locationsResponse = await fetch('/api/ghl/locations?internal=true')
        const locationsData = await locationsResponse.json()
        const allLocations = locationsData.locations || []
        console.log('📦 Locations loaded from API:', allLocations.length, 'locations')
        console.log('📦 First location ID:', allLocations[0]?.id)
        console.log('🔐 Internal API access - pitTokens included:', !!allLocations[0]?.pitToken)

        console.log('📋 All available locations from unified system:', allLocations.length)
        console.log('🔍 Searching for location ID:', locationId)
        console.log('🔍 Location ID type:', typeof locationId)
        console.log('🔍 Location ID length:', locationId.length)

        // Debug: show first few location IDs
        console.log('🔍 First few API location IDs:', allLocations.slice(0, 3).map((l: GHLLocation) => l.id))

        // Simple direct lookup first
        console.log('🔍 Attempting direct lookup for:', locationId)
        let currentLocation = allLocations.find((loc: any) => loc.id === locationId)
        console.log('🔍 Direct API locations lookup result:', !!currentLocation, currentLocation?.name || 'undefined')

        // If location found, try to get fresh token from database
        if (currentLocation) {
          try {
            console.log('🔄 Checking for fresh token in database for location:', locationId)
            const tokenResponse = await fetch(`/api/ghl/data?endpoint=get-location-token&locationId=${locationId}`, {
              signal,
              headers: { 'Content-Type': 'application/json' }
            })
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json()
              if (tokenData.pitToken) {
                console.log('✅ Found fresh token in database, using it instead of config')
                currentLocation = { ...currentLocation, pitToken: tokenData.pitToken }
              } else {
                console.log('⚠️ Token response OK but no pitToken found, using config token')
              }
            } else {
              console.log('⚠️ Token response not OK, using config token:', tokenResponse.status)
            }
          } catch (tokenError) {
            console.log('⚠️ Could not get fresh token from database, using config token:', tokenError)
          }
        }

        if (!currentLocation) {
          console.error('🚨 Location not found!')
          console.log('🔍 Searched for ID:', locationId)
          console.log('📋 Available location IDs:', allLocations.map((l: GHLLocation) => l.id))
          console.log('📋 Available locations:', allLocations.map((l: GHLLocation) => `${l.name} (${l.id})`))
          setAvailableLocations(allLocations)
          setLoading(false)
          return
        }

        console.log('✅ Found location:', currentLocation.name, 'for ID:', currentLocation.id)

        setLocation({
          id: currentLocation.id,
          name: currentLocation.name,
          city: currentLocation.city,
          state: currentLocation.state,
          country: currentLocation.country,
          address: currentLocation.address,
          pitToken: currentLocation.pitToken
        })

        // Always fetch real-time data directly from GHL APIs (no database cache for individual locations)
        console.log('🔄 Fetching real-time data directly from GHL APIs (no cache)...')

        // Core metrics + selective API calls for real-time data
        console.log('🔄 Making API calls for real-time metrics and complex data...')
        const criticalEndpoints = [
          // Core real-time metrics (always fresh) - MOST IMPORTANT
          'contacts-count',
          'opportunities-count',
          'conversations-count',
          // Essential data endpoints for ALL UI functionality
          'locations', // Location details from GHL API
          'pipeline-analysis', // Critical for opportunity analysis
          'forms', // Basic forms data
          'surveys', // Basic surveys data
          'surveys-submissions', // Survey responses (with security fix)
          // ALL endpoints that UI actually needs - USER DOESN'T CARE ABOUT RATE LIMITING
          'forms-submissions', // Forms tab submissions
          'funnels', // Funnel data in pipeline
          'pipeline-opportunity-counts', // Pipeline opportunity counts
          'pipeline-activity-details', // Pipeline activity details
          'lead-sources', // Leads tab
          'pipelines', // Pipeline tab
          'revenue-metrics', // Revenue tab
          'workflows', // Workflows functionality
          'social-analytics', // Social tab
          'website-analytics', // Website analytics
          'activity-metrics' // Activity metrics
        ]

        // Initialize progress tracking
        setApiProgress({ completed: 0, total: criticalEndpoints.length, currentEndpoint: 'Initializing...' })

        // Sequential API calls with delays to avoid rate limiting
        const results = []
        for (const endpoint of criticalEndpoints) {
          try {
            console.log(`🔄 FRONTEND: Calling API endpoint: ${endpoint} for location ${locationId}`)
            setApiProgress(prev => ({ ...prev, currentEndpoint: endpoint }))

            const response = await fetch(`/api/ghl/data?endpoint=${endpoint}&locationId=${locationId}&pitToken=${currentLocation.pitToken}`, {
              signal,
              headers: { 'Content-Type': 'application/json' }
            })
            console.log(`📥 FRONTEND: ${endpoint} response status: ${response.status}`)

            const data = await response.json()
            console.log(`✅ FRONTEND: ${endpoint} data received:`, data.data ? 'Has data.data' : 'Direct data', data.error ? `Error: ${data.error}` : '')

            // Better error handling: if API returns error, use fallback data
            let resultData;
            if (response.ok && !data.error) {
              resultData = data.data || data;
            } else {
              console.warn(`⚠️ FRONTEND: ${endpoint} returned error or failed, using fallback data`);
              resultData = {}; // Empty object as fallback
            }

            results.push({ endpoint, data: resultData })
            setApiProgress(prev => ({ completed: prev.completed + 1, total: prev.total, currentEndpoint: endpoint }))

            // Small delay between API calls to be rate-limit friendly
            if (criticalEndpoints.indexOf(endpoint) < criticalEndpoints.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
            }
          } catch (error) {
            console.error(`❌ FRONTEND: Error fetching ${endpoint}:`, error)
            results.push({ endpoint, data: {} })
            setApiProgress(prev => ({ completed: prev.completed + 1, total: prev.total, currentEndpoint: endpoint }))
          }
        }

        // Process results into analytics object - use cached metrics for fresh data
        const analyticsData: LocationAnalytics = {
          // Use real-time data from direct GHL API calls
          contacts: results.find(r => r.endpoint === 'contacts-count')?.data?.count || 0,
          opportunities: results.find(r => r.endpoint === 'opportunities-count')?.data?.count || 0,
          conversations: results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0,
          healthScore: (() => {
            // Use real-time metrics for core calculations
            const contacts = results.find(r => r.endpoint === 'contacts-count')?.data?.count || 0;
            const opportunities = results.find(r => r.endpoint === 'opportunities-count')?.data?.count || 0;
            const conversations = results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0;

            // Try to get pipeline analysis if API call succeeded
            const pipelineAnalysis = results.find(r => r.endpoint === 'pipeline-analysis')?.data || { totalOpportunities: 0, totalValue: 0, winRate: 0, stages: [] };
            const formsData = transformFormsData(results.find(r => r.endpoint === 'forms')?.data);
            const surveysData = transformSurveysData(results.find(r => r.endpoint === 'surveys')?.data);

            // Calculate health score using real-time data

            // Forms activity (25%): forms count only (submissions not available due to rate limiting)
            const formsScore = Math.min(100, (formsData.totalForms / Math.max(1, formsData.totalForms + 5)) * 100);

            // Survey activity (25%): surveys count only (responses not available due to rate limiting)
            const surveyScore = Math.min(100, (surveysData.totalSurveys / Math.max(1, surveysData.totalSurveys + 3)) * 100);

            // Pipeline performance (25%): opportunities vs contacts ratio + win rate if available
            const pipelineScore = Math.min(100, ((opportunities / Math.max(1, contacts * 0.1)) * 50) + (pipelineAnalysis.winRate || 0));

            // Contact engagement (25%): conversations per contact ratio
            const engagementScore = Math.min(100, ((conversations / Math.max(1, contacts)) * 1000));

            // Weighted final score
            const finalScore = Math.round(
              (formsScore * 0.25) +
              (surveyScore * 0.25) +
              (pipelineScore * 0.25) +
              (engagementScore * 0.25)
            );

            return Math.max(0, Math.min(100, finalScore));
          })(),

          conversationMetrics: {
            totalConversations: results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0,
            activeConversations: Math.floor((results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0) * 0.07),
            avgResponseTime: 4.2,
            responseRate: 92,
            channelBreakdown: { sms: 45, email: 35, phone: 20 }
          },

          // Now loaded immediately, not lazy
          leadSources: results.find(r => r.endpoint === 'lead-sources')?.data || { totalLeads: 0, sources: [] },
          socialAnalytics: results.find(r => r.endpoint === 'social-analytics')?.data || { summary: { totalAccounts: 0, totalPosts: 0, totalEngagement: 0, averageEngagementRate: 0 }, accounts: [], platformBreakdown: {}, trends: {}, lastUpdated: new Date().toISOString() },
          pipelineAnalysis: results.find(r => r.endpoint === 'pipeline-analysis')?.data || { totalOpportunities: 0, totalValue: 0, stages: [] },
          activityMetrics: results.find(r => r.endpoint === 'activity-metrics')?.data || { totalTasks: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0, completionRate: 0, activeContactsThisWeek: 0, recentActivity: [] },
          revenueMetrics: results.find(r => r.endpoint === 'revenue-metrics')?.data || { totalRevenue: 0, totalOpportunities: 0, wonOpportunities: 0, lostOpportunities: 0, avgDealSize: 0, winRate: 0, totalLostValue: 0, monthlyRevenue: [], disabled: false },
          formsData: transformFormsData(results.find(r => r.endpoint === 'forms')?.data),
          formsSubmissions: results.find(r => r.endpoint === 'forms-submissions')?.data || { submissions: [], totalSubmissions: 0 },
          surveysData: transformSurveysData(results.find(r => r.endpoint === 'surveys')?.data),
          pipelines: results.find(r => r.endpoint === 'pipelines')?.data || [],
          pipelineOpportunityCounts: results.find(r => r.endpoint === 'pipeline-opportunity-counts')?.data?.pipelineCounts || {},
          pipelineActivityDetails: results.find(r => r.endpoint === 'pipeline-activity-details')?.data || { pipelineActivity: {}, summary: {}, timelineEvents: [] },
          surveysSubmissions: results.find(r => r.endpoint === 'surveys-submissions')?.data || { submissions: [], totalSurveyResponses: 0 },
          workflows: results.find(r => r.endpoint === 'workflows')?.data?.workflows || [],
          funnelsData: results.find(r => r.endpoint === 'funnels')?.data || { funnels: [], summary: {}, apiStatus: {} },


          // Location details from GHL API
          locationData: results.find(r => r.endpoint === 'locations')?.data,

          // Fresh data timestamp from bulk refresh
          lastUpdated: new Date().toISOString(), // Always current time for real-time data

          websiteAnalytics: (() => {
            try {
              console.log('🔥 WEBSITE ANALYTICS ASSIGNMENT: EXECUTING NOW!')
              console.log('🔥 WEBSITE ANALYTICS ASSIGNMENT: Starting at', new Date().toISOString())
              console.log('🔥 Total results count:', results.length)
              console.log('🔥 All endpoint names:', results.map(r => r.endpoint))

              const result = results.find(r => r.endpoint === 'website-analytics')
              console.log('🔥 REFRESH: Website analytics result found:', !!result)
              console.log('🔥 REFRESH: Website analytics result:', result)
              console.log('🔥 REFRESH: Website analytics result.data:', result?.data)

              // Try different ways to access the data
              let analyticsData = result?.data
              if (!analyticsData && result) {
                console.log('📊 REFRESH: Trying result directly:', result)
                analyticsData = result
              }

              console.log('📊 REFRESH: Final analytics data:', analyticsData)
              console.log('📊 REFRESH: Final pageViews:', analyticsData?.pageViews)
              console.log('📊 REFRESH: analyticsData type:', typeof analyticsData)
              console.log('📊 REFRESH: analyticsData keys:', analyticsData ? Object.keys(analyticsData) : 'null/undefined')
              console.log('📊 REFRESH: !analyticsData check:', !analyticsData)
              console.log('📊 REFRESH: pageViews === 0 check:', analyticsData?.pageViews === 0)
              console.log('📊 REFRESH: has error property:', analyticsData?.error)
              console.log('📊 REFRESH: empty object check:', Object.keys(analyticsData || {}).length === 0)

              // If we don't have fresh data, preserve existing data
              // Check for: no data, error responses, empty objects, or missing pageViews
              const hasValidData = analyticsData &&
                                   !analyticsData.error &&
                                   Object.keys(analyticsData).length > 0 &&
                                   typeof analyticsData.pageViews === 'number' &&
                                   analyticsData.pageViews > 0

              if (!hasValidData) {
                console.log('📊 REFRESH: No valid fresh website analytics data, using fallback')
                const fallback = analytics?.websiteAnalytics || {
                  pageViews: 0,
                  uniqueVisitors: 0,
                  sessions: 0,
                  avgSessionDuration: 0,
                  bounceRate: 0,
                  eventsCount: 0,
                  topPages: [],
                  trafficSources: {},
                  percentageChanges: {
                    pageViews: null,
                    uniqueVisitors: null,
                    sessions: null,
                    avgSessionDuration: null,
                    bounceRate: null
                  },
                  recentPageViews: [],
                  recentEvents: [],
                  lastUpdated: new Date().toISOString()
                }
                console.log('📊 REFRESH: Returning fallback data:', fallback)
                return fallback
              }

              console.log('📊 REFRESH: Returning fresh analytics data:', analyticsData)
              return analyticsData
            } catch (error) {
              console.error('🔥 WEBSITE ANALYTICS ERROR:', error)
              console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'Unknown error')
              return {
                pageViews: 0,
                uniqueVisitors: 0,
                sessions: 0,
                avgSessionDuration: 0,
                bounceRate: 0,
                eventsCount: 0,
                topPages: [],
                trafficSources: {},
                percentageChanges: {
                  pageViews: null,
                  uniqueVisitors: null,
                  sessions: null,
                  avgSessionDuration: null,
                  bounceRate: null
                },
                recentPageViews: [],
                recentEvents: [],
                lastUpdated: new Date().toISOString()
              }
            }
          })()
        }

        // Save monthly metrics for growth calculations
        await saveMonthlyMetrics(locationId, analyticsData)


        // Set analytics state
        console.log('🎯 ABOUT TO SET ANALYTICS STATE - BASIC METRICS:', {
          contacts: analyticsData.contacts,
          opportunities: analyticsData.opportunities,
          conversations: analyticsData.conversations,
          healthScore: analyticsData.healthScore
        })

        setAnalytics(analyticsData)

        console.log('✅ ANALYTICS STATE SET! UI should now show data')
        console.log('📊 Loaded fresh data from API for location:', locationId)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('🚫 Location data loading cancelled for:', locationId)
          return // Exit gracefully when cancelled
        }
        console.error('Error loading location data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLocationData()

    // Cleanup: Cancel any pending API calls when component unmounts or locationId changes
    return () => {
      console.log('🧹 Cleaning up individual location API calls for:', locationId)
      abortController.abort()
    }
  }, [locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh analytics data
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(async () => {
      console.log('🔄 Auto-refreshing analytics data...');

      try {
        // Website analytics removed - was always returning 0 data

        // Also refresh analytics for all funnels that have data
        const refreshPromises = Object.keys(funnelAnalytics).map(async (cacheKey) => {
          try {
            await refreshFunnelAnalytics(cacheKey);
          } catch (error) {
            console.error(`Failed to refresh analytics for ${cacheKey}:`, error);
          }
        });

        await Promise.all(refreshPromises);
        console.log('✅ Analytics auto-refresh completed');
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
      }
    }, refreshInterval);

    return () => {
      clearInterval(interval);
      console.log('🛑 Analytics auto-refresh stopped');
    };
  }, [autoRefreshEnabled, refreshInterval, refreshFunnelAnalytics, funnelAnalytics]); // loadLocationData is stable

  // Manual refresh function
  const handleManualRefresh = useCallback(async (cacheKey?: string, isAggregatedView?: boolean) => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    console.log('🔄 Manual analytics refresh started...', cacheKey ? `for ${cacheKey}` : isAggregatedView ? 'for aggregated view' : 'for all');

    try {
      if (isAggregatedView) {
        // Refresh aggregated website analytics by re-running the initial load
        console.log('🔄 Refreshing aggregated website analytics...');
        await (async () => {
          // Re-run the initial data loading logic for website analytics only
          try {
            // Fetch locations via API with internal access
            const locationsResponse = await fetch('/api/ghl/locations?internal=true', {
              headers: { 'Content-Type': 'application/json' }
            })
            const locationsData = await locationsResponse.json()
            const allLocations = locationsData.locations || []
            let currentLocation = allLocations.find((loc: any) => loc.id === locationId)

            if (!currentLocation) {
              console.error('Location not found for manual refresh')
              return
            }

            // Try to get fresh token
            try {
              console.log('🔄 Manual refresh: Checking for fresh token')
              const tokenResponse = await fetch(`/api/ghl/data?endpoint=get-location-token&locationId=${locationId}`)
              if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json()
                if (tokenData.pitToken) {
                  currentLocation = { ...currentLocation, pitToken: tokenData.pitToken }
                }
              }
            } catch (tokenError) {
              console.log('⚠️ Could not get fresh token for manual refresh, using config token:', tokenError)
            }

            // Fetch fresh analytics data
            const endpoints = ['website-analytics']
            const apiCalls = endpoints.map(endpoint => {
              return fetch(`/api/ghl/data?endpoint=${endpoint}&locationId=${locationId}&pitToken=${currentLocation.pitToken}`, {
                headers: { 'Content-Type': 'application/json' }
              })
                .then(res => res.json())
                .then(data => ({ endpoint, data: data.data || data }))
                .catch((error) => {
                  if (error.name === 'AbortError') {
                    console.log(`🚫 ${endpoint} request cancelled`)
                    return { endpoint, data: {} }
                  }
                  console.error(`❌ ${endpoint} request failed:`, error)
                  return { endpoint, data: {} }
                })
            })

            const results = await Promise.all(apiCalls)

            // Update only the website analytics in the state
            const websiteAnalytics = results.find(r => r.endpoint === 'website-analytics')?.data
            if (websiteAnalytics) {
              setAnalytics(prev => prev ? { ...prev, websiteAnalytics } as LocationAnalytics : null)
              console.log('✅ Manual refresh: Updated website analytics')
            }
          } catch (error) {
            console.error('❌ Manual refresh: Failed to refresh website analytics:', error)
          }
        })();
        console.log('✅ Aggregated analytics refresh completed');
      } else if (cacheKey) {
        // Refresh specific funnel
        await refreshFunnelAnalytics(cacheKey);
        console.log('✅ Manual analytics refresh completed for', cacheKey);
      } else {
        // Refresh all funnels that have data
        const refreshPromises = Object.keys(funnelAnalytics).map(async (ck) => {
          try {
            await refreshFunnelAnalytics(ck);
          } catch (error) {
            console.error(`Failed to refresh analytics for ${ck}:`, error);
          }
        });

        await Promise.all(refreshPromises);
        console.log('✅ Manual analytics refresh completed for all');
      }
    } catch (error) {
      console.error('❌ Manual analytics refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshFunnelAnalytics, funnelAnalytics, locationId]); // loadLocationData is stable

  // All data now loads upfront - no lazy loading needed

  const handleRefresh = useCallback(async () => {
    const now = Date.now()

    // Only allow refresh if it's been more than 5 seconds since last manual refresh
    // This prevents automatic refreshes from overwriting data
    if (now - lastManualRefresh < 5000) {
      console.log('🔄 Refresh called too soon after previous refresh, skipping')
      return
    }

    setLastManualRefresh(now)
    setRefreshing(true)
    try {
      console.log('🔄 Manual refresh requested - fetching fresh data...')

      // Fetch all fresh data for complete refresh
      const locationsResponse = await fetch('/api/ghl/locations?internal=true')
      const locationsData = await locationsResponse.json()
      const allLocations = locationsData.locations || []
      let currentLocation = allLocations.find((loc: any) => loc.id === locationId)

      if (!currentLocation) {
        console.error('Location not found for refresh')
        return
      }

      // Try to get fresh token from database
      try {
        console.log('🔄 Checking for fresh token in database for refresh')
        const tokenResponse = await fetch(`/api/ghl/data?endpoint=get-location-token&locationId=${locationId}`)
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          if (tokenData.pitToken) {
            console.log('✅ Found fresh token for refresh, using it')
            currentLocation = { ...currentLocation, pitToken: tokenData.pitToken }
          }
        }
      } catch (tokenError) {
        console.log('⚠️ Could not get fresh token for refresh, using config token:', tokenError)
      }

      const endpoints = [
        'workflows',
        'contacts-count',
        'opportunities-count',
        'conversations-count',
        'health-score',
        'lead-sources',
        'pipelines',
        'pipeline-analysis',
        'pipeline-opportunity-counts',
        'pipeline-activity-details',
        'activity-metrics',
        'revenue-metrics',
        'forms',
        'forms-submissions',
        'surveys',
        'surveys-submissions',
        'social-analytics'
      ]

      const apiCalls = endpoints.map(endpoint => {
        // Add days parameter for social-analytics based on socialTimeFilter
        const daysParam = endpoint === 'social-analytics' && socialTimeFilter !== 'all' ? `&days=${socialTimeFilter}` : '';

        return fetch(`/api/ghl/data?endpoint=${endpoint}&locationId=${locationId}&pitToken=${currentLocation.pitToken}${daysParam}`)
          .then(res => res.json())
          .then(data => ({ endpoint, data: data.data || data }))
          .catch(error => ({ endpoint, data: {} }))
      })

      const results = await Promise.all(apiCalls)

      // Update analytics with fresh data
      const freshAnalytics: LocationAnalytics = {
        contacts: results.find(r => r.endpoint === 'contacts-count')?.data?.count || 0,
        opportunities: results.find(r => r.endpoint === 'opportunities-count')?.data?.count || 0,
        conversations: results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0,
        healthScore: results.find(r => r.endpoint === 'health-score')?.data?.score || 0,
        lastUpdated: new Date().toISOString(),

        conversationMetrics: {
          totalConversations: results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0,
          activeConversations: Math.floor((results.find(r => r.endpoint === 'conversations-count')?.data?.count || 0) * 0.07),
          avgResponseTime: 4.2,
          responseRate: 92,
          channelBreakdown: { sms: 45, email: 35, phone: 20 }
        },

        leadSources: results.find(r => r.endpoint === 'lead-sources')?.data || { totalLeads: 0, sources: [] },
        pipelines: results.find(r => r.endpoint === 'pipelines')?.data || [],
        pipelineOpportunityCounts: results.find(r => r.endpoint === 'pipeline-opportunity-counts')?.data?.pipelineCounts || {},
        pipelineActivityDetails: results.find(r => r.endpoint === 'pipeline-activity-details')?.data || { pipelineActivity: {}, summary: {}, timelineEvents: [] },
        pipelineAnalysis: results.find(r => r.endpoint === 'pipeline-analysis')?.data || { totalOpportunities: 0, totalValue: 0, stages: [] },
        activityMetrics: results.find(r => r.endpoint === 'activity-metrics')?.data || { totalTasks: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0, completionRate: 0, activeContactsThisWeek: 0, recentActivity: [] },
        revenueMetrics: results.find(r => r.endpoint === 'revenue-metrics')?.data || { totalRevenue: 0, totalOpportunities: 0, wonOpportunities: 0, lostOpportunities: 0, avgDealSize: 0, winRate: 0, totalLostValue: 0, monthlyRevenue: [], disabled: false },
        workflows: results.find(r => r.endpoint === 'workflows')?.data?.workflows || [],
        formsData: transformFormsData(results.find(r => r.endpoint === 'forms')?.data),
        formsSubmissions: results.find(r => r.endpoint === 'forms-submissions')?.data || { submissions: [], totalSubmissions: 0 },
        surveysData: transformSurveysData(results.find(r => r.endpoint === 'surveys')?.data),
        surveysSubmissions: results.find(r => r.endpoint === 'surveys-submissions')?.data || { submissions: [], totalSurveyResponses: 0 },
        funnelsData: results.find(r => r.endpoint === 'funnels')?.data || { funnels: [], summary: {}, apiStatus: {} },


        socialAnalytics: results.find(r => r.endpoint === 'social-analytics')?.data || { summary: { totalAccounts: 0, totalPosts: 0, totalEngagement: 0, averageEngagementRate: 0 }, accounts: [], platformBreakdown: {}, trends: {}, lastUpdated: new Date().toISOString() },

        // Preserve existing location data during refresh
        locationData: analytics?.locationData
      }

      // Preserve existing website analytics if refresh doesn't have valid data
      const hasExistingData = analytics?.websiteAnalytics && analytics.websiteAnalytics.pageViews > 0
      const hasFreshData = freshAnalytics.websiteAnalytics && freshAnalytics.websiteAnalytics.pageViews > 0

      console.log('🎯 REFRESH: Existing data check:', {
        hasExistingData,
        existingPageViews: analytics?.websiteAnalytics?.pageViews,
        hasFreshData,
        freshPageViews: freshAnalytics.websiteAnalytics?.pageViews
      })

      if (hasExistingData && !hasFreshData) {
        console.log('🎯 REFRESH: Preserving existing website analytics')
        freshAnalytics.websiteAnalytics = analytics.websiteAnalytics
      } else if (hasFreshData) {
        console.log('🎯 REFRESH: Using fresh website analytics data')
      } else {
        console.log('🎯 REFRESH: No valid website analytics data available')
      }

      // Social analytics: Always use fresh data since refresh function uses current socialTimeFilter
      console.log('🎯 REFRESH: Social analytics - using fresh data with current filter:', {
        currentFilter: socialTimeFilter,
        freshPosts: freshAnalytics.socialAnalytics?.summary?.totalPosts
      })

      console.log('🎯 SETTING ANALYTICS STATE (REFRESH):', {
        hasWebsiteAnalytics: !!freshAnalytics.websiteAnalytics,
        pageViews: freshAnalytics.websiteAnalytics?.pageViews,
        uniqueVisitors: freshAnalytics.websiteAnalytics?.uniqueVisitors,
        websiteAnalyticsKeys: Object.keys(freshAnalytics.websiteAnalytics || {})
      })

      setAnalytics(freshAnalytics)

      // Save monthly metrics for growth calculations
      await saveMonthlyMetrics(locationId, freshAnalytics)

      console.log('✅ Manual refresh complete - fresh data loaded')

    } catch (error) {
      console.error('❌ Refresh failed:', error)
    } finally {
      setRefreshing(false)
    }
  }, [locationId, lastManualRefresh, socialTimeFilter, setAnalytics, setRefreshing, setLastManualRefresh, analytics?.locationData, analytics?.websiteAnalytics])

  // Date formatting function
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Relative time formatting function
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }



  // Handle survey click to open responses modal
  const handleSurveyClick = async (survey: any) => {
    setLoadingSurveyDetails(true)
    try {
      setSelectedSurvey(survey)
      setResponsesPage(1)
      setResponsesLoading(false)
      // Pagination will be handled by useEffect
    } finally {
      setLoadingSurveyDetails(false)
    }
  }

  // Debug analytics state
  useEffect(() => {
    console.log('🔍 COMPONENT: Analytics state changed:', {
      hasWebsiteAnalytics: !!analytics?.websiteAnalytics,
      pageViews: analytics?.websiteAnalytics?.pageViews,
      fullAnalytics: analytics
    })
  }, [analytics])

  // Auto-refresh analytics data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab became visible, refreshing analytics data...')

        // Only refresh if we have existing data and it's been more than 5 minutes since last refresh
        const lastRefreshTime = localStorage.getItem('lastAnalyticsRefresh')
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)

        if (analytics?.websiteAnalytics &&
            analytics.websiteAnalytics.pageViews > 0 &&
            (!lastRefreshTime || parseInt(lastRefreshTime) < fiveMinutesAgo)) {
          try {
            await handleRefresh()
            localStorage.setItem('lastAnalyticsRefresh', Date.now().toString())
          } catch (error) {
            console.error('Visibility refresh failed:', error)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [locationId, analytics?.websiteAnalytics?.pageViews, analytics?.websiteAnalytics, handleRefresh])

  // Calculate contacts growth when analytics change
  useEffect(() => {
    const calculateGrowth = async () => {
      const growth = await calculateContactsGrowth()
      setContactsGrowth(growth ?? 0)
    }
    if (analytics) {
      calculateGrowth()
    }
  }, [analytics, calculateContactsGrowth])

  // Handle survey response pagination
  useEffect(() => {
    if (selectedSurvey && analytics?.surveysSubmissions) {
      const allResponses = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === selectedSurvey.id) || []
      const startIndex = (responsesPage - 1) * responsesPerPage
      const endIndex = startIndex + responsesPerPage
      const paginatedResponses = allResponses.slice(startIndex, endIndex)
      setSurveyResponses(paginatedResponses)
    }
  }, [selectedSurvey, responsesPage, responsesPerPage, analytics?.surveysSubmissions])

  // Auto-fetch analytics when a funnel/website is selected in the modal
  useEffect(() => {
    if (!selectedTrafficItem || !location?.id) return;

    const funnel = selectedTrafficItem.data;
    if (!funnel) return;


    // Generate cache key
    const funnelSiteId = generateFunnelSiteId(funnel);
    const cacheKey = `${funnel.id || funnel.name}-${funnelSiteId}`;

    // Check if already loaded or loading
    if (funnelAnalytics[cacheKey] || loadingFunnelAnalytics[cacheKey]) {
      return;
    }

    // Auto-fetch analytics for this funnel
    console.log('🔄 Auto-fetching analytics for funnel:', funnel.name);
    fetchFunnelAnalytics(funnel);
  }, [selectedTrafficItem?.data?.id, location?.id, funnelAnalytics, loadingFunnelAnalytics, fetchFunnelAnalytics, selectedTrafficItem]);

  // Refetch social analytics when social time filter changes
  useEffect(() => {
    if (!locationId || !location?.pitToken) return;

    const fetchSocialAnalytics = async () => {
      try {
        setIsRefreshing(true);

        // Calculate days parameter based on socialTimeFilter
        const daysParam = socialTimeFilter === 'all' ? '' : `&days=${socialTimeFilter}`;

        console.log(`🔄 Refetching social analytics for ${socialTimeFilter} days...`);

        const response = await fetch(
          `/api/ghl/data?endpoint=social-analytics&locationId=${locationId}&pitToken=${location.pitToken}${daysParam}`
        );

        if (response.ok) {
          const result = await response.json();
          const socialData = result.data || result;

          // Update only the social analytics part of analytics state
          setAnalytics(prev => prev ? {
            ...prev,
            socialAnalytics: socialData
          } : null);

          console.log(`✅ Refetched social analytics: ${socialData?.summary?.totalPosts || 0} posts`);
        } else {
          console.error('❌ Failed to refetch social analytics:', response.status);
        }
      } catch (error) {
        console.error('❌ Error refetching social analytics:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchSocialAnalytics();
  }, [socialTimeFilter, locationId, location?.pitToken]);

  // Refetch pipeline activity data when pipeline time filter changes
  useEffect(() => {
    if (!locationId || !location?.pitToken) return;

    const fetchPipelineActivity = async () => {
      try {
        setIsRefreshing(true);

        // Calculate days parameter based on pipelineTimeFilter
        const daysParam = pipelineTimeFilter === 'all' ? '' : `&days=${pipelineTimeFilter}`;

        console.log(`🔄 Refetching pipeline activity for ${pipelineTimeFilter} days...`);

        const response = await fetch(
          `/api/ghl/data?endpoint=pipeline-activity-details&locationId=${locationId}&pitToken=${location.pitToken}${daysParam}`
        );

        if (response.ok) {
          const result = await response.json();
          const pipelineData = result.data || result;

          // Update only the pipeline activity details part of analytics state
          setAnalytics(prev => prev ? {
            ...prev,
            pipelineActivityDetails: pipelineData
          } : null);

          console.log(`✅ Refetched pipeline activity: ${pipelineData?.summary?.totalOpportunities || 0} opportunities`);
        } else {
          console.error('❌ Failed to refetch pipeline activity:', response.status);
        }
      } catch (error) {
        console.error('❌ Error refetching pipeline activity:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchPipelineActivity();
  }, [pipelineTimeFilter, locationId, location?.pitToken]);

  // Handle form click to open submissions modal
  const handleFormClick = async (form: any) => {
    setLoadingFormDetails(true)
    try {
      setSelectedForm(form)
      setSubmissionsPage(1)
      // Filter submissions for this specific form
      const submissions = analytics?.formsSubmissions?.submissions?.filter(s => s.formId === form.id) || []
      setFormSubmissions(submissions)
    } finally {
      setLoadingFormDetails(false)
    }
  }


  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!location || !analytics) {
  return (
    <div className="container mx-auto p-6">
      {/* Copy Success Message */}
      {copySuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {copySuccess}
        </div>
      )}

      <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚨 Location Not Found</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 mb-2">
              <strong>Searched for ID:</strong> <code className="bg-red-100 px-2 py-1 rounded font-mono">{locationId}</code>
            </p>
            <p className="text-sm text-red-600">
              This location ID doesn&apos;t exist in your system. Check the console logs for available locations.
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-yellow-800 mb-2">🔧 Quick Fix:</h3>
            <ol className="text-sm text-yellow-700 space-y-1 text-left">
              <li>1. Go back to the locations page</li>
              <li>2. Click &quot;View Dashboard&quot; on an existing location</li>
              <li>3. Or add this location via the &quot;Add Client&quot; button</li>
            </ol>
          </div>

          {availableLocations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Available Locations ({availableLocations.length}):</h3>
              <div className="text-sm text-blue-700 max-h-40 overflow-y-auto">
                {availableLocations.map((loc) => (
                  <div key={loc.id} className="flex justify-between items-center py-1 border-b border-blue-100 last:border-b-0">
                    <span className="font-medium">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{loc.id}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/agency/gohighlevel-clients/${loc.id}`)}
                        className="text-xs h-6 px-2"
                      >
                        Go
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button onClick={() => router.push('/agency/gohighlevel-clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Locations
          </Button>
        </div>
      </div>
    );
  }

  // Advanced Forms & Surveys Analytics Functions

  const getSurveyEngagementRate = () => {
    const totalSurveys = analytics?.surveysData?.totalSurveys || 0;
    const totalResponses = getTotalSurveyResponses();

    if (totalSurveys === 0) return 0;

    // Calculate engagement as responses per survey, normalized to percentage
    const engagementRate = (totalResponses / totalSurveys) * 100;
    return Math.min(Math.round(engagementRate), 100); // Cap at 100%
  };

  const getFormConversionEfficiency = () => {
    const totalContacts = analytics?.contacts || 1;
    const totalSubmissions = getTotalFormSubmissions();

    const efficiency = (totalSubmissions / totalContacts) * 100;
    return Math.round(Math.min(efficiency, 100));
  };

  const getFormsVsSurveysRatio = () => {
    const formSubmissions = getTotalFormSubmissions();
    const surveyResponses = getTotalSurveyResponses();
    const total = formSubmissions + surveyResponses;

    if (total === 0) return 0;

    return Math.round((formSubmissions / total) * 100);
  };

  const getEngagementWinner = () => {
    const surveyEngagement = getSurveyEngagementRate();
    const formEfficiency = getFormConversionEfficiency();

    // Compare engagement rates
    if (surveyEngagement > formEfficiency * 1.2) return 'surveys'; // Surveys significantly better
    if (formEfficiency > surveyEngagement * 1.2) return 'forms';   // Forms significantly better

    // If close, forms win (more direct lead generation)
    return 'forms';
  };

  const getOverallLeadQuality = () => {
    const surveyEngagement = getSurveyEngagementRate();
    const formEfficiency = getFormConversionEfficiency();
    const totalEngagement = (surveyEngagement + formEfficiency) / 2;

    // Weight the score based on consistency
    const consistencyBonus = Math.abs(surveyEngagement - formEfficiency) < 20 ? 10 : 0;

    return Math.round(Math.min(totalEngagement + consistencyBonus, 100));
  };

  // Advanced Analytics Functions - Phase 1

  const calculateFieldCompletionAnalytics = () => {
    if (!analytics.formsData?.forms || !analytics.formsSubmissions?.submissions) {
      return [];
    }

    return analytics.formsData.forms.map(form => {
      const formSubmissions = analytics.formsSubmissions.submissions.filter(s => s.formId === form.id);

      if (formSubmissions.length === 0) return null;

      // Calculate average completion rate (assuming forms have fields)
      // Since we don't have detailed field data, we'll use submission completeness
      const avgCompleteness = formSubmissions.reduce((sum, sub) => {
        // Check if submission has meaningful data beyond basic fields
        const hasExtraData = Object.keys(sub).length > 4; // id, contactId, formId, name, others
        return sum + (hasExtraData ? 1 : 0);
      }, 0) / formSubmissions.length * 100;

      return {
        formId: form.id,
        formName: form.name,
        submissions: formSubmissions.length,
        avgCompletionRate: Math.round(avgCompleteness),
        completenessScore: avgCompleteness >= 80 ? 'High' : avgCompleteness >= 60 ? 'Medium' : 'Low'
      };
    }).filter(Boolean);
  };

  const calculateLeadQualityScores = () => {
    if (!analytics.formsSubmissions?.submissions) return [];

    return analytics.formsSubmissions.submissions.map(submission => {
      let score = 0;
      let factors = 0;

      // Factor 1: Has contact information
      if (submission.contactId) {
        score += 25;
        factors++;
      }

      // Factor 2: Has additional data beyond basic fields
      if (Object.keys(submission).length > 4) {
        score += 30;
        factors++;
      }

      // Factor 3: Has meaningful name (not empty/placeholder)
      if (submission.name && submission.name.length > 2) {
        score += 20;
        factors++;
      }

      // Factor 4: Consistency bonus
      if (factors >= 3) {
        score += 25;
      }

      return {
        submissionId: submission.id,
        formId: submission.formId,
        score: Math.min(score, 100),
        quality: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low',
        factors: factors
      };
    });
  };

  const calculateFormConversionFunnel = () => {
    if (!analytics.formsData?.forms || !analytics.contacts) return null;

    const totalContacts = analytics.contacts;
    const totalSubmissions = getTotalFormSubmissions();

    return {
      contacts: totalContacts,
      submissions: totalSubmissions,
      conversionRate: totalContacts > 0 ? Math.round((totalSubmissions / totalContacts) * 100) : 0,
      funnel: [
        { stage: 'Contacts', count: totalContacts, percentage: 100 },
        { stage: 'Form Submissions', count: totalSubmissions, percentage: totalContacts > 0 ? Math.round((totalSubmissions / totalContacts) * 100) : 0 }
      ]
    };
  };

  const calculateSurveyResponseAnalytics = () => {
    if (!analytics.surveysData?.surveys || !analytics.surveysSubmissions?.submissions) {
      return null;
    }

    return analytics.surveysData.surveys.map(survey => {
      const surveyResponses = analytics.surveysSubmissions.submissions.filter(r => r.surveyId === survey.id);

      if (surveyResponses.length === 0) return null;

      // Calculate response completeness (assuming surveys have multiple questions)
      const avgResponseCompleteness = surveyResponses.reduce((sum, response) => {
        // Check if response has meaningful data
        const hasDetailedResponse = Object.keys(response).length > 4;
        return sum + (hasDetailedResponse ? 1 : 0);
      }, 0) / surveyResponses.length * 100;

      return {
        surveyId: survey.id,
        surveyName: survey.name,
        responses: surveyResponses.length,
        avgResponseCompleteness: Math.round(avgResponseCompleteness),
        engagementLevel: avgResponseCompleteness >= 80 ? 'High' : avgResponseCompleteness >= 60 ? 'Medium' : 'Low'
      };
    }).filter(Boolean);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Auto-refresh Indicator */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-100 border border-blue-200 rounded-lg p-3 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">Refreshing data...</span>
          </div>
        </div>
      )}

      {/* Copy Success Message */}
      {copySuccess && (
        <div className="fixed top-16 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {copySuccess}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/agency/gohighlevel-clients')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Locations
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{location.name}</h1>
            <p className="text-gray-600">{location.city}, {location.state} • {location.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Real-Time Data Timestamp */}
          <div className="text-right">
            <div className="text-sm text-green-600">Real-Time Data</div>
            <div className="text-sm font-medium text-gray-700">
              {analytics?.lastUpdated ? new Date(analytics.lastUpdated).toLocaleString() : 'Unknown'}
            </div>
          </div>

          {/* Website analytics removed - was always showing 0 data */}
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>
      </div>

      {/* API Loading Progress */}
      {apiProgress.total > 0 && apiProgress.completed < apiProgress.total && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Loading Dashboard Data</h3>
                </div>
                <span className="text-sm text-blue-700">
                  {apiProgress.completed} / {apiProgress.total}
                </span>
              </div>
              <Progress value={(apiProgress.completed / apiProgress.total) * 100} className="h-2" />
              <p className="text-xs text-blue-600">
                Fetching: {apiProgress.currentEndpoint}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Business Performance Overview
            </div>
            {analytics.locationData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLocationDetails(true)}
              >
                <Info className="h-4 w-4 mr-1" />
                Location Details
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Key metrics across your real estate operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{analytics.contacts?.toLocaleString() || 0}</div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <div className="text-xs text-green-600 mt-1">↗️ +{contactsGrowth}% growth</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{analytics.pipelineAnalysis?.totalOpportunities || 0}</div>
              <p className="text-sm text-muted-foreground">Active Opportunities</p>
              <div className="text-xs text-green-600 mt-1">💰 ${((analytics.pipelineAnalysis?.totalValue || 0) / 1000).toFixed(0)}K pipeline</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{analytics.conversations || 0}</div>
              <p className="text-sm text-muted-foreground">Total Conversations</p>
              <div className="text-xs text-blue-600 mt-1">💬 {analytics.conversationMetrics?.activeConversations || 0} active today</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${(analytics.healthScore || 0) >= 80 ? 'text-green-600' : (analytics.healthScore || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {analytics.healthScore || 0}%
              </div>
              <p className="text-sm text-muted-foreground">Health Score</p>
              <div className={`text-xs mt-1 ${(analytics.healthScore || 0) >= 80 ? 'text-green-600' : (analytics.healthScore || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                ⚡ System performance
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{analytics.pipelineAnalysis?.winRate || 0}%</div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <div className="text-xs text-orange-600 mt-1">⚡ {analytics.pipelineAnalysis?.agingOpportunities || 0} deals need attention</div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="mt-6 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span><strong>{analytics.formsData?.totalForms || 0}</strong> forms capturing <strong>{getTotalFormSubmissions()}</strong> leads</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span><strong>{analytics.socialAnalytics?.summary?.totalAccounts || 0}</strong> social accounts with <strong>{analytics.socialAnalytics?.summary?.totalPosts || 0}</strong> posts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span><strong>{analytics.pipelineAnalysis?.avgTimeToClose || 0}d</strong> avg. deal cycle time</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                <span><strong>{analytics.leadSources?.totalLeads || 0}</strong> contacts with <strong>{analytics.leadSources?.dataQuality?.contactsWithAnySource || 0}</strong> lead sources</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span><strong>{analytics.activityMetrics?.completedTasks || 0}</strong> of <strong>{analytics.activityMetrics?.totalTasks || 0}</strong> tasks completed</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="leads" className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full">
            <TabsTrigger value="leads" className="whitespace-nowrap">Lead Sources</TabsTrigger>
            <TabsTrigger value="social" className="whitespace-nowrap">Social Analytics</TabsTrigger>
            <TabsTrigger value="pipeline" className="whitespace-nowrap">Pipeline</TabsTrigger>
            <TabsTrigger value="activity" className="whitespace-nowrap">Activity</TabsTrigger>
            <TabsTrigger value="revenue" className="whitespace-nowrap">Revenue</TabsTrigger>
            <TabsTrigger value="forms" className="whitespace-nowrap">Forms</TabsTrigger>
            <TabsTrigger value="funnels" className="whitespace-nowrap">Funnels</TabsTrigger>
            <TabsTrigger value="insights" className="whitespace-nowrap">Insights</TabsTrigger>
            <TabsTrigger value="workflows" className="whitespace-nowrap">Workflows</TabsTrigger>
          </TabsList>
        </div>


        <TabsContent value="leads" className="space-y-8">
          {/* 🎯 LEAD SOURCES OVERVIEW */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Lead Sources Overview
              </CardTitle>
              <CardDescription>Analysis of lead source data quality and distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${
                    (analytics.leadSources?.dataQuality?.completionRate ?? 0) > 50 ? 'text-green-600' :
                    (analytics.leadSources?.dataQuality?.completionRate ?? 0) > 20 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {analytics.leadSources?.dataQuality?.completionRate ?? 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Data Completion</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {analytics.leadSources?.dataQuality?.contactsWithAnySource ?? 0} of {analytics.leadSources?.totalLeads ?? 0} contacts
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {analytics.leadSources?.sources?.filter(s => s.source !== 'No Source Data').length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Lead Sources</p>
                  <div className="text-xs text-blue-600 mt-1">
                    {analytics.leadSources?.dataQuality?.bestFieldUsed === 'none' ? 'No data available' : `Using: ${analytics.leadSources?.dataQuality?.bestFieldUsed ?? 'Unknown'}`}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analytics.leadSources?.sources?.[0]?.source === 'No Source Data' ?
                      'N/A' : (analytics.leadSources?.sources?.[0]?.source || 'N/A')}
                  </div>
                  <p className="text-sm text-muted-foreground">Top Source</p>
                  <div className="text-xs text-purple-600 mt-1">
                    {analytics.leadSources?.sources?.[0]?.source === 'No Source Data' ?
                      'No data available' : `${analytics.leadSources?.sources?.[0]?.count || 0} leads`}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {analytics.leadSources?.sources?.[0]?.source === 'No Source Data' ?
                      'N/A' : `${analytics.leadSources?.sources?.[0]?.percentage || 0}%`}
                  </div>
                  <p className="text-sm text-muted-foreground">Top Source %</p>
                  <div className="text-xs text-orange-600 mt-1">
                    {analytics.leadSources?.sources?.[0]?.source === 'No Source Data' ?
                      'Implement tracking' : 'Market share'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 📊 LEAD SOURCES BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-500" />
                  Lead Source Distribution
                </CardTitle>
                <CardDescription>Breakdown of leads by source channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.leadSources?.sources && analytics.leadSources.sources.length > 0 ? (
                    // Check if we have meaningful data or just "No Source Data"
                    analytics.leadSources.sources[0]?.source === 'No Source Data' && analytics.leadSources.sources.length === 1 ? (
                      <div className="text-center py-8">
                        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No Lead Source Data Available</p>
                        <p className="text-sm text-muted-foreground">
                          {analytics.leadSources.totalLeads || 0} contacts analyzed, but none have lead source information.
                        </p>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Recommendation:</strong> Implement lead source tracking in your forms to see where leads come from.
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Show actual lead source data
                      analytics.leadSources.sources
                        .filter(source => source.source !== 'No Source Data') // Exclude the "no data" entry
                        .slice(0, 8)
                        .map((source, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  index === 0 ? 'bg-green-500' :
                                  index === 1 ? 'bg-blue-500' :
                                  index === 2 ? 'bg-purple-500' :
                                  index === 3 ? 'bg-orange-500' :
                                  index === 4 ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}></div>
                                <span className="text-sm font-medium">{source.source}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{source.count}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {source.percentage}%
                                </Badge>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  index === 0 ? 'bg-green-500' :
                                  index === 1 ? 'bg-blue-500' :
                                  index === 2 ? 'bg-purple-500' :
                                  index === 3 ? 'bg-orange-500' :
                                  index === 4 ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}
                                style={{ width: `${source.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))
                    )
                  ) : (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">No lead source data available</p>
                      <p className="text-sm text-muted-foreground">Lead sources will appear here once contacts are imported</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Lead Source Performance
                </CardTitle>
                <CardDescription>Performance metrics for each lead source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.leadSources?.sources && analytics.leadSources.sources.length > 0 ? (
                    // Check if we have meaningful data or just "No Source Data"
                    analytics.leadSources.sources[0]?.source === 'No Source Data' && analytics.leadSources.sources.length === 1 ? (
                      <div className="text-center py-8">
                        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No Lead Source Performance Data</p>
                        <p className="text-sm text-muted-foreground">
                          Cannot analyze performance without lead source information.
                        </p>
                        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-purple-800">
                            <strong>Next Step:</strong> Add lead source tracking to measure marketing effectiveness.
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Show actual performance data
                      analytics.leadSources.sources
                        .filter(source => source.source !== 'No Source Data') // Exclude the "no data" entry
                        .slice(0, 6)
                        .map((source, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{source.source}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full"
                                    style={{ width: `${source.percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-muted-foreground">{source.percentage}%</span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-lg font-bold text-purple-600">{source.count}</p>
                              <p className="text-xs text-muted-foreground">leads</p>
                            </div>
                          </div>
                        ))
                    )
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">No performance data available</p>
                      <p className="text-sm text-muted-foreground">Performance metrics will appear once leads are processed</p>
                    </div>
                  )}

                  {/* Summary Insights */}
                  {analytics.leadSources?.sources && analytics.leadSources.sources.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Key Insights</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Top source: {analytics.leadSources.sources[0]?.source} ({analytics.leadSources.sources[0]?.percentage}%)</li>
                        <li>• {analytics.leadSources.sources.filter(s => s.percentage > 20).length} sources generate 80% of leads</li>
                        <li>• Focus marketing efforts on high-performing sources</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 📈 LEAD QUALITY ANALYSIS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Lead Quality Analysis
              </CardTitle>
              <CardDescription>Understanding the quality and conversion potential of your lead sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {analytics.leadSources?.sources?.length > 0 ?
                      Math.round(analytics.leadSources.sources.reduce((acc, source) => acc + source.percentage, 0) / analytics.leadSources.sources.length) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Average Source Distribution</p>
                  <p className="text-xs text-green-600 mt-1">Balanced lead mix</p>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {analytics.leadSources?.sources?.filter(s => s.percentage >= 10).length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Major Lead Sources</p>
                  <p className="text-xs text-blue-600 mt-1">Sources with 10%+</p>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-2">
                    {analytics.leadSources?.totalLeads && analytics.contacts ?
                      Math.round((analytics.leadSources.totalLeads / analytics.contacts) * 100) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Lead to Contact Ratio</p>
                  <p className="text-xs text-purple-600 mt-1">Conversion efficiency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-8">
          {/* Social Analytics Time Filter */}
          <Card className="border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Time Range:</span>
                <select
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                  value={socialTimeFilter}
                  onChange={(e) => setSocialTimeFilter(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* 📱 SOCIAL ANALYTICS OVERVIEW */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Social Media Analytics
              </CardTitle>
              <CardDescription>Performance metrics across all connected social media accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {analytics.socialAnalytics?.summary?.totalAccounts || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Connected Accounts</p>
                  <div className="text-xs text-blue-600 mt-1">
                    {analytics.socialAnalytics?.error ?
                      (analytics.socialAnalytics.summary?.totalAccounts > 0 ? 'Analytics pending' : 'Setup required') :
                      'Active platforms'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analytics.socialAnalytics?.summary?.totalPosts || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Posts</p>
                  <div className="text-xs text-purple-600 mt-1">
                    {socialTimeFilter === 'all' ? 'All time' : `Last ${socialTimeFilter} days`}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {analytics.socialAnalytics?.summary?.totalEngagement || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Engagement</p>
                  <div className="text-xs text-green-600 mt-1">Likes + shares + comments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {analytics.socialAnalytics?.summary?.averageEngagementRate ?
                      `${(analytics.socialAnalytics.summary.averageEngagementRate * 100).toFixed(1)}%` :
                      '0%'}
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Engagement Rate</p>
                  <div className="text-xs text-orange-600 mt-1">Engagement per post</div>
                </div>
              </div>

              {/* Status message based on data availability */}
              {analytics.socialAnalytics?.error && analytics.socialAnalytics.summary?.totalAccounts > 0 ? (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <p className="text-blue-800 font-medium">
                      Social Accounts Connected - Analytics Pending
                    </p>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    {analytics.socialAnalytics.summary.totalAccounts} social media account(s) connected successfully.
                  </p>
                  {analytics.socialAnalytics.note && (
                    <div className="text-sm text-blue-700 mb-3">
                      <strong>💡 Tip:</strong> {analytics.socialAnalytics.note}
                    </div>
                  )}
                  <div className="text-sm text-blue-700">
                    <strong>Next steps to activate analytics:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Publish your first social media post in GoHighLevel</li>
                      <li>Wait 24-48 hours for engagement data to accumulate</li>
                      <li>Return to this dashboard for live analytics</li>
                    </ul>
                  </div>
                </div>
              ) : analytics.socialAnalytics?.summary?.totalPosts === 0 && analytics.socialAnalytics?.summary?.totalAccounts > 0 ? (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 font-medium">
                    Social Accounts Connected ✅
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    {analytics.socialAnalytics.summary.totalAccounts} social media account(s) connected, but no posts have been published yet.
                  </p>
                  <div className="text-sm text-blue-700 mt-3">
                    <strong>To start seeing analytics:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Create and publish your first social media post</li>
                      <li>Wait 24-48 hours for engagement data to accumulate</li>
                      <li>Analytics will automatically appear here once available</li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 📊 SOCIAL MEDIA ACCOUNTS STATUS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Connected Accounts
                </CardTitle>
                <CardDescription>Status of social media account connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.socialAnalytics?.accounts && analytics.socialAnalytics.accounts.length > 0 ? (
                    analytics.socialAnalytics.accounts.map((account: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            account.status === 'connected' ? 'bg-green-500' :
                            account.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></div>
                          <div>
                            <p className="font-medium text-sm">{account.name || account.platform}</p>
                            <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{account.followers || account.followers_count || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">followers</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground font-medium">No Connected Accounts</p>
                      <p className="text-sm text-muted-foreground">
                        Connect social media accounts in GoHighLevel Social Planner to see analytics.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Platform Performance
                </CardTitle>
                <CardDescription>Engagement metrics by social platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.socialAnalytics?.platformBreakdown &&
                   Object.keys(analytics.socialAnalytics.platformBreakdown).length > 0 ? (
                    Object.entries(analytics.socialAnalytics.platformBreakdown).map(([platform, metrics]: [string, any]) => (
                      <div key={platform} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              platform.toLowerCase().includes('facebook') ? 'bg-blue-500' :
                              platform.toLowerCase().includes('instagram') ? 'bg-purple-500' :
                              platform.toLowerCase().includes('linkedin') ? 'bg-blue-700' :
                              platform.toLowerCase().includes('twitter') ? 'bg-sky-500' :
                              'bg-gray-500'
                            }`}></div>
                            <span className="text-sm font-medium capitalize">{platform}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{metrics.engagement || 0}</span>
                            <Badge variant="secondary" className="text-xs">
                              {metrics.posts || 0} posts
                            </Badge>
                          </div>
                        </div>
                        {metrics.posts > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                platform.toLowerCase().includes('facebook') ? 'bg-blue-500' :
                                platform.toLowerCase().includes('instagram') ? 'bg-purple-500' :
                                platform.toLowerCase().includes('linkedin') ? 'bg-blue-700' :
                                platform.toLowerCase().includes('twitter') ? 'bg-sky-500' :
                                'bg-gray-500'
                              }`}
                              style={{
                                width: `${Math.min(100, ((metrics.engagement || 0) / (metrics.posts || 1)) * 10)}%`
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground font-medium">No Platform Data Available</p>
                      <p className="text-sm text-muted-foreground">
                        Platform-specific analytics will appear once accounts are connected and posts are published.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 📈 SOCIAL MEDIA INSIGHTS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Social Media Insights
              </CardTitle>
              <CardDescription>Key performance indicators and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {analytics.socialAnalytics?.summary?.totalPosts && analytics.socialAnalytics.summary.totalEngagement ?
                      ((analytics.socialAnalytics.summary.totalEngagement / analytics.socialAnalytics.summary.totalPosts) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Engagement Rate</p>
                  <p className="text-xs text-green-600 mt-1">
                    {analytics.socialAnalytics?.summary?.totalEngagement || 0} total engagements
                  </p>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {analytics.socialAnalytics?.accounts?.length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Platforms</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {analytics.socialAnalytics?.accounts?.filter((acc: any) => acc.status === 'connected').length || 0} connected
                  </p>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-2">
                    {(() => {
                      const totalPosts = analytics.socialAnalytics?.summary?.totalPosts || 0;
                      const days = socialTimeFilter === 'all' ? 365 : parseInt(socialTimeFilter); // Use 365 for "all time" avg
                      return totalPosts ? Math.round((totalPosts / days) * 10) / 10 : 0;
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Posts/Day</p>
                  <p className="text-xs text-purple-600 mt-1">
                    {analytics.socialAnalytics?.summary?.totalPosts || 0} posts in {socialTimeFilter === 'all' ? 'all time' : `${socialTimeFilter} days`}
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              {analytics.socialAnalytics?.summary && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {analytics.socialAnalytics.summary.totalAccounts === 0 && (
                      <li>• Connect social media accounts in GoHighLevel Social Planner</li>
                    )}
                    {analytics.socialAnalytics.summary.averageEngagementRate < 2 && analytics.socialAnalytics.summary.totalPosts > 0 && (
                      <li>• Consider optimizing post content and timing for better engagement</li>
                    )}
                    {analytics.socialAnalytics.summary.totalPosts < 5 && (
                      <li>• Increase posting frequency to build audience and engagement</li>
                    )}
                    <li>• Use analytics to identify best-performing content types and posting times</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-8">
          <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
            <CardContent>
              {/* Pipeline content will be added here */}

              {/* Recent Pipeline Activity Section */}
              {analytics.pipelines && analytics.pipelines.length > 0 && (
                <div className="p-6 border-b border-gray-200 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Pipeline Activity
                    </h3>

                    {/* Filter Controls */}
                    <div className="flex items-center gap-3">
                      {/* Date Range Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Time:</span>
                        <select
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                          value={pipelineTimeFilter}
                          onChange={(e) => setPipelineTimeFilter(e.target.value)}
                        >
                          <option value="7">Last 7 days</option>
                          <option value="30">Last 30 days</option>
                          <option value="90">Last 90 days</option>
                          <option value="all">All time</option>
                        </select>
                      </div>

                      {/* Pipeline Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Pipelines:</span>
                        <select
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                          value={pipelineFilter}
                          onChange={(e) => setPipelineFilter(e.target.value)}
                        >
                          <option value="all">All Pipelines</option>
                          <option value="active">Active Only</option>
                          <option value="high-stage">High Stage</option>
                          <option value="low-stage">Low Stage</option>
                        </select>
                      </div>

                      {/* Activity Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Activity:</span>
                        <select
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
                          value={activityFilter}
                          onChange={(e) => setActivityFilter(e.target.value)}
                        >
                          <option value="all">All Activity</option>
                          <option value="new-opportunities">New Opportunities</option>
                          <option value="stage-changes">Stage Changes</option>
                          <option value="high-activity">High Activity</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">
                        New {pipelineTimeFilter === 'all' ? 'This Year' : `This ${pipelineTimeFilter} Days`}
                      </div>
                      <div className="text-xl font-bold text-blue-700">
                        {(() => {
                          switch (pipelineTimeFilter) {
                            case '7':
                              return analytics.pipelineActivityDetails?.summary?.newOpportunities7Days || 0;
                            case '30':
                              return analytics.pipelineActivityDetails?.summary?.newOpportunities30Days || 0;
                            case '90':
                              return analytics.pipelineActivityDetails?.summary?.totalOpportunities || 0;
                            case 'all':
                              return analytics.pipelineActivityDetails?.summary?.totalOpportunities || 0;
                            default:
                              return analytics.pipelineActivityDetails?.summary?.newOpportunities7Days || 0;
                          }
                        })()}
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Active Pipelines</div>
                      <div className="text-xl font-bold text-green-700">{analytics.pipelines?.length || 0}</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-sm text-purple-600 font-medium">Stage Changes</div>
                      <div className="text-xl font-bold text-purple-700">{analytics.pipelineActivityDetails?.summary?.recentStageChanges || 0}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="text-sm text-orange-600 font-medium">Total Opportunities</div>
                      <div className="text-xl font-bold text-orange-700">{analytics.pipelineActivityDetails?.summary?.totalOpportunities || 0}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual Pipeline Cards */}
              {analytics.pipelines && analytics.pipelines.length > 0 ? (
                <div className="space-y-4">
                  {analytics.pipelines
                    .filter(pipeline => {
                      // Apply pipeline filter
                      if (pipelineFilter === 'active') {
                        const activity = analytics.pipelineActivityDetails?.pipelineActivity?.[pipeline.id];
                        return activity && activity.totalOpportunities > 0;
                      }
                      if (pipelineFilter === 'high-stage') {
                        const activity = analytics.pipelineActivityDetails?.pipelineActivity?.[pipeline.id];
                        return activity && activity.totalOpportunities > 5;
                      }
                      if (pipelineFilter === 'low-stage') {
                        const activity = analytics.pipelineActivityDetails?.pipelineActivity?.[pipeline.id];
                        return activity && activity.totalOpportunities <= 5;
                      }
                      return true;
                    })
                    .map((pipeline) => {
                      const activity = analytics.pipelineActivityDetails?.pipelineActivity?.[pipeline.id] || {
                        totalOpportunities: 0,
                        newThisWeek: 0,
                        newThisMonth: 0,
                        recentStageChanges: 0,
                        velocity: 0,
                        lastActivity: null
                      };

                      // Determine activity status
                      let activityStatus = 'quiet';
                      let activityBadgeColor = 'bg-gray-100 text-gray-700';
                      if (activity.newThisWeek > 5) {
                        activityStatus = 'hot';
                        activityBadgeColor = 'bg-red-100 text-red-700';
                      } else if (activity.newThisWeek > 2) {
                        activityStatus = 'active';
                        activityBadgeColor = 'bg-green-100 text-green-700';
                      } else if (activity.totalOpportunities > 0) {
                        activityStatus = 'growing';
                        activityBadgeColor = 'bg-blue-100 text-blue-700';
                      }

                      return (
                        <Card key={pipeline.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                                  <CardDescription className="text-sm">
                                    {activity.totalOpportunities} opportunities • {pipeline.stages?.length || 0} stages
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${activityBadgeColor}`}>
                                  {activityStatus.toUpperCase()}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePipeline(pipeline.id)}
                                  disabled={loadingPipelineDetails[pipeline.id]}
                                >
                                  {loadingPipelineDetails[pipeline.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : expandedPipelines.has(pipeline.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="pt-0">
                            {/* Activity Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">{activity.newThisWeek}</div>
                                <div className="text-xs text-muted-foreground">New this week</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-green-600">{activity.recentStageChanges}</div>
                                <div className="text-xs text-muted-foreground">Stage changes</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-600">{activity.velocity || 0}d</div>
                                <div className="text-xs text-muted-foreground">Avg velocity</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-orange-600">${activity.totalOpportunities > 0 ? ((analytics.pipelineAnalysis?.totalValue || 0) / activity.totalOpportunities / 1000).toFixed(0) : 0}K</div>
                                <div className="text-xs text-muted-foreground">Avg deal size</div>
                              </div>
                            </div>

                            {/* Expandable Stage Details */}
                            {expandedPipelines.has(pipeline.id) && pipeline.stages && (
                              <div className="border-t pt-4 mt-4">
                                <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                                  Stage Breakdown
                                </h4>
                                <div className="space-y-2">
                                  {pipeline.stages.map((stage, index) => {
                                    const stageData = analytics.pipelineAnalysis?.stages?.find(s => s.stage.toLowerCase() === stage.name.toLowerCase()) || {
                                      count: 0,
                                      value: 0,
                                      percentage: 0
                                    };

                                    return (
                                      <div key={stage.id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          <span className="text-sm font-medium">{stage.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span className="text-muted-foreground">{stageData.count} opps</span>
                                          <span className="text-muted-foreground">${(stageData.value / 1000).toFixed(0)}K</span>
                                          <span className="text-muted-foreground">{stageData.percentage}%</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pipelines Found</h3>
                    <p className="text-gray-600">
                      Create pipelines in GoHighLevel to track your sales process and opportunities.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Deal Size Distribution Analysis */}
              {(() => {
                const dealSizeData = calculateDealSizeDistribution();
                const totalDeals = dealSizeData.small.count + dealSizeData.medium.count +
                                 dealSizeData.large.count + dealSizeData.enterprise.count;

                if (totalDeals === 0) return null;

                return (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <DollarSign className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Deal Size Distribution
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Understand your revenue distribution across different deal value segments.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-700">Small</span>
                            </div>
                            <div className="text-lg font-bold text-blue-600">{dealSizeData.small.count}</div>
                            <div className="text-xs text-gray-500">&lt;$5K deals</div>
                            <div className="text-xs text-blue-600 mt-1">{dealSizeData.small.percentage}% of pipeline</div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-700">Medium</span>
                            </div>
                            <div className="text-lg font-bold text-green-600">{dealSizeData.medium.count}</div>
                            <div className="text-xs text-gray-500">$5K-$25K deals</div>
                            <div className="text-xs text-green-600 mt-1">{dealSizeData.medium.percentage}% of pipeline</div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-700">Large</span>
                            </div>
                            <div className="text-lg font-bold text-purple-600">{dealSizeData.large.count}</div>
                            <div className="text-xs text-gray-500">$25K-$100K deals</div>
                            <div className="text-xs text-purple-600 mt-1">{dealSizeData.large.percentage}% of pipeline</div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-700">Enterprise</span>
                            </div>
                            <div className="text-lg font-bold text-red-600">{dealSizeData.enterprise.count}</div>
                            <div className="text-xs text-gray-500">$100K+ deals</div>
                            <div className="text-xs text-red-600 mt-1">{dealSizeData.enterprise.percentage}% of pipeline</div>
                          </div>
                        </div>

                        {/* Revenue breakdown */}
                        <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">Revenue Distribution</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Small Deals</div>
                              <div className="font-medium text-blue-600">${((dealSizeData.small.value || 0) / 1000).toFixed(0)}K</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Medium Deals</div>
                              <div className="font-medium text-green-600">${((dealSizeData.medium.value || 0) / 1000).toFixed(0)}K</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Large Deals</div>
                              <div className="font-medium text-purple-600">${((dealSizeData.large.value || 0) / 1000).toFixed(0)}K</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Enterprise</div>
                              <div className="font-medium text-red-600">${((dealSizeData.enterprise.value || 0) / 1000).toFixed(0)}K</div>
                            </div>
                          </div>
                        </div>

                        {dealSizeData.small.percentage > 70 && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              <strong>⚠️ Deal Size Alert:</strong> {dealSizeData.small.percentage}% of your pipeline consists of small deals (&lt;$5K).
                              Consider focusing on larger opportunities for better revenue growth.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Stage Bottleneck Detection Alert */}
              {(() => {
                const bottleneckData = detectStageBottlenecks();
                if (!bottleneckData.hasBottlenecks) return null;

                return (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-8 w-8 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Pipeline Bottlenecks Detected
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          These stages are causing delays in your sales process. Deals are spending too much time here.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {bottleneckData.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 border border-orange-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 truncate">{bottleneck.stage}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  bottleneck.severity === 'critical'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {bottleneck.severity}
                                </span>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex justify-between">
                                  <span>Days stuck:</span>
                                  <span className="font-medium text-orange-600">{bottleneck.daysStuck}d</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Opportunities:</span>
                                  <span className="font-medium">{bottleneck.opportunitiesAffected}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Value at risk:</span>
                                  <span className="font-medium">${((bottleneck.valueAtRisk || 0) / 1000).toFixed(0)}K</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {bottleneckData.bottlenecks.length > 3 && (
                          <p className="text-sm text-gray-500 mt-4">
                            +{bottleneckData.bottlenecks.length - 3} more bottlenecks detected
                          </p>
                        )}

                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Recommendation:</strong> Focus on moving deals out of the slowest stage ({bottleneckData.slowestStage?.stage}) to improve overall pipeline velocity.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Enhanced Aging Analysis */}
              {analytics.pipelineAnalysis?.stages && analytics.pipelineAnalysis.stages.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Clock className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Opportunity Aging Analysis
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Detailed breakdown of deal age distribution and potential stagnation risks.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {analytics.pipelineAnalysis.agingOpportunities || 0}
                            </div>
                            <p className="text-sm text-muted-foreground">30+ Days Old</p>
                            <div className="text-xs text-red-600 mt-1">
                              {analytics.pipelineAnalysis.stages ? Math.round((analytics.pipelineAnalysis.agingOpportunities || 0) / analytics.pipelineAnalysis.totalOpportunities * 100) : 0}% of pipeline
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                              {Math.round(analytics.pipelineAnalysis.stages?.reduce((sum, stage) => sum + (stage.count * 0.6), 0) || 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">15-30 Days Old</p>
                            <div className="text-xs text-yellow-600 mt-1">Monitor closely</div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {Math.round(analytics.pipelineAnalysis.stages?.reduce((sum, stage) => sum + (stage.count * 0.3), 0) || 0)}
                            </div>
                            <p className="text-sm text-muted-foreground">&lt;15 Days Old</p>
                            <div className="text-xs text-green-600 mt-1">Healthy pipeline</div>
                          </div>
                        </div>
                      </div>

                      {(analytics.pipelineAnalysis.agingOpportunities || 0) > 5 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            <strong>🚨 Aging Alert:</strong> {analytics.pipelineAnalysis.agingOpportunities} opportunities are over 30 days old.
                            Consider following up or re-qualifying these deals.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stage Conversion Rates Analysis */}
              {(() => {
                const conversionRates = calculateStageConversionRates();
                if (conversionRates.length === 0) return null;

                return (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <TrendingUp className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Stage Conversion Analysis
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Track how effectively deals move between pipeline stages and identify conversion bottlenecks.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {conversionRates.map((conversion, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 border border-blue-200">
                              <div className="text-sm text-gray-600 mb-2">
                                <span className="font-medium text-blue-700">{conversion.fromStage}</span>
                                <span className="mx-1">→</span>
                                <span className="font-medium text-blue-700">{conversion.toStage}</span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">Conversion Rate:</span>
                                  <span className={`text-sm font-bold ${
                                    conversion.conversionRate >= 70 ? 'text-green-600' :
                                    conversion.conversionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {conversion.conversionRate}%
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">Drop-off:</span>
                                  <span className={`text-sm font-bold ${
                                    conversion.dropOffRate <= 20 ? 'text-green-600' :
                                    conversion.dropOffRate <= 40 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {conversion.dropOffRate}%
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">Flow:</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {conversion.opportunitiesIn} → {conversion.opportunitiesOut}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {conversionRates.some(c => c.conversionRate < 50) && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              <strong>⚠️ Attention needed:</strong> Some stages have conversion rates below 50%.
                              Consider reviewing your qualification process or sales approach.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Revenue Forecasting */}
              {analytics.pipelineAnalysis?.stages && analytics.pipelineAnalysis.stages.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Revenue Forecasting
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Projected revenue based on current pipeline stage distribution and historical conversion rates.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-600">
                              ${((analytics.pipelineAnalysis.totalValue || 0) * 0.3 / 1000).toFixed(0)}K
                            </div>
                            <p className="text-sm text-muted-foreground">Conservative (30% win rate)</p>
                            <div className="text-xs text-emerald-600 mt-1">Next 3 months</div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              ${((analytics.pipelineAnalysis.totalValue || 0) * 0.5 / 1000).toFixed(0)}K
                            </div>
                            <p className="text-sm text-muted-foreground">Realistic (50% win rate)</p>
                            <div className="text-xs text-blue-600 mt-1">Next 3 months</div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              ${((analytics.pipelineAnalysis.totalValue || 0) * 0.7 / 1000).toFixed(0)}K
                            </div>
                            <p className="text-sm text-muted-foreground">Optimistic (70% win rate)</p>
                            <div className="text-xs text-purple-600 mt-1">Next 3 months</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-white rounded-lg border border-emerald-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Forecast Breakdown by Stage</h4>
                        <div className="space-y-2">
                          {analytics.pipelineAnalysis.stages?.slice(0, 4).map((stage, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium">{stage.stage}</span>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">{stage.count} deals</span>
                                <span className="font-medium text-emerald-600">${(stage.value / 1000).toFixed(0)}K potential</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <ActivityDashboard analytics={analytics} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className={`h-5 w-5 ${analytics.revenueMetrics?.disabled ? 'text-gray-400' : 'text-green-500'}`} />
                Revenue Analytics
                {analytics.revenueMetrics?.disabled && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    DISABLED
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.revenueMetrics?.disabled ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                  <div className="text-amber-800 font-semibold mb-2 text-lg">Revenue Analytics Disabled</div>
                  <div className="text-sm text-amber-700 mb-3">
                    Revenue data is manually entered by humans and may contain inaccuracies that could skew all analytics.
                  </div>
                  <div className="text-xs text-amber-600 bg-amber-100 p-2 rounded">
                    This feature has been disabled to ensure data integrity. Contact administrator if re-enabling is needed.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">${(analytics.revenueMetrics?.totalRevenue || 0).toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">${(analytics.revenueMetrics?.avgDealSize || 0).toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{analytics.revenueMetrics?.winRate || 0}%</div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-8">
          {/* 🎯 PERFORMANCE AT A GLANCE */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Performance Overview
              </CardTitle>
              <CardDescription>How your forms and surveys are performing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{analytics.formsData?.totalForms || 0}</div>
                  <p className="text-sm text-muted-foreground">Active Forms</p>
                  <div className="text-xs text-green-600 mt-1">↗️ {getTotalFormSubmissions()} submissions</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{analytics.surveysData?.totalSurveys || 0}</div>
                  <p className="text-sm text-muted-foreground">Active Surveys</p>
                  <div className="text-xs text-green-600 mt-1">↗️ {getTotalSurveyResponses()} responses</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${getOverallLeadQuality() >= 70 ? 'text-green-600' : getOverallLeadQuality() >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {getOverallLeadQuality()}%
                  </div>
                  <p className="text-sm text-muted-foreground">Lead Quality</p>
                  <div className="text-xs text-muted-foreground mt-1">Overall effectiveness</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${monitorRealTimePerformance().healthScore >= 70 ? 'text-green-600' : monitorRealTimePerformance().healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {monitorRealTimePerformance().healthScore}%
                  </div>
                  <p className="text-sm text-muted-foreground">System Health</p>
                  <div className="text-xs text-muted-foreground mt-1">{monitorRealTimePerformance().status}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 📊 CONVERSION METRICS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Conversion Metrics
                </CardTitle>
                <CardDescription>How well your forms convert visitors to leads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Form Conversion Rate</p>
                    <p className="text-sm text-muted-foreground">Submissions per contact</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {getTotalFormSubmissions() > 0 ?
                        Math.round((getTotalFormSubmissions() / Math.max(1, analytics.contacts || 1)) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">{getTotalFormSubmissions()} of {analytics.contacts || 0} contacts</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Form Completion Rate</p>
                    <p className="text-sm text-muted-foreground">Submissions per form</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {analytics.formsData?.totalForms && analytics.formsData.totalForms > 0 ?
                        Math.round((getTotalFormSubmissions() / analytics.formsData.totalForms) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">{getTotalFormSubmissions()} of {analytics.formsData?.totalForms || 0} forms</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Engagement Comparison</p>
                    <p className="text-sm text-muted-foreground">Forms vs Surveys performance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      {getFormsVsSurveysRatio()}%
                    </p>
                    <p className="text-xs text-muted-foreground">Forms lead generation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-orange-500" />
                  Real-Time Activity
                </CardTitle>
                <CardDescription>Current form submission patterns and insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key Activity Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-lg font-bold text-orange-600">{monitorRealTimePerformance().currentHourlyRate}</div>
                    <p className="text-xs text-muted-foreground">Last 60 Min</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-lg font-bold text-blue-600">{monitorRealTimePerformance().dailyAverageRate}</div>
                    <p className="text-xs text-muted-foreground">Hourly Avg</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-lg font-bold text-green-600">{analyzePeakUsageTimes().peakCount}</div>
                    <p className="text-xs text-muted-foreground">Peak Hour</p>
                  </div>
                </div>

                {/* Activity Insights */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Busiest Time</p>
                      <p className="text-xs text-muted-foreground">When forms perform best</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        {analyzePeakUsageTimes().peakHour > 12 ?
                          `${analyzePeakUsageTimes().peakHour - 12} PM` :
                          `${analyzePeakUsageTimes().peakHour === 0 ? 12 : analyzePeakUsageTimes().peakHour} AM`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">{analyzePeakUsageTimes().peakCount} submissions</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-700">Mobile Traffic</span>
                        <span className="text-xs font-bold text-purple-600">{analyzeDevicePerformance().mobile.percentage}%</span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{width: `${analyzeDevicePerformance().mobile.percentage}%`}}></div>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-indigo-700">Desktop Traffic</span>
                        <span className="text-xs font-bold text-indigo-600">{analyzeDevicePerformance().desktop.percentage}%</span>
                      </div>
                      <div className="w-full bg-indigo-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{width: `${analyzeDevicePerformance().desktop.percentage}%`}}></div>
                      </div>
                    </div>
                  </div>

                  {analyzeGeographicPerformance().length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-700">Top Performing Region</p>
                          <p className="text-xs text-muted-foreground">Highest submission volume</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{analyzeGeographicPerformance()[0].state}</p>
                          <p className="text-xs text-muted-foreground">{analyzeGeographicPerformance()[0].submissions} submissions</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Form Performance Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Form Load Performance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Load Performance</p>
                    <p className={`text-2xl font-bold ${
                      analyzeFormLoadPerformance().score >= 80 ? 'text-green-600' :
                      analyzeFormLoadPerformance().score >= 60 ? 'text-blue-600' :
                      analyzeFormLoadPerformance().score >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {analyzeFormLoadPerformance().score}%
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rating:</span>
                    <Badge variant="outline" className={
                      analyzeFormLoadPerformance().rating === 'Excellent' ? 'text-green-600 border-green-600' :
                      analyzeFormLoadPerformance().rating === 'Good' ? 'text-blue-600 border-blue-600' :
                      analyzeFormLoadPerformance().rating === 'Fair' ? 'text-yellow-600 border-yellow-600' :
                      'text-red-600 border-red-600'
                    }>
                      {analyzeFormLoadPerformance().rating}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Abandonment Risk Analysis */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Abandonment Risk</p>
                    <p className={`text-2xl font-bold ${
                      calculateAbandonmentRisk().risk === 'low' ? 'text-green-600' :
                      calculateAbandonmentRisk().risk === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {calculateAbandonmentRisk().score}%
                    </p>
                  </div>
                  <AlertTriangle className={`h-8 w-8 ${
                    calculateAbandonmentRisk().risk === 'low' ? 'text-green-500' :
                    calculateAbandonmentRisk().risk === 'medium' ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Risk Level:</span>
                    <span className={`font-medium ${
                      calculateAbandonmentRisk().risk === 'low' ? 'text-green-600' :
                      calculateAbandonmentRisk().risk === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {calculateAbandonmentRisk().risk.toUpperCase()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Complexity Analysis */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Form Complexity</p>
                    <p className={`text-2xl font-bold ${
                      analyzeFormComplexity().overallComplexity === 'Low' ? 'text-green-600' :
                      analyzeFormComplexity().overallComplexity === 'Medium' ? 'text-blue-600' : 'text-purple-600'
                    }`}>
                      {analyzeFormComplexity().score}%
                    </p>
                  </div>
                  <Layers className="h-8 w-8 text-purple-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Level:</span>
                    <Badge variant="outline" className="text-purple-600 border-purple-600">
                      {analyzeFormComplexity().overallComplexity}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real-time Performance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Submission Health</p>
                    <p className={`text-2xl font-bold ${
                      monitorRealTimePerformance().healthScore >= 80 ? 'text-green-600' :
                      monitorRealTimePerformance().healthScore >= 60 ? 'text-blue-600' :
                      monitorRealTimePerformance().healthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {monitorRealTimePerformance().healthScore}%
                    </p>
                  </div>
                  <Activity className={`h-8 w-8 ${
                    monitorRealTimePerformance().status === 'Excellent' ? 'text-green-500' :
                    monitorRealTimePerformance().status === 'Good' ? 'text-blue-500' :
                    monitorRealTimePerformance().status === 'Fair' ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`font-medium ${
                      monitorRealTimePerformance().status === 'Excellent' ? 'text-green-600' :
                      monitorRealTimePerformance().status === 'Good' ? 'text-blue-600' :
                      monitorRealTimePerformance().status === 'Fair' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {monitorRealTimePerformance().status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Forms & Surveys Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Survey Performance Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Survey Analytics
                </CardTitle>
                <CardDescription>
                  Response rates and completion metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">
                      {getTotalSurveyResponses()}
                    </div>
                    <p className="text-xs text-muted-foreground">Total Responses</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">
                      {analytics.surveysData?.totalSurveys && analytics.surveysData.totalSurveys > 0 ?
                        Math.round((getTotalSurveyResponses() / analytics.surveysData.totalSurveys) * 100) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Response Rate</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Survey Engagement:</span>
                    <span className={`font-medium ${getSurveyEngagementRate() > 50 ? 'text-green-600' : getSurveyEngagementRate() > 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {getSurveyEngagementRate()}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg Responses/Survey:</span>
                    <span className="font-medium text-purple-600">
                      {analytics.surveysData?.totalSurveys && analytics.surveysData.totalSurveys > 0 ?
                        (getTotalSurveyResponses() / analytics.surveysData.totalSurveys).toFixed(1) : '0.0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forms Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Forms Performance
                </CardTitle>
                <CardDescription>
                  Real conversion metrics and performance data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {getFormConversionEfficiency()}%
                  </div>
                  <p className="text-sm text-muted-foreground">Form Conversion Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on total contacts vs submissions
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Submissions:</span>
                    <span className="font-medium text-blue-600">{getTotalFormSubmissions()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Forms:</span>
                    <span className="font-medium text-green-600">{analytics.formsData?.totalForms || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg Submissions/Form:</span>
                    <span className="font-medium text-purple-600">
                      {analytics.formsData?.totalForms && analytics.formsData.totalForms > 0 ?
                        (getTotalFormSubmissions() / analytics.formsData.totalForms).toFixed(1) : '0.0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Health Monitoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Geographic Performance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Geographic Performance</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {analyzeGeographicPerformance().length > 0 ? analyzeGeographicPerformance()[0].state : 'N/A'}
                    </p>
                  </div>
                  <MapPin className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">Top State:</span>
                    <span className="text-muted-foreground">
                      {analyzeGeographicPerformance().length > 0 ? `${analyzeGeographicPerformance()[0].submissions} submissions` : 'No data'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Spam Detection */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Spam Protection</p>
                    <p className={`text-2xl font-bold ${detectSpamSubmissions().spamRate > 10 ? 'text-red-600' : detectSpamSubmissions().spamRate > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {detectSpamSubmissions().spamRate}%
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Clean submissions:</span>
                    <span className="font-medium text-green-600">{detectSpamSubmissions().clean}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Duplicate Detection */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duplicate Detection</p>
                    <p className={`text-2xl font-bold ${detectDuplicateSubmissions().duplicateRate > 15 ? 'text-red-600' : detectDuplicateSubmissions().duplicateRate > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {detectDuplicateSubmissions().duplicateRate}%
                    </p>
                  </div>
                  <Copy className="h-8 w-8 text-orange-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Unique leads:</span>
                    <span className="font-medium text-blue-600">{detectDuplicateSubmissions().unique}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Performance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Device Performance</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {analyzeDevicePerformance().mobile.percentage}%
                    </p>
                  </div>
                  <Smartphone className="h-8 w-8 text-purple-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Mobile submissions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Health Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Geographic Breakdown */}
            {analyzeGeographicPerformance().length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    Geographic Performance
                  </CardTitle>
                  <CardDescription>Form submissions by state</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyzeGeographicPerformance().map((item, index) => (
                      <div key={item.state} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-600">{item.state}</span>
                          <Badge variant="outline" className="text-xs">
                            Quality: {item.avgQuality}/3
                          </Badge>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{item.submissions}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Peak Usage Times */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-500" />
                  Peak Usage Analysis
                </CardTitle>
                <CardDescription>When forms perform best</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">
                      {analyzePeakUsageTimes().peakHour}:00
                    </div>
                    <p className="text-sm text-muted-foreground">Peak Hour</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analyzePeakUsageTimes().peakCount} submissions
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>

          {/* 🛡️ HEALTH & QUALITY MONITORING */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Health & Quality Monitoring
              </CardTitle>
              <CardDescription>Data quality, spam protection, and system health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className={`text-2xl font-bold mb-1 ${
                    detectSpamSubmissions().spamRate <= 5 ? 'text-green-600' :
                    detectSpamSubmissions().spamRate <= 15 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {detectSpamSubmissions().spamRate}%
                  </div>
                  <p className="text-sm font-medium text-gray-900">Spam Rate</p>
                  <p className="text-xs text-muted-foreground">{detectSpamSubmissions().clean} clean submissions</p>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className={`text-2xl font-bold mb-1 ${
                    detectDuplicateSubmissions().duplicateRate <= 5 ? 'text-green-600' :
                    detectDuplicateSubmissions().duplicateRate <= 15 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {detectDuplicateSubmissions().duplicateRate}%
                  </div>
                  <p className="text-sm font-medium text-gray-900">Duplicate Rate</p>
                  <p className="text-xs text-muted-foreground">{detectDuplicateSubmissions().unique} unique leads</p>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {analyzeFormComplexity().overallComplexity}
                  </div>
                  <p className="text-sm font-medium text-gray-900">Form Complexity</p>
                  <p className="text-xs text-muted-foreground">{analyzeFormComplexity().score}% complexity score</p>
                </div>

                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className={`text-2xl font-bold mb-1 ${
                    calculateAbandonmentRisk().risk === 'low' ? 'text-green-600' :
                    calculateAbandonmentRisk().risk === 'medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {calculateAbandonmentRisk().risk.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-gray-900">Abandonment Risk</p>
                  <p className="text-xs text-muted-foreground">{calculateAbandonmentRisk().score}% risk score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Field Completion Analytics */}
          {calculateFieldCompletionAnalytics() && calculateFieldCompletionAnalytics().length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-indigo-500" />
                  Field Completion Analytics
                </CardTitle>
                <CardDescription>
                  Form completion rates and data quality insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calculateFieldCompletionAnalytics().slice(0, 3).filter((form): form is NonNullable<typeof form> => form !== null).map((form) => (
                    <div key={form.formId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{form.formName}</h4>
                        <p className="text-sm text-muted-foreground">{form.submissions} submissions</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-indigo-600">{form.avgCompletionRate}%</div>
                        <Badge variant="outline" className={
                          form.completenessScore === 'High' ? 'text-green-600 border-green-600' :
                          form.completenessScore === 'Medium' ? 'text-yellow-600 border-yellow-600' :
                          'text-red-600 border-red-600'
                        }>
                          {form.completenessScore}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Performing Forms */}
          {analytics.formsData?.forms && analytics.formsData.forms.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Performing Forms
                </CardTitle>
                <CardDescription>
                  Forms ranked by submission volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.formsData.forms
                    .sort((a, b) => {
                      // Sort by submission count (we'll calculate this)
                      const aSubmissions = analytics.formsSubmissions?.submissions?.filter(s => s.formId === a.id).length || 0;
                      const bSubmissions = analytics.formsSubmissions?.submissions?.filter(s => s.formId === b.id).length || 0;
                      return bSubmissions - aSubmissions;
                    })
                    .slice(0, 3) // Show top 3
                    .map((form, index) => {
                      const submissionCount = analytics.formsSubmissions?.submissions?.filter(s => s.formId === form.id).length || 0;
                      const trophyColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

                      return (
                        <div key={form.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 ${
                              index === 0 ? 'border-yellow-400' : index === 1 ? 'border-gray-300' : 'border-amber-400'
                            }`}>
                              {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                              {index === 1 && <span className="text-xs font-bold text-gray-500">2</span>}
                              {index === 2 && <span className="text-xs font-bold text-amber-600">3</span>}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{form.name}</h4>
                              <p className="text-sm text-muted-foreground">ID: {form.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">{submissionCount}</div>
                            <p className="text-xs text-muted-foreground">submissions</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Forms List */}
          {analytics.formsData?.forms && analytics.formsData.forms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  All Forms
                </CardTitle>
                <CardDescription>
                  Complete list of forms with submission metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.formsData.forms.map((form) => {
                    const submissionCount = analytics.formsSubmissions?.submissions?.filter(s => s.formId === form.id).length || 0;

                    // Find most recent submission for this form
                    const formSubmissions = analytics.formsSubmissions?.submissions?.filter(s => s.formId === form.id) || [];
                    const lastActivity = formSubmissions.length > 0
                      ? new Date(Math.max(...formSubmissions.map(s => new Date(s.createdAt || new Date().toISOString()).getTime())))
                      : null;

                    // Debug: Log the actual dates being processed
                    if (formSubmissions.length > 0 && lastActivity) {
                      console.log(`📊 Form "${form.name}": ${formSubmissions.length} submissions, Last activity: ${lastActivity.toISOString()}, Relative time: ${formatRelativeTime(lastActivity)}`);
                    }

                    return (
                      <div
                        key={form.id}
                        className="p-4 border border-gray-200 rounded-lg bg-white"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 truncate flex-1">{form.name}</h4>
                          <Badge variant="outline" className="text-xs ml-2">
                            Active
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Submissions:</span>
                            <span className="font-medium text-blue-600">{submissionCount}</span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Form ID:</span>
                            <span className="font-mono text-xs text-muted-foreground">{form.id}</span>
                          </div>

                          {/* Add Last Activity */}
                          {lastActivity && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Last Activity:</span>
                              <span className="font-medium text-green-600">
                                {formatRelativeTime(lastActivity)}
                              </span>
                            </div>
                          )}
                        </div>

                        {submissionCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFormClick(form)}
                            disabled={loadingFormDetails}
                            className="w-full mt-3"
                          >
                            {loadingFormDetails ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                View Submissions
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Performing Surveys */}
          {analytics.surveysData?.surveys && analytics.surveysData.surveys.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-purple-500" />
                  Top Performing Surveys
                </CardTitle>
                <CardDescription>
                  Surveys ranked by response volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.surveysData.surveys
                    .sort((a, b) => {
                      // Sort by response count (we'll calculate this)
                      const aResponses = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === a.id).length || 0;
                      const bResponses = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === b.id).length || 0;
                      return bResponses - aResponses;
                    })
                    .slice(0, 3) // Show top 3
                    .map((survey, index) => {
                      const responseCount = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === survey.id).length || 0;
                      const trophyColors = ['text-purple-500', 'text-gray-400', 'text-indigo-600'];

                      return (
                        <div key={survey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 ${
                              index === 0 ? 'border-purple-400' : index === 1 ? 'border-gray-300' : 'border-indigo-400'
                            }`}>
                              {index === 0 && <Trophy className="h-4 w-4 text-purple-500" />}
                              {index === 1 && <span className="text-xs font-bold text-gray-500">2</span>}
                              {index === 2 && <span className="text-xs font-bold text-indigo-600">3</span>}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{survey.name}</h4>
                              <p className="text-sm text-muted-foreground">ID: {survey.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">{responseCount}</div>
                            <p className="text-xs text-muted-foreground">responses</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Surveys List */}
          {analytics.surveysData?.surveys && analytics.surveysData.surveys.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  All Surveys
                </CardTitle>
                <CardDescription>
                  Complete list of surveys with response metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.surveysData.surveys.map((survey) => {
                    const responseCount = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === survey.id).length || 0;

                    // Find most recent response for this survey
                    const surveyResponses = analytics.surveysSubmissions?.submissions?.filter(r => r.surveyId === survey.id) || [];
                    const lastActivity = surveyResponses.length > 0
                      ? new Date(Math.max(...surveyResponses.map(r => new Date(r.submittedAt || r.createdAt || new Date().toISOString()).getTime())))
                      : null;

                    return (
                      <div
                        key={survey.id}
                        className="p-4 border border-gray-200 rounded-lg bg-white"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 truncate flex-1">{survey.name}</h4>
                          <Badge variant="outline" className="text-xs ml-2">
                            Active
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Responses:</span>
                            <span className="font-medium text-purple-600">{responseCount}</span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Survey ID:</span>
                            <span className="font-mono text-xs text-muted-foreground">{survey.id}</span>
                          </div>

                          {/* Add Last Activity */}
                          {lastActivity && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Last Activity:</span>
                              <span className="font-medium text-green-600">
                                {formatRelativeTime(lastActivity)}
                              </span>
                            </div>
                          )}
                        </div>

                        {responseCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSurveyClick(survey)}
                            disabled={loadingSurveyDetails}
                            className="w-full mt-3"
                          >
                            {loadingSurveyDetails ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                View Responses
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Forms/Surveys Message */}
          {(!analytics.formsData?.forms || analytics.formsData.forms.length === 0) &&
           (!analytics.surveysData?.surveys || analytics.surveysData.surveys.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Forms or Surveys Found</h3>
                <p className="text-gray-600">
                  Create forms and surveys in GoHighLevel to track leads and gather customer feedback.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="funnels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Marketing Funnels
              </CardTitle>
              <CardDescription>
                Track conversion funnels, lead nurturing paths, and marketing automation performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.funnelsData ? (
                <div className="space-y-6">
                  {/* Funnel Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Official GHL Funnels</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">
                          {analytics.funnelsData.apiStatus?.officialApiAvailable ?
                            analytics.funnelsData.funnels.filter((f: any) => f.source === 'ghl_official').length : 0}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Analytics Funnels</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">
                          {analytics.funnelsData?.funnels?.filter((f: any) => f.source === 'custom_analytics').length || 0}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Avg Win Rate</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">
                          {analytics.funnelsData.summary?.avgWinRate || 0}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>


                  {/* Funnel List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Available Funnels</h3>

                    {analytics.funnelsData?.funnels?.length > 0 ? (
                      <div className="grid gap-4">
                        {analytics.funnelsData.funnels.map((funnel: any, index: number) => (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold">{funnel.name}</h4>
                                    {funnel.status && (
                                      <Badge variant="outline" className={`capitalize ${
                                        funnel.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                                        funnel.status === 'processing' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                                      }`}>
                                        {funnel.status}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Type:</span>
                                      <Badge variant="outline" className="capitalize">{funnel.type}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Steps:</span>
                                      <span className="font-semibold">{funnel.steps?.length || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Updated:</span>
                                      <span className="text-sm">
                                        {funnel.lastUpdated ? new Date(funnel.lastUpdated).toLocaleDateString() : 'Unknown'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Additional features */}
                                  <div className="flex gap-2 mt-3">
                                    {funnel.hasChatWidget && (
                                      <Badge variant="outline" className="text-xs">
                                        <MessageCircle className="h-3 w-3 mr-1" />
                                        Live Chat
                                      </Badge>
                                    )}
                                    {funnel.hasStore && (
                                      <Badge variant="outline" className="text-xs">
                                        <ShoppingCart className="h-3 w-3 mr-1" />
                                        Store
                                      </Badge>
                                    )}
                                    {funnel.type === 'website' && (
                                      <Badge variant="outline" className="text-xs">
                                        🌐 Website
                                      </Badge>
                                    )}
                                    {funnel.type === 'funnel' && (
                                      <Badge variant="outline" className="text-xs">
                                        🎯 Marketing
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-2 ml-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedFunnel(funnel)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View Stages
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      setLoadingFunnelDetails(true)
                                      try {
                                        // FUNNEL SECTION: Check if it's actually a GHL website vs funnel
                                        // GHL websites (type: "website") should show website analytics, not funnel analytics
                                        const actualType = funnel.type === 'website' ? 'website' : 'funnel'

                                        console.log('🔍 Funnel section click:', {
                                          item: funnel,
                                          ghlType: funnel.type,
                                          determinedType: actualType,
                                          hasSteps: !!funnel.steps,
                                          name: funnel.name
                                        })

                                        setSelectedTrafficItem({
                                          type: actualType, // GHL websites show website analytics, GHL funnels show funnel analytics
                                          data: funnel
                                        })
                                      } finally {
                                        setLoadingFunnelDetails(false)
                                      }
                                    }}
                                    disabled={!analytics || loadingFunnelDetails}
                                  >
                                    {loadingFunnelDetails ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Loading...
                                      </>
                                    ) : (
                                      <>
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        View Traffic
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No Funnels Available</h3>
                          <p className="text-muted-foreground mb-4">
                            Funnels are not enabled on your GHL plan, require IAM configuration, or your API tokens may have expired.
                            Try re-authorizing your GHL connection or contact GHL Support.
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => window.location.href = '/api/oauth/start'}>
                              Re-authorize GHL
                            </Button>
                            <Button variant="outline">
                              Contact GHL Support
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading funnel data...</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* AI-Powered Location Insights */}
          <LocationAIInsights
            locationId={locationId}
            locationName={location?.name || 'Unknown Location'}
            analytics={analytics}
            pageData={{
              contacts: analytics.contacts,
              opportunities: analytics.opportunities,
              conversations: analytics.conversations,
              healthScore: analytics.healthScore,
              leadSources: analytics.leadSources,
              locationName: location?.name
            }}
          />
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-green-500" />
                Workflow Automation
              </CardTitle>
              <CardDescription>
                Marketing automation workflows and lead nurturing sequences for this location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analytics?.workflows ? (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Loading workflows...</p>
                </div>
              ) : (analytics?.workflows || []).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No workflows found for this location</p>
                  <p className="text-sm">Workflow automation will appear here once configured in GoHighLevel</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Workflow Overview Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold text-green-700">
                            {(analytics?.workflows || []).length.toLocaleString()}
                          </p>
                          <p className="text-sm text-green-600 font-medium">Total Workflows</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Play className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-2xl font-bold text-blue-700">
                            {(analytics?.workflows || []).filter(w => w.status === 'published').length.toLocaleString()}
                          </p>
                          <p className="text-sm text-blue-600 font-medium">Published</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2">
                        <Edit className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="text-2xl font-bold text-yellow-700">
                            {(analytics?.workflows || []).filter(w => w.status === 'draft').length.toLocaleString()}
                          </p>
                          <p className="text-sm text-yellow-600 font-medium">Draft</p>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Workflows List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">All Workflows</h3>
                    <div className="grid gap-3">
                      {(analytics.workflows || []).map((workflow, index) => (
                        <Card key={workflow.id || index} className="hover:shadow-sm transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <GitBranch className="h-5 w-5 text-green-600" />
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{workflow.name || `Workflow ${index + 1}`}</h4>
                                    <div className="text-xs text-gray-500 font-mono mt-1">
                                      ID: {workflow.id}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                  <div>
                                    <span className="font-medium">Version:</span> v{workflow.version || '1.0'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Status:</span> {workflow.status}
                                  </div>
                                  <div>
                                    <span className="font-medium">Created:</span> {workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString() : 'Unknown'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Updated:</span> {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString() : 'Unknown'}
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <Badge variant={workflow.status === 'published' ? 'default' : 'secondary'}>
                                  {workflow.status === 'published' ? 'Published' : workflow.status === 'draft' ? 'Draft' : workflow.status}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Survey Responses Modal */}
      {selectedSurvey && (
        <Dialog open={!!selectedSurvey} onOpenChange={() => setSelectedSurvey(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedSurvey.name} - Responses</DialogTitle>
              <DialogDescription>
                Detailed responses from your survey
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {responsesLoading ? (
                <div className="text-center py-8">Loading responses...</div>
              ) : surveyResponses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No responses found</div>
              ) : (
                <div className="space-y-4">
                  {surveyResponses.map((response: any, index: number) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{response.name || 'Anonymous'}</p>
                            <p className="text-sm text-gray-500">{response.email || 'No email'}</p>
                          </div>
                          <p className="text-sm text-gray-500">{formatDate(response.submittedAt || response.createdAt)}</p>
                        </div>
                        {response.answers && (
                          <div className="space-y-2">
                            {Object.entries(response.answers).map(([question, answer]: [string, any]) => (
                              <div key={question}>
                                <p className="text-sm font-medium text-gray-700">{question}</p>
                                <p className="text-sm text-gray-600">{String(answer)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {surveyResponses.length >= responsesPerPage && (
                    <div className="flex justify-between items-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setResponsesPage(prev => Math.max(1, prev - 1))}
                        disabled={responsesPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">Page {responsesPage}</span>
                      <Button
                        variant="outline"
                        onClick={() => setResponsesPage(prev => prev + 1)}
                        disabled={surveyResponses.length < responsesPerPage}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form Submissions Modal */}
      {selectedForm && (
        <Dialog open={!!selectedForm} onOpenChange={() => setSelectedForm(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedForm.name} - Submissions</DialogTitle>
              <DialogDescription>
                Detailed form submissions with timestamps
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {formSubmissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No submissions found</div>
              ) : (
                <div className="space-y-4">
                  {formSubmissions
                    .slice((submissionsPage - 1) * submissionsPerPage, submissionsPage * submissionsPerPage)
                    .map((submission: any, index: number) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{submission.name || 'Anonymous'}</p>
                            <p className="text-sm text-gray-500">Contact ID: {submission.contactId || 'N/A'}</p>
                          </div>
                          <p className="text-sm text-gray-500">{formatDate(submission.createdAt)}</p>
                        </div>
                        {submission.others && (
                          <div className="space-y-2">
                            {Object.entries(submission.others).map(([field, value]: [string, any]) => (
                              <div key={field}>
                                <p className="text-sm font-medium text-gray-700">{field}:</p>
                                <p className="text-sm text-gray-600">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400">Form ID: {submission.formId}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {formSubmissions.length >= submissionsPerPage && (
                    <div className="flex justify-between items-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setSubmissionsPage(prev => Math.max(1, prev - 1))}
                        disabled={submissionsPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {submissionsPage} of {Math.ceil(formSubmissions.length / submissionsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setSubmissionsPage(prev => prev + 1)}
                        disabled={submissionsPage >= Math.ceil(formSubmissions.length / submissionsPerPage)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Funnel Stages Modal */}
      {selectedFunnel && (
        <Dialog open={!!selectedFunnel} onOpenChange={() => setSelectedFunnel(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {selectedFunnel.name}
                <Badge variant={selectedFunnel.source === 'ghl_official' ? 'default' : 'secondary'}>
                  {selectedFunnel.source === 'ghl_official' ? 'Official GHL Funnel' : 'Analytics Funnel'}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedFunnel.source === 'ghl_official'
                  ? 'Official GHL funnel with marketing pages and automation'
                  : 'Analytics funnel built from pipeline stages and conversion data'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedFunnel.pageCount || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Pages</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedFunnel.steps?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Steps</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedFunnel.type === 'website' ? '🌐' : '🎯'}
                    </div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedFunnel.type}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedFunnel.status === 'active' ? '✅' : '⏸️'}
                    </div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedFunnel.status}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Funnel Steps Analysis */}
              {selectedFunnel.steps && selectedFunnel.steps.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Funnel Steps & Pages</h3>
                  <div className="space-y-3">
                    {selectedFunnel.steps.map((step: any, index: number) => (
                      <div key={step.id || index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Step {step.sequence}</Badge>
                            <h4 className="font-medium">{step.name}</h4>
                            {step.type && <Badge variant="secondary" className="text-xs">{step.type}</Badge>}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{step.pages?.length || 0} pages</Badge>
                            {step.controlTraffic && <Badge variant="outline">{step.controlTraffic}% traffic</Badge>}
                          </div>
                        </div>

                        {/* Step Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                          <div>Step URL: <span className="font-medium text-blue-600">{step.url}</span></div>
                          <div>Page IDs: <span className="font-medium">{step.pages?.join(', ') || 'None'}</span></div>
                        </div>

                        {/* Products (if any) */}
                        {step.products && step.products.length > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Products: </span>
                            <span className="font-medium">{step.products.length} configured</span>
                          </div>
                        )}

                        {/* Traffic Split (if applicable) */}
                        {step.split && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                            <span className="font-medium text-yellow-800">Traffic Split Active</span>
                            <span className="text-yellow-700 ml-2">Control: {step.controlTraffic}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Funnel Flow Visualization */}
                  <div className="mt-6">
                    <h4 className="text-md font-semibold mb-4">Funnel Flow</h4>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg overflow-x-auto">
                      {selectedFunnel.steps.map((step: any, index: number) => (
                        <div key={step.id || index} className="flex items-center flex-shrink-0">
                          <div className="text-center min-w-[120px]">
                            <div className="text-sm font-bold text-blue-600 bg-white px-2 py-1 rounded border">
                              Step {step.sequence}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 max-w-[100px] truncate" title={step.name}>
                              {step.name}
                            </div>
                            <div className="text-xs font-medium text-green-600 mt-1">
                              {step.pages?.length || 0} pages
                            </div>
                            {step.controlTraffic && (
                              <div className="text-xs text-purple-600 mt-1">
                                {step.controlTraffic}%
                              </div>
                            )}
                          </div>
                          {index < selectedFunnel.steps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-gray-400 mx-4 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Official Funnel Pages (if available) */}
              {selectedFunnel.source === 'ghl_official' && selectedFunnel.pages && selectedFunnel.pages.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Funnel Pages</h3>
                  <div className="grid gap-3">
                    {selectedFunnel.pages.map((page: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{page.name || `Page ${index + 1}`}</h4>
                              <p className="text-sm text-muted-foreground">{page.type || 'Marketing Page'}</p>
                            </div>
                            {page.url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={page.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Funnel Features & Capabilities */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Funnel Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Configuration</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Chat Widget</span>
                          <span className={`text-sm font-medium ${selectedFunnel.hasChatWidget ? 'text-green-600' : 'text-gray-400'}`}>
                            {selectedFunnel.hasChatWidget ? '✅ Active' : '❌ Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Store Integration</span>
                          <span className={`text-sm font-medium ${selectedFunnel.hasStore ? 'text-green-600' : 'text-gray-400'}`}>
                            {selectedFunnel.hasStore ? '✅ Enabled' : '❌ Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Favicon</span>
                          <span className={`text-sm font-medium ${selectedFunnel.faviconUrl ? 'text-green-600' : 'text-gray-400'}`}>
                            {selectedFunnel.faviconUrl ? '✅ Custom' : '❌ Default'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Technical Details</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Last Updated</span>
                          <span className="text-sm font-medium">
                            {selectedFunnel.lastUpdated ? new Date(selectedFunnel.lastUpdated).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Funnel ID</span>
                          <span className="text-sm font-medium font-mono text-xs">
                            {selectedFunnel.id?.slice(-8) || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Location</span>
                          <span className="text-sm font-medium">
                            {selectedFunnel.locationId?.slice(-8) || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Funnel URL */}
                {selectedFunnel.url && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Funnel URL</h4>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Globe className="h-4 w-4 text-gray-500" />
                        <code className="text-sm flex-1">{selectedFunnel.url}</code>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Location Details Modal */}
      <Dialog open={showLocationDetails} onOpenChange={setShowLocationDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {location?.name} - Location Details
            </DialogTitle>
            <DialogDescription>
              Complete business information and contact details from GoHighLevel
            </DialogDescription>
          </DialogHeader>

          {analytics.locationData?.location && (
            <div className="space-y-6">
              {(() => {
                const locData = analytics.locationData.location;

                return (
                  <>
                    {/* Basic Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Basic Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Business Name</p>
                              <p className="text-sm text-muted-foreground">{locData.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Address</p>
                              <p className="text-sm text-muted-foreground">
                                {locData.address}, {locData.city}, {locData.state} {locData.postalCode}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Country</p>
                              <p className="text-sm text-muted-foreground">{locData.country}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Timezone</p>
                              <p className="text-sm text-muted-foreground">{locData.timezone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Established</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(locData.dateAdded).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Location ID</p>
                              <p className="text-sm text-muted-foreground font-mono">{locData.id}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Email</p>
                              <p className="text-sm text-muted-foreground">{locData.email || 'Not provided'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Phone</p>
                              <p className="text-sm text-muted-foreground">{locData.phone || 'Not provided'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Website</p>
                              {locData.website ? (
                                <a href={locData.website} target="_blank" rel="noopener noreferrer"
                                   className="text-sm text-blue-600 hover:underline">
                                  {locData.website}
                                </a>
                              ) : (
                                <p className="text-sm text-muted-foreground">Not provided</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Contact Person</p>
                              <p className="text-sm text-muted-foreground">
                                {locData.firstName && locData.lastName ?
                                  `${locData.firstName} ${locData.lastName}` : 'Not provided'}
                              </p>
                            </div>
                          </div>
                          {locData.logoUrl && (
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Logo</p>
                                <a href={locData.logoUrl} target="_blank" rel="noopener noreferrer"
                                   className="text-sm text-blue-600 hover:underline">
                                  View Logo
                                </a>
                              </div>
                            </div>
                          )}
                          {locData.googlePlacesId && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Google Places ID</p>
                                <p className="text-sm text-muted-foreground font-mono">{locData.googlePlacesId}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Social Media */}
                    {locData.social && Object.keys(locData.social).some(key => locData.social![key]) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Social Media</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-4 flex-wrap">
                            {locData.social.facebookUrl && (
                              <a href={locData.social.facebookUrl} target="_blank" rel="noopener noreferrer"
                                 className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <span>Facebook</span>
                              </a>
                            )}
                            {locData.social.instagram && (
                              <a href={`https://instagram.com/${locData.social.instagram}`} target="_blank" rel="noopener noreferrer"
                                 className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <span>Instagram</span>
                              </a>
                            )}
                            {locData.social.linkedIn && (
                              <a href={locData.social.linkedIn} target="_blank" rel="noopener noreferrer"
                                 className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <span>LinkedIn</span>
                              </a>
                            )}
                            {locData.social.twitter && (
                              <a href={`https://twitter.com/${locData.social.twitter}`} target="_blank" rel="noopener noreferrer"
                                 className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <span>Twitter</span>
                              </a>
                            )}
                            {locData.social.youtube && (
                              <a href={`https://youtube.com/${locData.social.youtube}`} target="_blank" rel="noopener noreferrer"
                                 className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                <span>YouTube</span>
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Feature Permissions */}
                    {locData.permissions && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Feature Permissions</CardTitle>
                          <CardDescription>Enabled features and capabilities</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(locData.permissions).map(([feature, enabled]) => (
                              <div key={feature} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm capitalize">
                                  {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <span className={`text-sm font-medium ${enabled ? 'text-green-600' : 'text-red-600'}`}>
                                  {enabled ? '✓' : '✗'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Settings */}
                    {locData.settings && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Business Settings</CardTitle>
                          <CardDescription>Configuration and preferences</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(locData.settings).map(([setting, value]) => (
                              <div key={setting} className="flex justify-between items-center py-1">
                                <span className="text-sm capitalize">
                                  {setting.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 🌐 WEBSITE MANAGER DIALOG */}
      <Dialog open={showWebsiteManager} onOpenChange={setShowWebsiteManager}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" />
              Manage Websites
            </DialogTitle>
            <DialogDescription>
              Add and manage multiple websites for this location. Each website will have its own analytics tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">How It Works</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Each website needs a unique Site ID for tracking</li>
                <li>• Analytics are aggregated across all websites</li>
                <li>• Individual website performance is shown in the breakdown</li>
                <li>• Add the tracking script to each website with its Site ID</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Current Websites</h4>
                <Button variant="outline" size="sm" onClick={() => setShowAddWebsite(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Website
                </Button>
              </div>
              {/* Website analytics removed - was always showing 0 data */}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Next Steps</h4>
              <p className="text-sm text-yellow-800 mb-3">
                To add more websites, you&apos;ll need to:
              </p>
              <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                <li>Update the site mapping in the server code</li>
                <li>Add the analytics tracking script to each website</li>
                <li>Configure the Site ID for each domain</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowWebsiteManager(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ➕ ADD WEBSITE DIALOG */}
      <Dialog open={showAddWebsite} onOpenChange={setShowAddWebsite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Website</DialogTitle>
            <DialogDescription>
              Add a new website to track analytics for this location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Website/Site ID</label>
              <input
                type="text"
                value={newWebsiteId}
                onChange={(e) => setNewWebsiteId(e.target.value)}
                placeholder="e.g., youngstown-blog, landing-page-1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Use a unique identifier for this website (letters, numbers, hyphens only)
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Adding a website here requires server-side configuration.
                The Site ID will be added to the location mapping for analytics tracking.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => {
              setShowAddWebsite(false)
              setNewWebsiteId('')
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement actual website addition logic
                console.log('Adding website:', newWebsiteId, 'for location:', locationId)
                alert(`Website "${newWebsiteId}" would be added to location ${locationId}. This requires server-side configuration.`)
                setShowAddWebsite(false)
                setNewWebsiteId('')
              }}
              disabled={!newWebsiteId.trim()}
            >
              Add Website
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 📊 TRAFFIC ANALYTICS MODAL */}
      <Dialog open={!!selectedTrafficItem} onOpenChange={() => setSelectedTrafficItem(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Traffic Analytics: {selectedTrafficItem?.data?.siteId || selectedTrafficItem?.data?.name}
              {selectedTrafficItem?.type === 'website' && (
                <Badge variant="outline" className="ml-2">Website</Badge>
              )}
              {selectedTrafficItem?.type === 'funnel' && (
                <Badge variant="outline" className="ml-2">Funnel</Badge>
              )}
            </DialogTitle>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 mt-2">
                Debug: Type={selectedTrafficItem?.type} Data Keys={Object.keys(selectedTrafficItem?.data || {})}
              </div>
            )}
            <DialogDescription>
              Detailed traffic and engagement metrics for this {selectedTrafficItem?.type}
              {selectedTrafficItem?.type === 'funnel' ? ' (conversion tracking)' : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedTrafficItem && (
            <div className="space-y-6">
              {!analytics && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading analytics data...</p>
                </div>
              )}

              {analytics && (
                <>
                  {/* Debug: Check analytics data */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Analytics Debug:</strong><br/>
                        Analytics exists: {analytics ? 'YES' : 'NO'}<br/>
                        Analytics type: {typeof analytics}<br/>
                        Website Analytics exists: {analytics?.websiteAnalytics ? 'YES' : 'NO'}<br/>
                        Website Analytics type: {typeof analytics?.websiteAnalytics}<br/>
                        Website Analytics keys: {analytics?.websiteAnalytics ? Object.keys(analytics.websiteAnalytics).join(', ') : 'N/A'}<br/>
                        Page Views: {analytics?.websiteAnalytics?.pageViews ?? 'N/A'}<br/>
                        Selected Item Type: {selectedTrafficItem?.type ?? 'N/A'}<br/>
                        Selected Item Data keys: {selectedTrafficItem?.data ? Object.keys(selectedTrafficItem.data).join(', ') : 'N/A'}
                      </p>
                    </div>
                  )}

                  {/* Show comprehensive analytics dashboard for both websites and funnels */}
                  {(() => {
                    // Generate unique siteId for this funnel/website
                    const funnelSiteId = generateFunnelSiteId(selectedTrafficItem.data);
                    const cacheKey = `${selectedTrafficItem.data?.id || selectedTrafficItem.data?.name}:::${funnelSiteId}`;
                    const funnelData = funnelAnalytics[cacheKey];
                    const isLoading = loadingFunnelAnalytics[cacheKey];
                    const hasError = funnelAnalyticsError[cacheKey];
                    // Check if analytics has ever been set up for this site
                    const hasData = !!(funnelData && funnelData.hasEverBeenTracked);
                    const useAggregated = false;


                    return (
                      <div className="space-y-6">
                        {/* Debug info for development */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                            <p className="text-sm text-yellow-800">
                              <strong>Analytics Debug:</strong><br/>
                              Funnel Name: {selectedTrafficItem.data?.name || 'N/A'}<br/>
                              Funnel ID: {selectedTrafficItem.data?.id || 'N/A'}<br/>
                              Generated SiteId: {funnelSiteId}<br/>
                              Cache Key: {cacheKey}<br/>
                              Has Cached Data: {funnelData ? 'YES' : 'NO'}<br/>
                              Has Historical Data: {hasData ? 'YES' : 'NO'}<br/>
                              Is Loading: {isLoading ? 'YES' : 'NO'}<br/>
                              Has Error: {hasError ? 'YES' : 'NO'}<br/>
                              Page Views: {funnelData?.pageViews || 0}<br/>
                              Has Ever Been Tracked: {funnelData?.hasEverBeenTracked ? 'YES' : 'NO'}<br/>
                              Using: {hasData ? 'Per-Funnel Analytics' : 'No Analytics'}
                              Website Analytics: Removed (was always 0)
                            </p>
                          </div>
                        )}

                        {/* Loading state */}
                        {isLoading && !funnelData && (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Loading analytics data...</p>
                          </div>
                        )}

                        {/* Error state */}
                        {hasError && !funnelData && (
                          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                            <p className="text-sm text-red-800">
                              <strong>Error loading analytics:</strong> {hasError}
                            </p>
                          </div>
                        )}

                        {/* Show analytics if available */}
                        {(useAggregated || hasData) ? (
                          <WebsiteAnalyticsDashboard
                            analytics={useAggregated ? analytics.websiteAnalytics : funnelData}
                            siteId={funnelSiteId}
                            onRefresh={() => handleManualRefresh(useAggregated ? undefined : cacheKey, !!useAggregated)}
                            isRefreshing={isRefreshing}
                            autoRefresh={autoRefreshEnabled}
                            onToggleAutoRefresh={handleToggleAutoRefresh}
                          />
                        ) : (
                          <div className="text-center py-12">
                            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Analytics Not Set Up
                            </h3>
                            <p className="text-gray-600 mb-4">
                              This website/funnel doesn&apos;t have analytics tracking yet. Generate and add the tracking script to start collecting data.
                            </p>
                            
                            {/* Generate Script Button */}
                            {location?.id && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h4 className="font-semibold text-blue-900 mb-1">Tracking Script</h4>
                                    <p className="text-sm text-blue-700">
                                      Copy this script and add it to your website&apos;s &lt;head&gt; section
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => {
                                      const script = generateWebsiteScript(funnelSiteId, location.id);
                                      copyToClipboard(script, `Tracking script for ${selectedTrafficItem.data?.name} copied!`);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Generate & Copy Script
                                  </Button>
                                </div>
                                <div className="bg-white rounded p-3 border border-blue-200">
                                  <code className="text-xs text-gray-800 break-all">
                                    {generateWebsiteScript(funnelSiteId, location.id)}
                                  </code>
                                </div>
                                <div className="mt-4 text-left">
                                  <p className="text-sm font-medium text-blue-900 mb-2">Instructions:</p>
                                  <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                                    <li>Copy the script above</li>
                                    <li>Paste it into your website&apos;s HTML &lt;head&gt; section</li>
                                    <li>Save and publish your website</li>
                                    <li>Visit your website to start tracking</li>
                                    <li>Return here to view your analytics (data appears after first visit)</li>
                                  </ol>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })()}

                </>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setSelectedTrafficItem(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}