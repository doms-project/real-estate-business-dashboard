"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Users, TrendingUp, Eye, Building2, MessageSquare, Activity, Plus, RefreshCw, Loader2, XCircle } from "lucide-react"
import { useUser } from "@clerk/nextjs"
// import { useGHLData } from "@/hooks/use-ghl-data"
import { SubscriptionPlan, GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { subscribeToUpdates, initializeRealtimeUpdates } from "@/lib/realtime-updates"

// Location data interface
interface GHLLocation {
  id: string
  name: string
  city: string
  state: string
  country: string
  address: string
  email?: string
  phone?: string
  website?: string
  logoUrl?: string
}

// Real GHL data - no more mock data!

function LocationCard({ location, metrics, router }: { location: GHLLocation, metrics: { contacts: number, opportunities: number, conversations: number, healthScore?: number }, router: any }) {
  const { contacts, opportunities, conversations, healthScore: apiHealthScore } = metrics

  // Check if data has been loaded for this location
  // -1 values indicate data not loaded yet, 0 values indicate loaded but zero activity
  const isLoading = contacts === -1 && opportunities === -1 && conversations === -1;

  // Use API health score if available, otherwise calculate locally
  const healthScore = apiHealthScore !== undefined ? apiHealthScore :
    (isLoading ? 0 : Math.min(100, Math.max(0,
      Math.floor(((contacts >= 0 ? contacts : 0) * 0.3 + (opportunities >= 0 ? opportunities : 0) * 2 + (conversations >= 0 ? conversations : 0) * 0.1) / 10)
    )) || 60)

  const healthStatus = healthScore >= 80 ? 'green' : healthScore >= 70 ? 'yellow' : 'red';

  return (
    <Card className={isLoading ? "opacity-75" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {location.name}
          {isLoading && <span className="text-xs text-muted-foreground">(Loading...)</span>}
        </CardTitle>
        <CardDescription className="text-base font-medium text-foreground">
          {location.address ? `${location.address}, ${location.city}, ${location.state}` : `${location.city}, ${location.state}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? <div className="animate-pulse bg-gray-200 h-8 rounded"></div> : contacts}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-4 w-4" />
              Contacts
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? <div className="animate-pulse bg-gray-200 h-8 rounded"></div> : opportunities}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Opportunities
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? <div className="animate-pulse bg-gray-200 h-8 rounded"></div> : conversations}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${
              isLoading ? 'text-gray-400' : (
                healthStatus === 'green' ? 'text-green-600' :
                healthStatus === 'yellow' ? 'text-yellow-600' : 'text-red-600'
              )
            }`}>
              {isLoading ? <div className="animate-pulse bg-gray-200 h-8 rounded"></div> : `${healthScore}%`}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Activity className="h-4 w-4" />
              Health Score
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('🔗 Navigating to location:', location.id, 'Name:', location.name)
              router.push(`/agency/gohighlevel-clients/${location.id}`)
            }}
            className="flex-1"
            disabled={isLoading}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function GHLClientsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Dynamic location discovery from all PIT tokens
  const [locationsData, setLocationsData] = useState<any>(null)
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState({
    current: 'Initializing...',
    completed: false,
    error: false,
    attempt: 0,
    maxAttempts: 3
  })

  // Retry counter for stuck loading states
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Force retry function for stuck loading states
  const forceRetry = useCallback(async () => {
    console.log(`🔄 Force retry attempt ${retryCount + 1}/${maxRetries}`);

    // Clear any old session state (no longer needed with Supabase caching)
    // Supabase handles all caching automatically

    // Reset component state
    setHasRefreshedAPIs(false);
    setLocationMetrics({});
    setLocationsData(null);
    setLocationsLoading(true);
    setRetryCount(prev => prev + 1);

    // Reset progress
    setLoadingProgress({
      current: 'Retrying data load...',
      completed: false,
      error: false,
      attempt: 1,
      maxAttempts: 3
    });

    // Force fresh location load
    try {
      await fetchLocationsWithRetry();
    } catch (error) {
      console.error('❌ Force retry failed:', error);
      setLocationsLoading(false);
      setLoadingProgress({
        current: 'Retry failed. Please refresh the page.',
        completed: false,
        error: true,
        attempt: retryCount + 1,
        maxAttempts: maxRetries
      });
    }
  }, [retryCount, maxRetries]);

  // Enhanced location loading with retry mechanism
  const fetchLocationsWithRetry = async () => {
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setLocationsLoading(true)
        setLoadingProgress({
          current: `Connecting to GoHighLevel... (Attempt ${attempt}/${maxRetries})`,
          completed: false,
          error: false,
          attempt,
          maxAttempts: maxRetries
        })

        console.log(`📍 Dashboard - Fetching locations (attempt ${attempt}/${maxRetries}) from /api/ghl/locations`)

        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

        setLoadingProgress({
          current: `Fetching location data... (Attempt ${attempt}/${maxRetries})`,
          completed: false,
          error: false,
          attempt,
          maxAttempts: maxRetries
        })

        const response = await fetch('/api/ghl/locations?internal=true', {
          signal: controller.signal
        })
        // Keep timeout active for response.json() to prevent hanging
        // clearTimeout(timeoutId) // Commented out - maintain protection

        if (!response.ok) {
          clearTimeout(timeoutId);
          throw new Error(`Server returned ${response.status}: ${response.statusText}`)
        }

        setLoadingProgress({
          current: 'Processing location data...',
          completed: false,
          error: false,
          attempt,
          maxAttempts: maxRetries
        })

        const data = await response.json()
        clearTimeout(timeoutId); // Safe to clear now
        console.log('📍 Dashboard - Locations response:', data)

        setLoadingProgress({
          current: 'Loading complete!',
          completed: true,
          error: false,
          attempt,
          maxAttempts: maxRetries
        })

        console.log('📍 Dashboard - About to call setLocationsData with:', data)
        setLocationsData(data)
        setLocationsLoading(false) // Ensure loading state is cleared on success
        console.log('📍 Dashboard - State updates called, locationsData should update')

        // No sessionStorage caching needed - locations are cached in component state

        return // Success - exit retry loop

      } catch (error) {
        console.warn(`📍 Attempt ${attempt}/${maxRetries} failed:`, error)

        if (attempt === maxRetries) {
          // Final attempt failed - show error state
          setLocationsLoading(false) // Clear loading state on final failure
          setLoadingProgress({
            current: 'Unable to load locations. Click retry to try again.',
            completed: true,
            error: true,
            attempt,
            maxAttempts: maxRetries
          })
          setLocationsData({ locations: [], error: error instanceof Error ? error.message : 'Failed to load' })
        } else {
          // Wait before retry with exponential backoff
          setLoadingProgress({
            current: `Connection failed, retrying in ${Math.pow(2, attempt)}s... (${attempt}/${maxRetries})`,
            completed: false,
            error: false,
            attempt,
            maxAttempts: maxRetries
          })
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
      // Removed finally block that was clearing loading state prematurely
    }
  }

  // Load locations from API (no sessionStorage caching)
  useEffect(() => {
    fetchLocationsWithRetry()
  }, [])

  // Enhanced recovery mechanism for stuck loading states with retry logic
  useEffect(() => {
    if (locationsLoading && retryCount < maxRetries) {
      const timeout = setTimeout(async () => {
        console.warn(`📍 Loading timeout - attempting auto-retry ${retryCount + 1}/${maxRetries} after 15 seconds`)
        await forceRetry();
      }, 15000) // 15 second timeout before auto-retry

      return () => clearTimeout(timeout)
    } else if (locationsLoading && retryCount >= maxRetries) {
      // Final failure after all retries
      const timeout = setTimeout(() => {
        console.error('📍 All retries exhausted - forcing reset')
        setLocationsLoading(false)
        setLoadingProgress({
          current: 'Loading failed after multiple attempts. Please refresh the page.',
          completed: false,
          error: true,
          attempt: retryCount,
          maxAttempts: maxRetries
        })
      }, 10000) // 10 second final timeout

      return () => clearTimeout(timeout)
    }
  }, [locationsLoading, retryCount, maxRetries, forceRetry])

  const locations = useMemo((): GHLLocation[] => locationsData?.locations || [], [locationsData])

  console.log('📍 Dashboard - locationsData:', locationsData)
  console.log('📍 Dashboard - locations count:', locations?.length || 0)
  console.log('📍 Dashboard - locationsLoading:', locationsLoading)

  // Create metrics state for all locations (persists across navigation)
  const [locationMetrics, setLocationMetrics] = useState<Record<string, { contacts: number, opportunities: number, conversations: number, healthScore?: number }>>({})

  // Reset problematic state on navigation and load cached metrics
  useEffect(() => {
    // Reset navigation-sensitive state to allow fresh loads
    setHasRefreshedAPIs(false);
    setRetryCount(0);
    console.log('🔄 Reset navigation state for fresh component load');

    // Load metrics from Supabase cache (handles 30-min caching automatically)
    // No sessionStorage needed - Supabase API manages all caching
  }, []);

  // Load metrics from database with caching
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshedLocations, setAutoRefreshedLocations] = useState<Set<string>>(new Set());
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Track if we've refreshed APIs in this session
  const [hasRefreshedAPIs, setHasRefreshedAPIs] = useState(false);


  // Refresh metrics from GHL API and update database
  const refreshMetricsFromAPI = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    console.log('🔄 Refreshing metrics from GHL API...');

    // No sessionStorage to clear - using Supabase caching only

    try {
      // First get locations with tokens (internal=true)
      console.log('🔑 Getting locations with tokens...');
      const locationsResponse = await fetch('/api/ghl/locations?internal=true');
      if (!locationsResponse.ok) {
        throw new Error('Failed to fetch locations with tokens');
      }

      const locationsData = await locationsResponse.json();
      if (!locationsData.locations) {
        throw new Error('No locations data received');
      }

      // Create location->token mapping
      const locationTokens: Record<string, string> = {};
      locationsData.locations.forEach((loc: any) => {
        if (loc.pitToken) {
          locationTokens[loc.id] = loc.pitToken;
        }
      });

      console.log(`🔑 Got tokens for ${Object.keys(locationTokens).length} locations`);

      const response = await fetch('/api/ghl/metrics/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });

      const result = await response.json();

      if (result.success && result.data) {
        const metricsMap: Record<string, { contacts: number, opportunities: number, conversations: number, healthScore?: number }> = {};

        // Process metrics for each location
        for (const item of result.data) {
          const locationId = item.location_id;
          const pitToken = locationTokens[locationId];

          // Fetch health score for this location (now with token)
          let healthScore: number | undefined;
          if (pitToken) {
            try {
              const healthResponse = await fetch(`/api/ghl/data?endpoint=health-score&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`);
              if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                healthScore = healthData.score;
              }
            } catch (error) {
              console.warn(`⚠️ Could not fetch health score for ${locationId}:`, error);
            }
          } else {
            console.warn(`⚠️ No token available for location ${locationId}, skipping health score`);
          }

          metricsMap[locationId] = {
            contacts: item.contacts_count || 0,
            opportunities: item.opportunities_count || 0,
            conversations: item.conversations_count || 0,
            healthScore: healthScore
          };
        }

        setLocationMetrics(metricsMap);

        // Use database timestamp instead of current time
        const dbTimestamps = Object.values(metricsMap).map((metric: any) =>
          metric.last_updated ? new Date(metric.last_updated).getTime() : 0
        ).filter(timestamp => timestamp > 0);

        const mostRecentDbUpdate = dbTimestamps.length > 0 ? Math.max(...dbTimestamps) : Date.now();
        const newTimestamp = new Date(mostRecentDbUpdate);
        setLastUpdated(newTimestamp);
        setLastRefreshTime(Date.now()); // Track successful refresh

        console.log('⏰ MANUAL REFRESH: Updated lastUpdated to DB time:', newTimestamp.toISOString());

        // Data is already refreshed via refreshMetricsFromAPI(), real-time updates will handle UI updates
        console.log('✅ Manual refresh completed - real-time updates will keep data fresh');

        // Dispatch custom event to notify other pages (like dashboard) that bulk refresh completed
        window.dispatchEvent(new CustomEvent('bulkRefreshCompleted', {
          detail: {
            timestamp: Date.now(),
            locationCount: result.data.length,
            source: 'ghl-clients-page'
          }
        }));

        console.log('✅ Refreshed metrics and health scores from API:', result.data.length, 'locations updated');
      }
    } catch (error) {
      console.error('❌ Failed to refresh from API:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Cached metrics loading removed - now using direct fresh data loading only

  // Smart loading with retry: Use cached API (DB if fresh, API refresh if stale)
  const loadMetricsSmart = useCallback(async () => {
    if (isRefreshing) return;

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setIsRefreshing(true);
        setLocationsLoading(true);

        // Update progress for retry attempts
        setLoadingProgress({
          current: `Loading metrics data... (Attempt ${attempt}/${maxRetries})`,
          completed: false,
          error: false,
          attempt,
          maxAttempts: maxRetries
        });

        console.log(`🧠 Smart loading: Checking cached API (attempt ${attempt}/${maxRetries})...`);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch('/api/ghl/metrics/cached', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          const metricsMap: Record<string, { contacts: number, opportunities: number, conversations: number, healthScore?: number }> = {};

          // Process metrics from cached API
          for (const item of result.data) {
            metricsMap[item.location_id] = {
              contacts: item.contacts_count || 0,
              opportunities: item.opportunities_count || 0,
              conversations: item.conversations_count || 0,
              healthScore: item.health_score
            };
          }

          setLocationMetrics(metricsMap);

          // Use database timestamp from metrics data instead of result.lastUpdated
          const dbTimestamps = result.data.map((item: any) =>
            item.last_updated ? new Date(item.last_updated).getTime() : 0
          ).filter((timestamp: number) => timestamp > 0);

          const mostRecentDbUpdate = dbTimestamps.length > 0 ? Math.max(...dbTimestamps) : Date.now();
          const newTimestamp = new Date(mostRecentDbUpdate);
          setLastUpdated(newTimestamp);
          setLastRefreshTime(Date.now());

          // Mark progress as completed
          setLoadingProgress({
            current: 'Data loaded successfully!',
            completed: true,
            error: false,
            attempt,
            maxAttempts: maxRetries
          });

          console.log(`✅ Smart load completed: ${result.data.length} locations from ${result.source}`);
          console.log(`🕐 Data freshness: ${result.isStale ? 'STALE (refreshed)' : 'FRESH (from cache)'}`);

          return; // Success - exit retry loop
        } else {
          throw new Error(`Invalid response: ${JSON.stringify(result)}`);
        }

      } catch (error) {
        lastError = error;
        console.error(`❌ Smart loading attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Update progress for retry
          setLoadingProgress({
            current: `Retrying in 2 seconds... (Attempt ${attempt + 1}/${maxRetries})`,
            completed: false,
            error: false,
            attempt: attempt + 1,
            maxAttempts: maxRetries
          });

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Final failure
          setLoadingProgress({
            current: `Failed to load data after ${maxRetries} attempts`,
            completed: false,
            error: true,
            attempt,
            maxAttempts: maxRetries
          });
        }
      } finally {
        setIsRefreshing(false);
      }
    }

    // All retries failed
    console.error('❌ Smart loading failed after all retries:', lastError);
    setLocationsLoading(false); // Clear loading state on final failure
  }, [isRefreshing]);

  // Automatic smart loading on component mount
  useEffect(() => {
    if (locations.length > 0) {
      console.log('🔄 Dashboard: Smart loading metrics (cache-first approach)...');
      if (!isRefreshing && !hasRefreshedAPIs) {
        setHasRefreshedAPIs(true);
        console.log('🚀 Triggering smart data load for all locations...');
        loadMetricsSmart();
      }
    }
  }, [locations, loadMetricsSmart]);

  // Subscribe to real-time location metrics updates
  useEffect(() => {
    console.log('📡 Setting up real-time location metrics subscription...');

    const unsubscribe = subscribeToUpdates('location_metrics', (update) => {
      console.log('🔄 Real-time location metrics update received:', update);
      console.log('📊 Update type:', update.type, 'Location:', update.data?.location_name);
      console.log('📊 Full update data:', update);

      if (update.type === 'metrics_updated' && update.data) {
        const updatedLocationId = update.data.location_id as string;
        console.log(`🔄 Processing real-time update for location: ${updatedLocationId}`);

        // Update the specific location metrics in state
        setLocationMetrics(prev => {
          const newMetrics = {
            ...prev,
            [updatedLocationId]: {
              contacts: update.data.contacts_count || 0,
              opportunities: update.data.opportunities_count || 0,
              conversations: update.data.conversations_count || 0,
              healthScore: update.data.health_score || 0
            }
          };

          console.log('📈 Updated locationMetrics state:', newMetrics[updatedLocationId]);
          return newMetrics;
        });

        // Update last updated timestamp
        const newTimestamp = new Date(update.timestamp);
        setLastUpdated(newTimestamp);

        console.log(`✅ Real-time update: Updated metrics for ${update.data.location_name} (${updatedLocationId}) at ${newTimestamp.toISOString()}`);

        // Force re-render of UI
        console.log('🔄 Forcing UI re-render after real-time update...');
      } else {
        console.log('⚠️ Real-time update ignored - invalid type or data:', update);
      }
    });

    console.log('✅ Real-time subscription setup complete, waiting for updates...');

    return () => {
      console.log('🗑️ Cleaning up real-time subscription...');
      unsubscribe();
    };
  }, []); // Empty dependency array - only subscribe once

  // No sessionStorage needed - Supabase handles all caching
  // Metrics are cached server-side with 30-minute expiration

  // Automatically fetch data for locations without cached metrics
  useEffect(() => {
    if (locations.length > 0 && Object.keys(locationMetrics).length > 0 && !isRefreshing) {
      const locationsWithoutData = locations.filter((location: any) =>
        !locationMetrics[location.id] && !autoRefreshedLocations.has(location.id)
      );

      if (locationsWithoutData.length > 0) {
        console.log('🔄 Auto-fetching data for locations without cached metrics:', locationsWithoutData.map((l: any) => l.id));

        // Mark these locations as being auto-refreshed
        const newAutoRefreshed = new Set(autoRefreshedLocations);
        locationsWithoutData.forEach((location: any) => newAutoRefreshed.add(location.id));
        setAutoRefreshedLocations(newAutoRefreshed);

        // Trigger refresh for locations without data
        refreshMetricsFromAPI();
      }
    }
  }, [locations, locationMetrics, refreshMetricsFromAPI, isRefreshing, autoRefreshedLocations]);

  // Location loading is handled by the main useEffect - no retry needed for cached system

  // Initialize real-time updates
  useEffect(() => {
    console.log('🚀 Initializing real-time updates for GHL clients page...');
    console.log('📡 About to call initializeRealtimeUpdates()...');
    try {
      initializeRealtimeUpdates();
      console.log('✅ initializeRealtimeUpdates() called successfully');
    } catch (error) {
      console.error('❌ Failed to initialize real-time updates:', error);
    }
  }, []);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (locations.length > 0) {
        console.log('⏰ Auto-refreshing metrics from API...');
        refreshMetricsFromAPI();
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [locations, refreshMetricsFromAPI]);


  // Convert locations to client format for compatibility
  const ghlClients: GoHighLevelClient[] = locations?.map((location: any) => ({
    id: location.id,
    name: location.name,
    email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`, // Placeholder
    phone: '', // Placeholder
    company: location.name,
    subscriptionPlan: 'professional' as SubscriptionPlan,
    affiliateUserId: user?.id || 'user_123',
    createdAt: '2024-01-01', // Placeholder
    updatedAt: new Date().toISOString().split('T')[0],
    status: 'active'
  })) || []




  // Keep the old fake function for backward compatibility (revenue, etc.)
  const getClientMetrics = (clientId: string): ClientMetrics | undefined => {
    // Use client ID as seed for consistent "random" data per client
    const seed = clientId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

    const randomFromSeed = (base: number, variance: number) => {
      return base + Math.floor((seed * 17) % variance)
    }

    return {
      clientId,
      currentWeek: {
        clientId,
        weekStart: "2024-12-16",
        weekEnd: "2024-12-22",
        views: randomFromSeed(200, 400),
        leads: randomFromSeed(5, 25),
        conversions: randomFromSeed(1, 10),
        revenue: randomFromSeed(1000, 8000)
      },
      lastWeek: {
        clientId,
        weekStart: "2024-12-09",
        weekEnd: "2024-12-15",
        views: randomFromSeed(180, 350),
        leads: randomFromSeed(4, 20),
        conversions: randomFromSeed(1, 8),
        revenue: randomFromSeed(800, 6000)
      },
      thisMonth: {
        views: randomFromSeed(800, 2000),
        leads: randomFromSeed(20, 80),
        conversions: randomFromSeed(5, 30),
        revenue: randomFromSeed(5000, 30000)
      },
      allTime: {
        views: randomFromSeed(5000, 20000),
        leads: randomFromSeed(100, 500),
        conversions: randomFromSeed(25, 150),
        revenue: randomFromSeed(25000, 150000)
      }
    }
  }

  // Calculate agency stats
  const totalClients = ghlClients.length
  const activeClients = ghlClients.filter(c => c.status === 'active').length
  // Use real data when available, fallback to fake data during loading

  // Aggregate real metrics from locationMetrics
  const totalContacts = Object.values(locationMetrics).reduce((sum, metrics) => sum + (metrics.contacts || 0), 0)
  const totalOpportunities = Object.values(locationMetrics).reduce((sum, metrics) => sum + (metrics.opportunities || 0), 0)
  const totalConversations = Object.values(locationMetrics).reduce((sum, metrics) => sum + (metrics.conversations || 0), 0)

  // Note: Client management functions are disabled for now
  // Add and edit functionality will be implemented later

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agency Health & GHL Clients</h1>
          <p className="text-muted-foreground">
            Monitor location health and manage your GoHighLevel client accounts
          </p>
          <p className="text-xs text-green-600 mt-1">
            ✅ Client cards show REAL data from GoHighLevel API with database caching for fast loading!
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdated.toLocaleString()}
              {(() => {
                const now = new Date();
                const timeDiff = now.getTime() - lastUpdated.getTime();
                const minutesAgo = Math.floor(timeDiff / (1000 * 60));
                if (minutesAgo > 30) {
                  return <span className="text-orange-500 ml-2">(Data may be stale - refreshing...)</span>;
                }
                return null;
              })()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (locations.length === 0 && !locationsLoading) {
                // If no locations loaded, try loading locations first
                fetchLocationsWithRetry()
              } else if (locations.length > 0) {
                // If locations are loaded, refresh the metrics
                refreshMetricsFromAPI()
              }
            }}
            variant="outline"
            size="sm"
            className="mr-2"
            disabled={locationsLoading}
          >
            {locationsLoading ? 'Loading...' :
             locations.length === 0 ? 'Load Locations' : 'Load Data'}
          </Button>
          {(locationsLoading || loadingProgress.error) && retryCount < maxRetries && (
            <Button
              onClick={forceRetry}
              variant="outline"
              size="sm"
              disabled={locationsLoading}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry ({retryCount}/{maxRetries})
            </Button>
          )}
          <Button
            onClick={refreshMetricsFromAPI}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          <Button onClick={() => router.push('/agency/gohighlevel-clients/add')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Enhanced API Loading Progress */}
      {(locationsLoading || loadingProgress.error) && (
        <Card className={`mb-6 ${loadingProgress.error ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {locationsLoading && !loadingProgress.error && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                  {loadingProgress.error && (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <h3 className={`font-semibold ${loadingProgress.error ? 'text-red-900' : 'text-blue-900'}`}>
                    {loadingProgress.error ? 'Connection Issue' : 'Loading Client Locations'}
                  </h3>
                </div>
                <span className={`text-sm ${loadingProgress.error ? 'text-red-700' : 'text-blue-700'}`}>
                  {loadingProgress.completed && !loadingProgress.error ? 'Complete' :
                   loadingProgress.error ? 'Failed' : 'In Progress'}
                </span>
              </div>

              {!loadingProgress.error && (
                <Progress
                  value={loadingProgress.completed ? 100 : 20 + (loadingProgress.attempt * 25)}
                  className="h-2"
                />
              )}

              <div className="flex items-center justify-between">
                <p className={`text-xs ${loadingProgress.error ? 'text-red-600' : 'text-blue-600'}`}>
                  {loadingProgress.current}
                </p>

                {loadingProgress.error && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchLocationsWithRetry()}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Health Overview */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total GHL Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {activeClients} active
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                Object.values(locationMetrics).filter(m => (m.contacts || 0) > 0).length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : `of ${totalClients} total clients`}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                totalOpportunities.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : 'Sales pipeline across clients'}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                Math.round(Object.values(locationMetrics).reduce((sum, m) => sum + (m.healthScore || 0), 0) / Math.max(Object.keys(locationMetrics).length, 1))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : 'Account health (0-100)'}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                `${Math.round((totalOpportunities / Math.max(totalContacts, 1)) * 100)}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : 'Opportunities ÷ Contacts'}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                totalConversations.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : 'Customer engagement'}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(locationMetrics).length === 0 ? (
                <div className="animate-pulse bg-gray-200 h-8 rounded w-20"></div>
              ) : (
                `${Math.round((totalConversations / Math.max(totalContacts, 1)) * 100)}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.keys(locationMetrics).length === 0 ? 'Loading data...' : 'Conversations ÷ Contacts'}
            </p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* All GHL Client Locations */}
      <div className="max-w-7xl mx-auto">
        <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">All Client Locations</h2>
            <p className="text-sm text-muted-foreground">Monitor health and activity across all your GoHighLevel locations</p>
          </div>
        </div>

        {locationsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : locations && locations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.map((location: any) => (
              <LocationCard
                key={location.id}
                location={location}
                metrics={locationMetrics[location.id] || { contacts: -1, opportunities: -1, conversations: -1 }}
                router={router}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No GHL Clients Found</h3>
              <p className="text-muted-foreground text-center">
                No GoHighLevel client locations were found. Please check your API configuration.
              </p>
            </CardContent>
          </Card>
        )}
        </div>
      </div>


    </div>
  )
}

