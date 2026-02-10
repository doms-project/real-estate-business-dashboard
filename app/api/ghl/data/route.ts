import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GHLClient } from '@/lib/ghl-client'
import { createClient } from '@supabase/supabase-js'
import { activityTracker } from '@/lib/activity-tracker'

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

async function handleRequest(request: NextRequest, method: 'GET' | 'POST') {
  try {
    // Get parameters first to check for pitToken
    const { searchParams } = new URL(request.url);
    const pitToken = searchParams.get('pitToken');

    // Allow internal calls when pitToken is present (server-to-server calls)
    const { userId } = await auth()
    if (!userId && !pitToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  let endpoint: string | null = null;
  let locationId: string | null = null;
  let pitToken: string | null = null;
  let requestBody: any = null;

  // Get common parameters from URL for both GET and POST
  const { searchParams } = new URL(request.url);
  endpoint = searchParams.get('endpoint');
  locationId = searchParams.get('locationId');
  pitToken = searchParams.get('pitToken');
  const days = searchParams.get('days');

  // For POST requests, also parse the JSON body for additional data
  if (method === 'POST') {
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON body for POST request' },
        { status: 400 }
      );
    }
  }

  console.log(`🚀 ${method} API Call: endpoint=${endpoint}, locationId=${locationId}, hasToken=${!!pitToken}, days=${days}, hasBody=${!!requestBody}`)

  // Helper function to calculate date ranges
  function getDateRange(daysParam: string | null) {
    const now = new Date();
    const toDate = now.toISOString();

    if (!daysParam || daysParam === 'all') {
      // Return a very early date for "all time"
      return {
        fromDate: '2020-01-01T00:00:00.000Z',
        toDate
      };
    }

    const daysNum = parseInt(daysParam);
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - daysNum);

    return {
      fromDate: fromDate.toISOString(),
      toDate
    };
  }

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Endpoint parameter required' },
      { status: 400 }
    )
  }

  if (!pitToken) {
    return NextResponse.json(
      { error: 'PIT token required' },
      { status: 400 }
    )
  }

  try {
    const client = new GHLClient()

    // Initialize Supabase client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Helper function to log PIT token failures
    const logTokenFailure = async (locationId: string, endpoint: string, errorMessage: string) => {
      try {
        // Get location name for better logging
        const { data: locationData } = await supabase
          .from('ghl_locations')
          .select('name')
          .eq('id', locationId)
          .single()

        const locationName = locationData?.name || 'Unknown Location'

        // Insert failure record
        await supabase.from('pit_token_failures').insert({
          location_id: locationId,
          location_name: locationName,
          endpoint: endpoint,
          error_message: errorMessage
        })

        console.warn(`📍 Logged PIT token failure for ${locationName} (${locationId})`)
      } catch (logError) {
        console.warn('Failed to log token failure:', logError)
      }
    }
    let data

    switch (endpoint) {
      case 'get-location-token':
        if (!locationId) {
          data = { error: 'locationId required for get-location-token endpoint' }
          break
        }

        try {
          console.log(`🔑 Getting location token for ${locationId}`)
          const { data: tokenData, error } = await supabase
            .from('ghl_location_tokens')
            .select('access_token, expires_at')
            .eq('location_id', locationId)
            .single()

          if (error || !tokenData) {
            console.log('⚠️ No token found in database, returning null')
            data = { pitToken: null, error: 'No token found' }
          } else {
            // Check if token is expired
            const now = new Date()
            const expiresAt = new Date(tokenData.expires_at)
            const isExpired = now >= expiresAt

            if (isExpired) {
              console.log('⏰ Token expired, attempting refresh')
              // TODO: Implement token refresh logic here
              data = { pitToken: null, error: 'Token expired' }
            } else {
              console.log('✅ Valid token found in database')
              data = { pitToken: tokenData.access_token }
            }
          }
        } catch (tokenError) {
          console.error('💥 Error getting location token:', tokenError)
          data = { pitToken: null, error: 'Database error' }
        }
        break

      case 'locations':
        if (!locationId) {
          // Return empty for now - locations are handled by /api/ghl/locations endpoint
          data = { locations: [] }
        } else {
          // Get single location info
          data = await client.getLocationData(`/locations/${locationId}`, locationId, pitToken)
        }
        break

      case 'workflows':
        if (!locationId) {
          console.error('🚨 WORKFLOWS: Missing locationId')
          data = { error: 'locationId required for workflows endpoint' }
          break
        }

        try {
          // Get workflows from GHL using direct fetch
          console.log(`🔄 WORKFLOWS: Calling API for location ${locationId}`)
          const response = await fetch(`https://services.leadconnectorhq.com/workflows/?locationId=${locationId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${pitToken}`,
              'Accept': 'application/json',
              'Version': '2021-07-28'
            }
          })

          if (!response.ok) {
            console.error(`🔄 WORKFLOWS: HTTP ${response.status} ${response.statusText}`)
            data = { workflows: [] }
            break
          }

          const workflowsData = await response.json()
          console.log(`🔄 WORKFLOWS: Full response:`, JSON.stringify(workflowsData, null, 2))
          console.log(`🔄 WORKFLOWS: Response status check - has data:`, !!workflowsData)

          // Handle different response structures
          const workflows = workflowsData.workflows || workflowsData.data || workflowsData || [];
          console.log(`🔄 WORKFLOWS: Processing ${Array.isArray(workflows) ? workflows.length : 'non-array'} workflows`)

          data = { workflows }
          console.log(`✅ WORKFLOWS: Completed with ${workflows.length} workflows`)

        } catch (error) {
          console.error(`❌ WORKFLOWS: Error getting workflows for ${locationId}:`, error instanceof Error ? error.message : String(error))
          data = { workflows: [] }
        }
        break;

      case 'social-analytics':
        if (!locationId) {
          console.error('🚨 SOCIAL ANALYTICS: Missing locationId')
          data = {
            summary: { totalAccounts: 0, totalPosts: 0, totalEngagement: 0, averageEngagementRate: 0 },
            accounts: [],
            platformBreakdown: {},
            trends: {},
            lastUpdated: new Date().toISOString(),
            error: 'locationId required for social-analytics endpoint'
          }
          break
        }

        try {
          console.log(`📱 SOCIAL ANALYTICS: Getting connected social accounts for ${locationId}`)

          // First, get connected social accounts (this works with PIT tokens)
          const accountsResponse = await fetch(`https://services.leadconnectorhq.com/social-media-posting/${locationId}/accounts`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${pitToken}`,
              'Accept': 'application/json',
              'Version': '2021-07-28'
            }
          });

          if (!accountsResponse.ok) {
            console.error(`📱 SOCIAL ACCOUNTS: HTTP ${accountsResponse.status} ${accountsResponse.statusText}`)
            data = {
              summary: { totalAccounts: 0, totalPosts: 0, totalEngagement: 0, averageEngagementRate: 0 },
              accounts: [],
              platformBreakdown: {},
              trends: {},
              lastUpdated: new Date().toISOString(),
              error: `Failed to fetch social accounts: ${accountsResponse.status}`
            };
            break;
          }

          const accountsData = await accountsResponse.json();
          console.log(`📱 SOCIAL ACCOUNTS: Found ${accountsData.results?.accounts?.length || 0} connected accounts`);

          const connectedAccounts = accountsData.results?.accounts || [];
          let analyticsData = null;
          let analyticsError = null;

          if (connectedAccounts.length > 0) {
            console.log(`📱 SOCIAL ANALYTICS: Attempting to fetch posts for ${connectedAccounts.length} accounts`);

            // MULTI-PLATFORM APPROACH: Fetch posts from ALL connected accounts
            const allPosts: any[] = [];
            const accountResults: any[] = [];

            // Calculate date range based on days parameter
            const { fromDate, toDate } = getDateRange(days);

            for (const account of connectedAccounts) {
              try {
                console.log(`🔄 Fetching posts for ${account.platform} account: ${account.name} (days: ${days || 'all'})`);

                const postsResponse = await fetch(`https://services.leadconnectorhq.com/social-media-posting/${locationId}/posts/list`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${pitToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Version': '2021-07-28'
                  },
                  body: JSON.stringify({
                    "type": "Filter type",
                    "accounts": account.id, // ✅ Use actual account ID
                    "skip": "0",
                    "limit": "500", // Fetch up to 500 posts per account for more complete data
                    "fromDate": fromDate,
                    "toDate": toDate,
                    "includeUsers": "true",
                    "postType": "post"
                  })
                });

                if (postsResponse.ok) {
                  const postsData = await postsResponse.json();
                  const accountPosts = postsData.results?.posts || postsData.posts || [];

                  console.log(`✅ ${account.platform}: ${accountPosts.length} posts found`);

                  // Add posts to the account for tracking
                  const accountWithPosts = {
                    ...account,
                    posts: accountPosts.length,
                    engagement: accountPosts.reduce((sum: number, post: any) =>
                      sum + ((post.likes || 0) + (post.comments || 0) + (post.shares || 0)), 0
                    ),
                    recentPosts: accountPosts.slice(0, 5).map((post: any) => ({
                      id: post.id,
                      content: post.content || post.caption || post.summary || '',
                      mediaUrl: post.mediaUrl || post.media_url,
                      postedAt: post.postedAt || post.created_at || post.publishedAt,
                      likes: post.likes || 0,
                      comments: post.comments || 0,
                      shares: post.shares || 0
                    })),
                    hasAnalytics: true
                  };

                  accountResults.push(accountWithPosts);

                  // Add posts to global collection
                  if (accountPosts.length > 0) {
                    allPosts.push(...accountPosts);
                  }
                } else {
                  console.log(`❌ Failed to fetch ${account.platform} posts: ${postsResponse.status}`);
                  // Still include the account but mark it as having no posts
                  accountResults.push({
                    ...account,
                    posts: 0,
                    engagement: 0,
                    recentPosts: [],
                    hasAnalytics: false
                  });
                }
              } catch (accountError) {
                console.log(`❌ Error fetching posts for ${account.platform}:`, accountError);
                // Include account with error state
                accountResults.push({
                  ...account,
                  posts: 0,
                  engagement: 0,
                  recentPosts: [],
                  hasAnalytics: false,
                  error: 'Failed to fetch posts'
                });
              }
            }

            // Build analytics data from all posts across all platforms
            if (allPosts.length > 0 || accountResults.length > 0) {
              const totalEngagement = allPosts.reduce((sum: number, post: any) =>
                sum + ((post.likes || 0) + (post.comments || 0) + (post.shares || 0)), 0
              );

              // Build platform breakdown dynamically
              const platformBreakdown: Record<string, any> = {};
              accountResults.forEach(account => {
                const platform = account.platform.toLowerCase();
                if (!platformBreakdown[platform]) {
                  platformBreakdown[platform] = {
                    posts: 0,
                    engagement: 0
                  };
                }
                platformBreakdown[platform].posts += account.posts || 0;
                platformBreakdown[platform].engagement += account.engagement || 0;
              });

              analyticsData = {
                accounts: accountResults,
                totalPosts: allPosts.length,
                totalEngagement: totalEngagement,
                averageEngagementRate: allPosts.length > 0 ?
                  (totalEngagement / allPosts.length).toFixed(2) : 0,
                platformBreakdown: platformBreakdown,
                trends: {
                  recentActivity: allPosts.length > 0 ? 'active' : 'inactive',
                  lastPostDate: allPosts.length > 0 ?
                    allPosts.sort((a: any, b: any) =>
                      new Date(b.postedAt || b.created_at || b.publishedAt).getTime() -
                      new Date(a.postedAt || a.created_at || a.publishedAt).getTime()
                    )[0].postedAt || allPosts[0].created_at || allPosts[0].publishedAt : null
                }
              };

              console.log(`✅ SOCIAL ANALYTICS: Built analytics from ${allPosts.length} posts across ${accountResults.length} accounts`);
            } else {
              console.log(`📱 SOCIAL ANALYTICS: No posts found across all accounts`);
              analyticsError = 'No posts found - posts may need to be published through GHL Social Planner';
            }
          }

          // Build the response with connected accounts and available analytics
          if (analyticsData && analyticsData.accounts && analyticsData.accounts.length > 0) {
            // We have real analytics data from one or more platforms
            data = {
              summary: {
                totalAccounts: analyticsData.accounts.length,
                totalPosts: analyticsData.totalPosts || 0,
                totalEngagement: analyticsData.totalEngagement || 0,
                averageEngagementRate: analyticsData.averageEngagementRate || 0
              },
              accounts: analyticsData.accounts,
              platformBreakdown: analyticsData.platformBreakdown || {},
              trends: analyticsData.trends || {},
              lastUpdated: new Date().toISOString(),
              locationId: locationId
            };
            console.log(`✅ SOCIAL ANALYTICS: Returned multi-platform analytics for ${data.summary.totalAccounts} accounts`);
          } else {
            // No analytics available - show connected accounts with appropriate messaging
            const accountSummaries = connectedAccounts.map((account: any) => ({
              id: account.id,
              name: account.name,
              platform: account.platform,
              status: 'connected',
              followers: account.followers || 'N/A',
              posts: 0,
              hasAnalytics: false
            }));

            data = {
              summary: {
                totalAccounts: connectedAccounts.length,
                totalPosts: 0,
                totalEngagement: 0,
                averageEngagementRate: 0
              },
              accounts: accountSummaries,
              platformBreakdown: {},
              trends: {},
              lastUpdated: new Date().toISOString(),
              locationId: locationId,
              error: analyticsError,
              note: connectedAccounts.length > 0 ?
                'Social accounts are connected but detailed analytics are not available. This may be because no posts have been published yet, or analytics require a higher GHL plan.' :
                'No social media accounts connected.'
            };
            console.log(`✅ SOCIAL ANALYTICS: Returned ${data.summary.totalAccounts} connected accounts (no posts available)`);
          }

        } catch (error) {
          console.error(`❌ SOCIAL ANALYTICS: Error getting social data for ${locationId}:`, error instanceof Error ? error.message : String(error))

          data = {
            summary: { totalAccounts: 0, totalPosts: 0, totalEngagement: 0, averageEngagementRate: 0 },
            accounts: [],
            platformBreakdown: {},
            trends: {},
            lastUpdated: new Date().toISOString(),
            error: 'Failed to fetch social analytics data'
          }
        }
        break;

      case 'contacts':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for contacts endpoint' },
            { status: 400 }
          )
        }
        // Contacts endpoint requires POST with JSON body
        const contactsBody = {
          locationId: locationId,
          pageLimit: 100
        };
        data = await client.postData('/contacts/search', contactsBody, pitToken);
        break

      case 'pipelines':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for pipelines endpoint' },
            { status: 400 }
          )
        }
        // Get available pipelines from GHL
        console.log(`📊 Pipelines: Getting available pipelines for location ${locationId}`)
        const pipelinesData = await client.getLocationData(`/opportunities/pipelines?locationId=${locationId}`, locationId, pitToken);
        console.log(`📊 Pipelines: Retrieved pipelines data:`, pipelinesData)

        // Extract pipelines array from response (API returns {pipelines: [...]})
        const pipelines = pipelinesData.pipelines || pipelinesData.data || pipelinesData || [];
        console.log(`📊 Pipelines: Extracted ${Array.isArray(pipelines) ? pipelines.length : 'non-array'} pipelines`)

        data = pipelines;
        break

      case 'conversations':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for conversations endpoint' },
            { status: 400 }
          )
        }
        data = await client.getLocationData(`/conversations/search?locationId=${locationId}`, locationId, pitToken);
        break

      case 'contacts-count':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for contacts-count endpoint' },
            { status: 400 }
          )
        }
        console.log(`⚡ LIGHTNING FAST: Getting contacts count for ${locationId} using meta.total`)

        try {
          // LIGHTNING FAST: Get just first page and use meta.total for accurate count
          const contactsData = await client.getLocationData(
            `/contacts?locationId=${locationId}&limit=1&page=1`, // Just 1 contact to get metadata
            locationId,
            pitToken
          ).catch(async (error) => {
            // Check if it's a 401 authentication error
            if (error.message?.includes('401') || error.message?.includes('token expired') || error.message?.includes('Unauthorized')) {
              await logTokenFailure(locationId, `contacts-count-fast`, error.message)
            }
            throw error
          });

          // GHL provides total count in meta field - no need to paginate!
          let totalContacts = 0;
          if (contactsData.meta && contactsData.meta.total !== undefined) {
            totalContacts = contactsData.meta.total;
            console.log(`✅ LIGHTNING: Got accurate total ${totalContacts} contacts from meta.total (1 API call instead of 50+)`)
          } else {
            // Fallback to old method if meta.total not available (rare)
            console.log(`⚠️ LIGHTNING: meta.total not available, falling back to sampling`)
            const contactsInFirstPage = contactsData.contacts?.length || 0;
            // Conservative estimate: assume at least the returned count
            totalContacts = Math.max(contactsInFirstPage, 1);
          }

          data = { count: totalContacts };

        } catch (error) {
          console.error(`❌ LIGHTNING: Error getting contacts count for ${locationId}:`, error);
          data = { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;

      case 'opportunities-count':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for opportunities-count endpoint' },
            { status: 400 }
          )
        }
        console.log(`⚡ LIGHTNING FAST: Getting opportunities count for ${locationId} using meta.total`)

        try {
          // LIGHTNING FAST: Get just first page and use meta.total for accurate count
          const opportunitiesData = await client.getLocationData(
            `/opportunities/search?location_id=${locationId}&limit=1&page=1`, // Just 1 opportunity to get metadata
            locationId,
            pitToken
          ).catch(async (error) => {
            // Check if it's a 401 authentication error
            if (error.message?.includes('401') || error.message?.includes('token expired') || error.message?.includes('Unauthorized')) {
              await logTokenFailure(locationId, `opportunities-count-fast`, error.message)
            }
            throw error
          });

          // GHL provides total count in meta field - no need to paginate!
          let totalOpportunities = 0;
          if (opportunitiesData.meta && opportunitiesData.meta.total !== undefined) {
            totalOpportunities = opportunitiesData.meta.total;
            console.log(`✅ LIGHTNING: Got accurate total ${totalOpportunities} opportunities from meta.total (1 API call instead of 20+)`)
          } else {
            // Fallback to old method if meta.total not available (rare)
            console.log(`⚠️ LIGHTNING: meta.total not available, falling back to sampling`)
            const opportunitiesInFirstPage = opportunitiesData.opportunities?.length || 0;
            // Conservative estimate: assume at least the returned count
            totalOpportunities = Math.max(opportunitiesInFirstPage, 1);
          }

          data = { count: totalOpportunities };

        } catch (error) {
          console.error(`❌ LIGHTNING: Error getting opportunities count for ${locationId}:`, error);
          data = { count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
        break;

      case 'conversations-count':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for conversations-count endpoint' },
            { status: 400 }
          )
        }
        console.log(`⚡ FAST CONVERSATIONS: Getting conversation count for ${locationId}`)

        // OPTIMIZED: Query just one channel (SMS) and estimate total conversations
        // Most locations have SMS as primary channel, gives us good estimate
        const allConversationIds = new Set<string>()
        const channels = ['SMS'] // Just SMS for speed - most conversations are SMS
        let totalMessages = 0
        let totalApiCalls = 0
        const maxApiCallsPerChannel = 3 // Limit to 3 calls per channel for speed

        try {
          // Query each channel separately to get comprehensive coverage
          for (const channel of channels) {
            console.log(`📡 API: Querying channel: ${channel || 'ALL'}`)

            const channelConversationIds = new Set<string>()
            let cursor: string | null = null
            let channelMessages = 0
            let channelApiCalls = 0

            // For each channel, get ALL messages (no time limits)
            do {
              channelApiCalls++
              totalApiCalls++

              const params = new URLSearchParams({
                locationId: locationId,
                limit: '100'  // Max per page for efficiency
              })

              if (cursor) {
                params.append('cursor', cursor)
              }

              // Add channel filter if specified
              if (channel) {
                params.append('channel', channel)
              }

              console.log(`📄 API: Channel ${channel || 'ALL'} - batch ${channelApiCalls}` + (cursor ? ` (cursor: ${cursor.substring(0, 8)}...)` : ''))

              const messagesData = await client.getLocationData(
                `/conversations/messages/export?${params}`,
                locationId,
                pitToken
              ).catch(async (error) => {
                // Check if it's a 401 authentication error
                if (error.message?.includes('401') || error.message?.includes('token expired') || error.message?.includes('Unauthorized')) {
                  await logTokenFailure(locationId, `conversations-count (channel: ${channel || 'ALL'})`, error.message)
                }
                throw error
              })

              console.log(`📊 API: Channel ${channel || 'ALL'} - batch ${channelApiCalls}: ${messagesData.messages?.length || 0} messages`)

              if (messagesData.messages && Array.isArray(messagesData.messages)) {
                // Extract conversation IDs from all messages in this channel
                messagesData.messages.forEach((message: any) => {
                  // Check multiple possible conversation ID fields
                  const convId = message.conversationId || message.conversation_id || message.id
                  if (convId) {
                    channelConversationIds.add(convId)
                  }
                })

                channelMessages += messagesData.messages.length
                cursor = messagesData.nextCursor || messagesData.meta?.nextCursor || null

                console.log(`📊 API: Channel ${channel || 'ALL'} - batch ${channelApiCalls}: +${messagesData.messages.length} messages (${channelMessages} total), ${channelConversationIds.size} unique conversations`)

              } else {
                console.log(`📊 API: No more messages in channel ${channel || 'ALL'} - batch ${channelApiCalls}`)
                cursor = null
              }

              // FAST OPTIMIZATION: Limit API calls per channel for speed
              if (channelApiCalls >= maxApiCallsPerChannel) {
                console.log(`⚡ FAST: Hit limit of ${maxApiCallsPerChannel} API calls for channel ${channel || 'ALL'} (${channelMessages} messages processed)`)
                break
              }

              // Safety: prevent infinite loops per channel (max 100 batches = 10,000 messages per channel)
              if (channelApiCalls >= 100) {
                console.log(`⚠️ API: Hit safety limit for channel ${channel || 'ALL'} (${channelMessages} messages processed)`)
                break
              }

              // Small delay to be API-friendly (100ms between calls)
              if (cursor) {
                await new Promise(resolve => setTimeout(resolve, 100))
              }

            } while (cursor)

            // Add this channel's conversations to the global set
            channelConversationIds.forEach(id => allConversationIds.add(id))
            totalMessages += channelMessages

            console.log(`✅ API: Channel ${channel || 'ALL'} complete: ${channelMessages} messages → ${channelConversationIds.size} conversations`)

            // Small delay between channels to be extra API-friendly
            if (channel !== channels[channels.length - 1]) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }

        } catch (error) {
          console.error(`❌ API: Error during conservative multi-channel conversations counting for ${locationId}:`, error)
          // Return what we have so far, don't fail completely
        }

        let totalConversations = allConversationIds.size
        console.log(`⚡ LIGHTNING CONVERSATIONS: ${locationId} - ${totalConversations} conversations (${totalApiCalls} API calls)`)

        // LIGHTNING OPTIMIZATION: Skip expensive fallback for speed
        // Use SMS-only count even if low - conversations are less critical for dashboard
        // This saves 20-50+ additional API calls per location

        data = { count: totalConversations }
        break;

      case 'lead-sources':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for lead-sources endpoint' },
            { status: 400 }
          )
        }
        console.log(`📊 API: Getting lead sources for ${locationId}`)

        try {
          // Get ALL contacts using GET pagination (same as contacts-count endpoint)
          console.log(`🔍 Lead sources: Fetching ALL contacts for location ${locationId} (GET pagination)`)

          let allContacts: any[] = [];
          let page = 1;
          const pageSize = 100;
          let hasMore = true;

          while (hasMore) {
            console.log(`📄 Lead sources: Fetching contacts page ${page} for ${locationId}`)

            const contactsData = await client.getLocationData(
              `/contacts?locationId=${locationId}&limit=${pageSize}&page=${page}`,
              locationId,
              pitToken
            );

            console.log(`📊 Lead sources: Page ${page} response keys:`, Object.keys(contactsData))
            console.log(`📊 Lead sources: Page ${page} contacts returned:`, contactsData.contacts?.length || 0)

            if (contactsData.contacts && Array.isArray(contactsData.contacts) && contactsData.contacts.length > 0) {
              const pageContactCount = contactsData.contacts.length;
              allContacts = allContacts.concat(contactsData.contacts);

              console.log(`📊 Lead sources: Page ${page}: +${pageContactCount} contacts (total: ${allContacts.length})`)

              // If we get less than pageSize, this is the last page
              if (pageContactCount < pageSize) {
                console.log(`📊 Lead sources: Received ${pageContactCount} < ${pageSize} contacts, this is the last page`)
                hasMore = false;
              } else {
                // Continue to next page
                page++;
                console.log(`📊 Lead sources: Continuing to page ${page}`)
              }
            } else {
              console.log(`📊 Lead sources: No contacts in page ${page}, stopping pagination`)
              hasMore = false;
            }

            // Safety limit to prevent infinite loops
            if (page >= 50) {
              console.log(`📊 Lead sources: Safety limit reached at page ${page}, stopping`)
              hasMore = false;
            }
          }

          console.log(`📊 Lead sources: Total contacts collected: ${allContacts.length}`)

          // Analyze lead sources from ALL contacts with auto-detection
          const sources: Record<string, number> = {};
          let totalLeads = 0;

          if (allContacts && allContacts.length > 0) {
            // FIRST PASS: Analyze which fields have data across this location
            const fieldAnalysis = {
              contactSource: 0,
              contact_source: 0,
              source: 0,
              leadSource: 0,
              origin: 0,
              tags: 0,
              type: 0,
              contactType: 0
            };

            allContacts.forEach((contact: any) => {
              if (contact.contactSource) fieldAnalysis.contactSource++;
              if (contact.contact_source) fieldAnalysis.contact_source++;
              if (contact.source) fieldAnalysis.source++;
              if (contact.leadSource) fieldAnalysis.leadSource++;
              if (contact.origin) fieldAnalysis.origin++;
              if (contact.tags?.length > 0) fieldAnalysis.tags++;
              if (contact.type) fieldAnalysis.type++;
              if (contact.contactType) fieldAnalysis.contactType++;
            });

            // Determine the best field to use (most populated)
            const bestField = Object.entries(fieldAnalysis)
              .filter(([, count]) => count > 0) // Only consider fields with data
              .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'; // Get field with highest count



            // SECOND PASS: Extract sources from multiple fields for comprehensive analysis
            let contactsWithAnySource = 0;

            allContacts.forEach((contact: any) => {
              totalLeads++;

              // Extract from multiple fields to get comprehensive lead sources
              const potentialSources: string[] = [];

              // Always include contact type if it's "lead"
              if (contact.type === 'lead') {
                potentialSources.push('Lead (Contact Type)');
              }

              // Include tags as form names
              if (contact.tags && contact.tags.length > 0) {
                contact.tags.forEach((tag: string) => {
                  if (tag && tag.trim()) {
                    potentialSources.push(`Form: ${tag.trim()}`);
                  }
                });
              }

              // Include other source fields if they have meaningful data
              if (contact.source && contact.source !== 'Unknown' && contact.source !== '') {
                potentialSources.push(`Source: ${contact.source}`);
              }

              if (contact.contactSource && contact.contactSource !== 'Unknown' && contact.contactSource !== '') {
                potentialSources.push(`Contact Source: ${contact.contactSource}`);
              }

              if (contact.origin && contact.origin !== 'Unknown' && contact.origin !== '') {
                potentialSources.push(`Origin: ${contact.origin}`);
              }

              // Count unique contacts with source data
              if (potentialSources.length > 0) {
                contactsWithAnySource++;
              } else {
                potentialSources.push('No Source Data');
              }

              // Count each source attribution
              potentialSources.forEach(source => {
                sources[source] = (sources[source] || 0) + 1;
              });
            });

            // Calculate total source attributions (can be > total contacts)
            const totalSourceAttributions = Object.values(sources).reduce((sum, count) =>
              sum + (count as number), 0) - (sources['No Source Data'] || 0);

            data = {
              totalLeads,
              dataQuality: {
                contactsWithAnySource: contactsWithAnySource,
                contactsWithoutSource: totalLeads - contactsWithAnySource,
                completionRate: totalLeads > 0 ? Math.round((contactsWithAnySource / totalLeads) * 100) : 0,
                totalSourceAttributions: totalSourceAttributions,
                bestFieldUsed: bestField,
                fieldAnalysis
              },
              sources: Object.entries(sources).map(([source, count]) => ({
                source,
                count,
                percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
              })).sort((a, b) => b.count - a.count)
            };

          } else {
            // Fallback for no contacts
            data = {
              totalLeads: 0,
              dataQuality: {
                contactsWithSource: 0,
                contactsWithoutSource: 0,
                completionRate: 0,
                bestFieldUsed: 'none',
                fieldAnalysis: {}
              },
              sources: []
            };
          }

        } catch (error) {
          console.error(`❌ API: Error getting lead sources for ${locationId}:`, error)
          data = {
            totalLeads: 0,
            dataQuality: {
              contactsWithSource: 0,
              contactsWithoutSource: 0,
              completionRate: 0,
              bestFieldUsed: 'error',
              fieldAnalysis: {}
            },
            sources: []
          }
        }
        break

      case 'pipeline-analysis':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for pipeline-analysis endpoint' },
            { status: 400 }
          )
        }
        console.log(`📊 API: Getting pipeline analysis for ${locationId}`)

        try {
          // Get ALL opportunities with pagination (like pipeline-activity-details does)
          console.log(`📊 Pipeline: Getting ALL opportunities with pagination for location ${locationId}`)

          let totalOpportunities = 0;
          let allOpportunities: any[] = [];
          let page = 1;
          const pageSize = 100;
          let hasMore = true;

          while (hasMore) {
            console.log(`📄 Pipeline Analysis: Getting opportunities page ${page} for ${locationId}`)

            const opportunitiesData = await client.getLocationData(
              `/opportunities/search?location_id=${locationId}&limit=${pageSize}&page=${page}`,
              locationId,
              pitToken
            );

            const opportunities = opportunitiesData.opportunities || opportunitiesData.data || opportunitiesData || [];

            if (Array.isArray(opportunities) && opportunities.length > 0) {
              allOpportunities = allOpportunities.concat(opportunities);
              totalOpportunities += opportunities.length;

              if (opportunities.length < pageSize) {
                hasMore = false;
              } else {
                page++;
              }
            } else {
              hasMore = false;
            }

            // Safety limit
            if (page >= 100) {
              console.log(`⚠️ Pipeline Analysis: Hit safety limit`)
              hasMore = false;
            }

            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          console.log(`📊 Pipeline: Got ${totalOpportunities} total opportunities across ${page - 1} pages`)
          console.log(`📊 Pipeline: Sample opportunity:`, allOpportunities?.[0] || 'No opportunities')

          // Analyze pipeline stages with advanced metrics
          const stages: Record<string, {
            count: number,
            value: number,
            avgValue: number,
            wonCount: number,
            lostCount: number,
            avgDaysInStage: number,
            agingCount: number // opportunities older than 30 days
          }> = {};

          let totalValue = 0;
          let totalWon = 0;
          let totalLost = 0;
          let totalClosedValue = 0;
          let avgTimeToClose = 0;
          let agingOpportunities = 0;

          // Process all opportunities
          const opportunities = allOpportunities;
          console.log(`📊 Pipeline: Processing ${Array.isArray(opportunities) ? opportunities.length : 'non-array'} opportunities`)

          if (opportunities && Array.isArray(opportunities)) {
            console.log(`📊 Pipeline: First 3 opportunities:`, opportunities.slice(0, 3))

            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

            opportunities.forEach((opp: any, index: number) => {
              if (index < 5) { // Log first 5 for debugging
                console.log(`📊 Pipeline: Opportunity ${index}:`, {
                  id: opp.id,
                  status: opp.status,
                  stage: opp.stage,
                  pipelineStage: opp.pipelineStage,
                  value: opp.value,
                  amount: opp.amount,
                  dealValue: opp.dealValue,
                  createdAt: opp.createdAt || opp.created_at,
                  updatedAt: opp.updatedAt || opp.updated_at,
                  closedAt: opp.closedAt || opp.closed_at,
                  allKeys: Object.keys(opp)
                })
              }

              const stage = opp.status || opp.stage || opp.pipelineStage || 'Unknown';
              const value = opp.value || opp.amount || opp.dealValue || 0;
              const createdAt = new Date(opp.createdAt || opp.created_at || opp.updatedAt || opp.updated_at || now);
              const updatedAt = new Date(opp.updatedAt || opp.updated_at || opp.createdAt || opp.created_at || now);
              const closedAt = opp.closedAt || opp.closed_at ? new Date(opp.closedAt || opp.closed_at) : null;

              // Calculate days in current stage
              const daysInStage = Math.max(1, Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)));

              // Check if opportunity is aging (older than 30 days)
              const isAging = createdAt < thirtyDaysAgo;

              // Determine win/loss status
              const isWon = stage.toLowerCase().includes('won') || stage.toLowerCase().includes('closed') && !stage.toLowerCase().includes('lost');
              const isLost = stage.toLowerCase().includes('lost') || stage.toLowerCase().includes('disqualified');

              if (!stages[stage]) {
                stages[stage] = {
                  count: 0,
                  value: 0,
                  avgValue: 0,
                  wonCount: 0,
                  lostCount: 0,
                  avgDaysInStage: 0,
                  agingCount: 0
                };
              }

              stages[stage].count++;
              stages[stage].value += value;
              stages[stage].avgDaysInStage = daysInStage; // Simplified - could track per opportunity

              if (isAging) {
                stages[stage].agingCount++;
                agingOpportunities++;
              }

              if (isWon) {
                stages[stage].wonCount++;
                totalWon++;
                totalClosedValue += value;
              } else if (isLost) {
                stages[stage].lostCount++;
                totalLost++;
              }

              totalValue += value;

              // Calculate time to close for closed deals
              if (closedAt && createdAt) {
                const timeToClose = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                avgTimeToClose += timeToClose;
              }
            });

            // Calculate averages and percentages
            Object.keys(stages).forEach(stage => {
              stages[stage].avgValue = stages[stage].count > 0 ?
                Math.round(stages[stage].value / stages[stage].count) : 0;
            });

            // Calculate overall win rate and average time to close
            const totalClosed = totalWon + totalLost;
            const winRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;
            avgTimeToClose = totalClosed > 0 ? Math.round(avgTimeToClose / totalClosed) : 0;
          }

          // Always return real data - no demo data for valid 0 counts
          data = {
            totalOpportunities,
            totalValue,
            totalWon,
            totalLost,
            totalClosedValue,
            winRate: totalWon + totalLost > 0 ? Math.round((totalWon / (totalWon + totalLost)) * 100) : 0,
            avgTimeToClose,
            agingOpportunities,
            stages: Object.entries(stages).map(([stage, stats]) => ({
              stage,
              count: stats.count,
              value: stats.value,
              avgValue: stats.avgValue,
              wonCount: stats.wonCount,
              lostCount: stats.lostCount,
              winRate: (stats.wonCount + stats.lostCount) > 0 ? Math.round((stats.wonCount / (stats.wonCount + stats.lostCount)) * 100) : 0,
              avgDaysInStage: stats.avgDaysInStage,
              agingCount: stats.agingCount,
              percentage: totalOpportunities > 0 ? Math.round((stats.count / totalOpportunities) * 100) : 0
            })).sort((a, b) => b.value - a.value)
          }

        } catch (error) {
          console.error(`❌ API: Error getting pipeline analysis for ${locationId}:`, error)
          data = { totalOpportunities: 0, totalValue: 0, totalWon: 0, totalLost: 0, totalClosedValue: 0, winRate: 0, avgTimeToClose: 0, agingOpportunities: 0, stages: [] }
        }
        break

      case 'activity-metrics':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for activity-metrics endpoint' },
            { status: 400 }
          )
        }
        console.log(`📊 API: Getting activity metrics for ${locationId}`)

        try {
          // Use cached metrics to generate activity data without extra API calls
          const [contactsRes, opportunitiesRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=contacts-count&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`),
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=opportunities-count&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`)
          ]);

          const contactsData = contactsRes.ok ? await contactsRes.json() : { count: 0 };
          const opportunitiesData = opportunitiesRes.ok ? await opportunitiesRes.json() : { count: 0 };

          const totalContacts = contactsData.count || 0;
          const totalOpportunities = opportunitiesData.count || 0;

          // Calculate activity metrics based on existing data
          const activeContactsThisWeek = Math.floor(totalContacts * 0.15); // Estimate 15% active this week
          const totalTasks = totalContacts + totalOpportunities; // Tasks = contacts + opportunities
          const completedTasks = Math.floor(totalTasks * 0.7); // Assume 70% completion rate
          const pendingTasks = Math.floor(totalTasks * 0.25);
          const overdueTasks = totalTasks - completedTasks - pendingTasks;

          // Generate recent activity based on opportunities (more meaningful)
          const recentActivity = Array.from({ length: Math.min(10, totalOpportunities) }, (_, i) => ({
            id: `activity-${i + 1}`,
            title: `Opportunity #${totalOpportunities - i} - Follow up needed`,
            type: 'opportunity_followup',
            completed: i < 3, // Mark first 3 as completed
            dueDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
          }));

          data = {
            totalTasks,
            completedTasks,
            pendingTasks,
            overdueTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            activeContactsThisWeek,
            recentActivity
          };

        } catch (error) {
          console.error(`❌ API: Error getting activity metrics for ${locationId}:`, error)
          data = {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            completionRate: 0,
            activeContactsThisWeek: 0,
            recentActivity: []
          }
        }
        break

      case 'health-score':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for health-score endpoint' },
            { status: 400 }
          )
        }
        console.log(`📊 API: Getting health score for ${locationId}`)

        try {
          // Get comprehensive metrics for health score calculation
          // Use individual try/catch for each fetch to handle errors gracefully
          let lastApiCallTime = 0;
          const fetchWithFallback = async (url: string, fallback: any) => {
            try {
              // Rate limiting: Add 100ms delay between health scoring API calls
              const now = Date.now();
              const timeSinceLastCall = now - lastApiCallTime;
              if (timeSinceLastCall < 100) {
                const waitTime = 100 - timeSinceLastCall;
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              lastApiCallTime = Date.now();

              const response = await fetch(url)
              if (response.ok) {
                return await response.json()
              } else {
                console.warn(`⚠️ API call failed (${response.status}): ${url}`)
                return fallback
              }
            } catch (error) {
              console.warn(`⚠️ API call error: ${url}`, error)
              return fallback
            }
          }

          const [
            contactsData, opportunitiesData, conversationsData,
            leadSourcesData, formsData, formsSubmissionsData,
            surveysData, surveysSubmissionsData, workflowsData,
            pipelinesData, revenueData, socialData
          ] = await Promise.all([
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=contacts-count&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { count: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=opportunities-count&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { count: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=conversations-count&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { count: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=lead-sources&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { totalLeads: 0, sources: [] }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=forms&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { forms: [], totalForms: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=forms-submissions&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { submissions: [], totalSubmissions: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=surveys&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { surveys: [], totalSurveys: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=surveys-submissions&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { submissions: [], totalSurveyResponses: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=workflows&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { workflows: [] }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=pipelines&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, []),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=revenue-metrics&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { totalRevenue: 0, winRate: 0 }),
            fetchWithFallback(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=social-analytics&locationId=${locationId}&pitToken=${encodeURIComponent(pitToken)}`, { summary: { totalAccounts: 0, totalPosts: 0 } })
          ])

          // Extract metrics
          const contacts = contactsData.count || 0
          const opportunities = opportunitiesData.count || 0
          const conversations = conversationsData.count || 0
          const leadSources = leadSourcesData.sources || []
          const forms = formsData.forms || []
          const formSubmissions = formsSubmissionsData.totalSubmissions || 0
          const surveys = surveysData.surveys || []
          const surveySubmissions = surveysSubmissionsData.totalSurveyResponses || 0
          const workflows = workflowsData.workflows || []
          const pipelines = Array.isArray(pipelinesData) ? pipelinesData : []
          const revenue = revenueData.totalRevenue || 0
          const winRate = revenueData.winRate || 0
          const socialAccounts = socialData.summary?.totalAccounts || 0

          // Comprehensive Health Score Calculation (0-100)

          // 1. Lead Generation Health (20% weight)
          const formsScore = Math.min(forms.length * 5, 8) // Up to 8 points for forms
          const surveysScore = Math.min(surveys.length * 4, 6) // Up to 6 points for surveys
          const leadDiversityScore = Math.min(leadSources.length * 3, 6) // Up to 6 points for lead sources
          const leadHealth = Math.min((formsScore + surveysScore + leadDiversityScore), 20)

          // 2. Sales Performance Health (25% weight)
          const opportunitiesScore = Math.min(opportunities / 20 * 10, 10) // 10 points for opportunities
          const pipelinesScore = Math.min(pipelines.length * 5, 8) // 8 points for pipelines
          const revenueScore = Math.min(revenue / 50000 * 7, 7) // 7 points for revenue milestones
          const salesHealth = Math.min((opportunitiesScore + pipelinesScore + revenueScore), 25)

          // 3. Marketing Activity Health (15% weight)
          const socialScore = Math.min(socialAccounts * 5, 8) // 8 points for social accounts
          const marketingWorkflows = workflows.filter((w: any) => w.name?.toLowerCase().includes('marketing') || w.name?.toLowerCase().includes('campaign')).length
          const marketingWorkflowScore = Math.min(marketingWorkflows * 4, 7) // 7 points for marketing automation
          const marketingHealth = Math.min((socialScore + marketingWorkflowScore), 15)

          // 4. Operational Efficiency Health (15% weight)
          const totalWorkflows = workflows.length
          const totalFunnels = forms.length + surveys.length // Using forms/surveys as funnel proxies
          const operationalTools = totalWorkflows + totalFunnels + pipelines.length
          const operationalScore = Math.min(operationalTools * 3, 15) // 15 points for operational setup

          // 5. Customer Engagement Health (15% weight)
          const conversationsScore = Math.min(conversations / 50 * 8, 8) // 8 points for conversations
          const engagementScore = Math.min((formSubmissions + surveySubmissions) / 20 * 7, 7) // 7 points for engagement
          const engagementHealth = Math.min((conversationsScore + engagementScore), 15)

          // 6. Business Foundation Health (10% weight)
          const contactsScore = Math.min(contacts / 50 * 6, 6) // 6 points for contact base
          const foundationScore = Math.min(winRate / 20 * 4, 4) // 4 points for win rate
          const foundationHealth = Math.min((contactsScore + foundationScore), 10)

          // Calculate final comprehensive health score
          const comprehensiveHealthScore = Math.round(
            leadHealth + salesHealth + marketingHealth + operationalScore + engagementHealth + foundationHealth
          )

          const healthScore = Math.max(0, Math.min(100, comprehensiveHealthScore))

          data = {
            score: Math.max(0, Math.min(100, healthScore)), // Clamp between 0-100
            breakdown: {
              contacts: Math.round(contactsScore),
              opportunities: Math.round(opportunitiesScore),
              conversations: Math.round(conversationsScore)
            },
            metrics: {
              contacts,
              opportunities,
              conversations
            }
          }

        } catch (error) {
          console.error(`❌ API: Error getting health score for ${locationId}:`, error)
          data = { score: 0, breakdown: { contacts: 0, opportunities: 0, conversations: 0 }, metrics: { contacts: 0, opportunities: 0, conversations: 0 } }
        }
        break

      case 'revenue-metrics':
        console.log(`⚠️ Revenue metrics disabled - returning placeholder message`)
        data = {
          disabled: true,
          message: "Revenue data is manually entered by humans and may be inaccurate. Calculations disabled to prevent false analytics.",
          totalRevenue: 0,
          totalOpportunities: 0,
          wonOpportunities: 0,
          lostOpportunities: 0,
          avgDealSize: 0,
          winRate: 0,
          totalLostValue: 0,
          monthlyRevenue: []
        }
        break

      case 'forms':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for forms endpoint' },
            { status: 400 }
          )
        }

        try {
          // Get ALL available forms from GHL - try with large limit first
          console.log(`📊 FORMS API: Starting call for location ${locationId}`)

          // Try with a large limit to get all forms at once (some APIs support this)
          const formsData = await client.makeRequest(
            `/forms/?locationId=${locationId}&limit=100`,
            'GET', undefined, pitToken
          );

          console.log(`📊 FORMS API: Raw response received:`, typeof formsData)
          console.log(`📊 FORMS API: Response keys:`, formsData ? Object.keys(formsData) : 'NO RESPONSE')
          console.log(`📊 FORMS API: Has data:`, !!formsData)

          // Handle different response structures - GHL typically returns forms array directly
          let forms = [];
          if (Array.isArray(formsData)) {
            console.log(`📊 FORMS API: Response is direct array with ${formsData.length} items`)
            forms = formsData;
          } else if (formsData.forms && Array.isArray(formsData.forms)) {
            console.log(`📊 FORMS API: Response has forms property with ${formsData.forms.length} items`)
            forms = formsData.forms;
          } else if (formsData.data && Array.isArray(formsData.data)) {
            console.log(`📊 FORMS API: Response has data property with ${formsData.data.length} items`)
            forms = formsData.data;
          } else {
            console.log(`📊 FORMS API: Unknown response structure, forms array empty`)
          }

          console.log(`📊 FORMS API: Final forms count: ${forms.length}`)

          // Save forms data to database
          if (forms.length > 0) {
            try {
              console.log(`💾 Saving ${forms.length} forms to database...`)

              // Initialize Supabase client
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )

              // Save forms to database
              const formsToSave = forms.map((form: any) => ({
                id: form.id,
                location_id: locationId,
                name: form.name || `Form ${form.id.slice(-4)}`,
                type: form.type || 'form',
                status: 'active'
              }))

              const { error: formsError } = await supabase
                .from('forms')
                .upsert(formsToSave, { onConflict: 'id' })

              if (formsError) {
                console.error('❌ Error saving forms to database:', formsError)
              } else {
                console.log(`✅ Saved ${forms.length} forms to database`)
              }

              // Save basic analytics data for today
              const today = new Date().toISOString().split('T')[0]
              const analyticsToSave = forms.map((form: any) => ({
                form_id: form.id,
                location_id: locationId,
                date: today,
                views: 0, // Would need GHL to provide this
                submissions: 0, // Will be updated when processing submissions
                completions: 0,
                qualified_leads: 0,
                opportunities_created: 0
              }))

              const { error: analyticsError } = await supabase
                .from('form_analytics')
                .upsert(analyticsToSave, { onConflict: 'form_id,date' })

              if (analyticsError) {
                console.error('❌ Error saving form analytics to database:', analyticsError)
              } else {
                console.log(`✅ Saved analytics for ${forms.length} forms`)
              }

            } catch (dbError) {
              console.error('❌ Database save error:', dbError)
              // Don't fail the API call if database save fails
            }
          }

          data = {
            forms: forms,
            totalForms: forms.length
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Error getting forms for ${locationId}:`, errorMessage)
          // Check if it's a 422 error (endpoint not supported)
          if (errorMessage && errorMessage.includes('422')) {
            console.log(`⚠️ Forms API not supported for this GHL account (422 error)`)
          }
          data = { forms: [], totalForms: 0 }
        }
        break

      case 'forms-submissions':
        try {
          // Get form submissions from GHL
          console.log(`📊 Form Submissions: Calling API for location ${locationId}`)
          const submissionsData = await client.makeRequest(`/forms/submissions?locationId=${locationId}&limit=100`, 'GET', undefined, pitToken);
          console.log(`📊 Form Submissions: Full response:`, JSON.stringify(submissionsData, null, 2))
          console.log(`📊 Form Submissions: Response status check - has data:`, !!submissionsData)

          // Handle different response structures - GHL typically returns submissions array directly
          let submissions = [];
          if (Array.isArray(submissionsData)) {
            submissions = submissionsData;
          } else if (submissionsData.submissions && Array.isArray(submissionsData.submissions)) {
            submissions = submissionsData.submissions;
          } else if (submissionsData.data && Array.isArray(submissionsData.data)) {
            submissions = submissionsData.data;
          }

          console.log(`📊 Form Submissions: Processing ${submissions.length} submissions`)

          // Update form analytics with submission counts
          if (submissions.length > 0) {
            try {
              console.log(`📊 Updating form analytics with submission data...`)

              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )

              // Group submissions by form ID
              const submissionCounts: Record<string, number> = {}
              submissions.forEach((submission: any) => {
                const formId = submission.formId || submission.form_id
                if (formId) {
                  submissionCounts[formId] = (submissionCounts[formId] || 0) + 1
                }
              })

              // Update analytics for each form
              const today = new Date().toISOString().split('T')[0]
              const analyticsUpdates = Object.entries(submissionCounts).map(([formId, count]) => ({
                form_id: formId,
                location_id: locationId,
                date: today,
                submissions: count
              }))

              if (analyticsUpdates.length > 0) {
                const { error: updateError } = await supabase
                  .from('form_analytics')
                  .upsert(analyticsUpdates, { onConflict: 'form_id,date' })

                if (updateError) {
                  console.error('❌ Error updating form analytics:', updateError)
                } else {
                  console.log(`✅ Updated analytics for ${analyticsUpdates.length} forms with submission counts`)
                }
              }

            } catch (dbError) {
              console.error('❌ Database update error:', dbError)
            }
          }

          data = {
            submissions: submissions,
            totalSubmissions: submissions.length
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Error getting form submissions:`, errorMessage)
          // Check if it's a 422 error (endpoint not supported)
          if (errorMessage && errorMessage.includes('422')) {
            console.log(`⚠️ Form Submissions API not supported for this GHL account (422 error)`)
          }
          data = { submissions: [], totalSubmissions: 0 }
        }
        break

      case 'surveys':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for surveys endpoint' },
            { status: 400 }
          )
        }

        try {
          // Get survey templates from GHL
          console.log(`📊 Surveys: Calling API for location ${locationId}`)
          const surveysData = await client.makeRequest(`/surveys/?locationId=${locationId}&limit=50`, 'GET', undefined, pitToken, { 'Version': '2021-07-28' });
          console.log(`📊 Surveys: Full response:`, JSON.stringify(surveysData, null, 2))
          console.log(`📊 Surveys: Response status check - has data:`, !!surveysData)

          // Handle different response structures
          const surveys = surveysData.surveys || surveysData.data || surveysData || [];
          console.log(`📊 Surveys: Processing ${Array.isArray(surveys) ? surveys.length : 'non-array'} surveys`)

          // Save surveys data to database (similar to forms)
          if (Array.isArray(surveys) && surveys.length > 0) {
            try {
              console.log(`💾 Saving ${surveys.length} surveys to database...`)

              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )

              // Save surveys as forms with type 'survey'
              const surveysToSave = surveys.map((survey: any) => ({
                id: survey.id,
                location_id: locationId,
                name: survey.name || `Survey ${survey.id.slice(-4)}`,
                type: 'survey',
                status: 'active'
              }))

              const { error: surveysError } = await supabase
                .from('forms')
                .upsert(surveysToSave, { onConflict: 'id' })

              if (surveysError) {
                console.error('❌ Error saving surveys to database:', surveysError)
              } else {
                console.log(`✅ Saved ${surveys.length} surveys to database`)
              }

            } catch (dbError) {
              console.error('❌ Database save error for surveys:', dbError)
            }
          }

          data = {
            surveys: Array.isArray(surveys) ? surveys : [],
            totalSurveys: Array.isArray(surveys) ? surveys.length : 0
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Error getting surveys for ${locationId}:`, errorMessage)
          // Check if it's a 422 error (endpoint not supported)
          if (errorMessage && errorMessage.includes('422')) {
            console.log(`⚠️ Surveys API not supported for this GHL account (422 error)`)
          }
          data = { surveys: [], totalSurveys: 0 }
        }
        break

      case 'surveys-submissions':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for surveys-submissions endpoint' },
            { status: 400 }
          )
        }

        try {
          console.log(`📊 Survey Submissions: Calling /surveys/submissions with Version header`)

          // Call the REAL surveys/submissions endpoint with required Version header
          // Add back date filtering to get ALL historical responses (startAt defaults to last month otherwise)
          const surveyResponsesData = await client.makeRequest(
            `/surveys/submissions?locationId=${locationId}&limit=100&page=1&startAt=2020-01-01&endAt=${new Date().toISOString().split('T')[0]}`,
            'GET',
            undefined,
            pitToken,
            { 'Version': '2021-07-28' } // REQUIRED header for surveys API
          );

          console.log(`📊 Survey Submissions: Full response:`, JSON.stringify(surveyResponsesData, null, 2))

          // Handle response structure
          let submissions = surveyResponsesData.submissions || surveyResponsesData.data || surveyResponsesData || [];
          console.log(`📊 Survey Submissions: Processing ${Array.isArray(submissions) ? submissions.length : 'non-array'} submissions`)

          // TEMPORARILY DISABLE LOCATION FILTERING FOR SURVEY SUBMISSIONS
          // User reports this was working before and each location showed their own responses
          // Need to investigate the correct filtering approach without breaking functionality
          console.log(`📊 Survey Submissions: Total ${submissions.length} submissions available for all locations (filtering disabled)`)

          // Update survey analytics with submission counts
          if (Array.isArray(submissions) && submissions.length > 0) {
            try {
              console.log(`📊 Updating survey analytics with submission data...`)

              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )

              // Group submissions by survey ID
              const submissionCounts: Record<string, number> = {}
              submissions.forEach((submission: any) => {
                const surveyId = submission.surveyId || submission.survey_id
                if (surveyId) {
                  submissionCounts[surveyId] = (submissionCounts[surveyId] || 0) + 1
                }
              })

              // Update analytics for each survey
              const today = new Date().toISOString().split('T')[0]
              const analyticsUpdates = Object.entries(submissionCounts).map(([surveyId, count]) => ({
                form_id: surveyId, // Note: surveys are stored as forms with type 'survey'
                location_id: locationId,
                date: today,
                submissions: count
              }))

              if (analyticsUpdates.length > 0) {
                const { error: updateError } = await supabase
                  .from('form_analytics')
                  .upsert(analyticsUpdates, { onConflict: 'form_id,date' })

                if (updateError) {
                  console.error('❌ Error updating survey analytics:', updateError)
                } else {
                  console.log(`✅ Updated analytics for ${analyticsUpdates.length} surveys with submission counts`)
                }
              }

            } catch (dbError) {
              console.error('❌ Database update error for survey submissions:', dbError)
            }
          }

          data = {
            submissions: Array.isArray(submissions) ? submissions : [],
            totalSurveyResponses: Array.isArray(submissions) ? submissions.length : 0
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Error getting survey submissions for ${locationId}:`, errorMessage)
          // Check if it's a 422 error (endpoint not supported)
          if (errorMessage && errorMessage.includes('422')) {
            console.log(`⚠️ Survey Responses API not supported for this GHL account (422 error)`)
          }
          data = { submissions: [], totalSurveyResponses: 0 }
        }
        break

      case 'survey-responses-detailed':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for survey-responses-detailed endpoint' },
            { status: 400 }
          )
        }

        try {
          const { surveyId, startDate, endDate, page = '1', limit = '10' } = Object.fromEntries(searchParams)

          console.log(`📊 Survey Responses Detailed: Calling API for location ${locationId}, survey ${surveyId || 'all'}, page ${page}, limit ${limit}`)

          // Build query parameters
          const params = new URLSearchParams({
            locationId,
            limit,
            page
          })

          if (surveyId) params.append('surveyId', surveyId)
          if (startDate) params.append('startDate', startDate)
          if (endDate) params.append('endDate', endDate)

          const responsesData = await client.makeRequest(`/surveys/responses?${params}`, 'GET', undefined, pitToken, { 'Version': '2021-07-28' })
          console.log(`📊 Survey Responses Detailed: Full response:`, JSON.stringify(responsesData, null, 2))

          // Handle different response structures
          const responses = responsesData.responses || responsesData.data || responsesData.submissions || responsesData || []
          console.log(`📊 Survey Responses Detailed: Processing ${Array.isArray(responses) ? responses.length : 'non-array'} responses`)

          // Format responses with proper date handling
          const formattedResponses = Array.isArray(responses) ? responses.map((r: any) => ({
            id: r.id,
            contactId: r.contactId || r.contact_id,
            surveyId: r.surveyId || r.survey_id || surveyId,
            name: r.name || r.contact?.name || 'Unknown',
            email: r.email || r.contact?.email || '',
            submittedAt: r.submittedAt || r.submitted_at || r.createdAt || r.created_at,
            createdAt: r.createdAt || r.created_at,
            answers: r.answers || r.responses || r.fields || {},
            others: r
          })) : []

          data = {
            responses: formattedResponses,
            totalCount: responsesData.totalCount || responsesData.total || formattedResponses.length,
            page: parseInt(page),
            limit: parseInt(limit)
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Error getting detailed survey responses for ${locationId}:`, errorMessage)
          // Check if it's a 422 error (endpoint not supported)
          if (errorMessage && errorMessage.includes('422')) {
            console.log(`⚠️ Survey Responses Detailed API not supported for this GHL account (422 error)`)
          }
          data = { responses: [], totalCount: 0, page: 1, limit: 10 }
        }
        break

      case 'pipeline-activity-details':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for pipeline-activity-details endpoint' },
            { status: 400 }
          )
        }

  try {
    console.log(`📊 Pipeline Activity: Getting detailed activity data for ${locationId}`)

    // FIRST: Get pipelines data for stages count calculation
    const pipelinesData = await client.getLocationData(
      `/opportunities/pipelines?locationId=${locationId}`,
      locationId,
      pitToken
    );
    const pipelines = pipelinesData.pipelines || pipelinesData.data || pipelinesData || [];
    console.log(`📊 Pipeline Activity: Found ${Array.isArray(pipelines) ? pipelines.length : 0} pipelines for reference`)

    // THEN: Get ALL opportunities with pagination to get real timestamps
          let totalOpportunities = 0;
          let allOpportunities: any[] = [];
          let page = 1;
          const pageSize = 100;
          let hasMore = true;

          while (hasMore) {
            console.log(`📄 Getting opportunities page ${page} for activity analysis`)

            const oppData = await client.getLocationData(
              `/opportunities/search?location_id=${locationId}&limit=${pageSize}&page=${page}`,
              locationId,
              pitToken
            );

            const opportunities = oppData.opportunities || oppData.data || oppData || [];

            if (Array.isArray(opportunities) && opportunities.length > 0) {
              allOpportunities = allOpportunities.concat(opportunities);
              totalOpportunities += opportunities.length;

              if (opportunities.length < pageSize) {
                hasMore = false;
              } else {
                page++;
              }
            } else {
              hasMore = false;
            }

            // Safety limit
            if (page >= 100) {
              console.log(`⚠️ Hit safety limit`)
              hasMore = false;
            }

            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          // Analyze real activity data - use days parameter for filtering
          const now = new Date();
          const { fromDate } = getDateRange(days);

          // Calculate date ranges based on the selected time period
          const selectedDaysAgo = days && days !== 'all' ? new Date(fromDate) : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

          let newOpportunities7Days = 0;
          let newOpportunities30Days = 0;
          let newOpportunitiesSelectedPeriod = 0;
          let recentStageChanges = 0;
          const pipelineActivity: Record<string, {
            totalOpportunities: number;
            newThisWeek: number;
            newThisMonth: number;
            recentStageChanges: number;
            velocity: number;
            lastActivity: Date | null;
          }> = {};

          // Process each opportunity
          allOpportunities.forEach((opp: any, index: number) => {
            // Debug first few opportunities
            if (index < 3) {
              console.log(`📊 Opportunity ${index} date debug:`, {
                id: opp.id,
                createdAt: opp.createdAt,
                created_at: opp.created_at,
                updatedAt: opp.updatedAt,
                updated_at: opp.updated_at,
                dateAdded: opp.dateAdded,
                dateUpdated: opp.dateUpdated
              })
            }

            const pipelineId = opp.pipeline || opp.pipelineId || opp.pipeline_id || opp.pipelineId;

            // Better date parsing - try multiple GHL date formats
            let createdAt = now;
            let updatedAt = now;

            // Try different date field names that GHL uses
            const dateFields = [
              opp.createdAt, opp.created_at, opp.dateAdded, opp.updatedAt,
              opp.updated_at, opp.dateUpdated, opp.dateCreated, opp.created
            ];

            // Parse created date
            for (const dateField of dateFields) {
              if (dateField) {
                try {
                  createdAt = new Date(dateField);
                  if (!isNaN(createdAt.getTime())) break;
                } catch (e) {
                  // Continue to next field
                }
              }
            }

            // Parse updated date (prefer updated fields)
            const updateFields = [
              opp.updatedAt, opp.updated_at, opp.dateUpdated, opp.dateModified,
              opp.modifiedAt, opp.modified_at, opp.createdAt, opp.created_at, opp.dateAdded
            ];

            for (const dateField of updateFields) {
              if (dateField) {
                try {
                  updatedAt = new Date(dateField);
                  if (!isNaN(updatedAt.getTime())) break;
                } catch (e) {
                  // Continue to next field
                }
              }
            }

            if (pipelineId) {
              if (!pipelineActivity[pipelineId]) {
                pipelineActivity[pipelineId] = {
                  totalOpportunities: 0,
                  newThisWeek: 0,
                  newThisMonth: 0,
                  recentStageChanges: 0,
                  velocity: 0,
                  lastActivity: null
                };
              }

              pipelineActivity[pipelineId].totalOpportunities++;

              // Check if opportunity was created recently
              if (createdAt >= sevenDaysAgo) {
                pipelineActivity[pipelineId].newThisWeek++;
                newOpportunities7Days++;
              }
              if (createdAt >= thirtyDaysAgo) {
                pipelineActivity[pipelineId].newThisMonth++;
                newOpportunities30Days++;
              }
              if (createdAt >= selectedDaysAgo) {
                newOpportunitiesSelectedPeriod++;
              }

              // Check for recent stage changes (updated recently)
              if (updatedAt >= sevenDaysAgo && updatedAt > createdAt) {
                pipelineActivity[pipelineId].recentStageChanges++;
                recentStageChanges++;
              }

              // Track last activity
              const lastActivity = updatedAt > createdAt ? updatedAt : createdAt;
              if (!pipelineActivity[pipelineId].lastActivity ||
                  lastActivity > pipelineActivity[pipelineId].lastActivity) {
                pipelineActivity[pipelineId].lastActivity = lastActivity;
              }
            }
          });

    // Calculate velocity for each pipeline
    Object.keys(pipelineActivity).forEach(pipelineId => {
      const pipeline = pipelines.find((p: any) => p.id === pipelineId);
      const stages = pipeline?.stages?.length || 1;
            pipelineActivity[pipelineId].velocity = Math.max(1,
              Math.floor(pipelineActivity[pipelineId].totalOpportunities / stages)
            );
          });

          // Generate real activity timeline events (not fake ones)
          const timelineEvents: any[] = [];

          // Add real events based on actual opportunity data
          Object.entries(pipelineActivity).forEach(([pipelineId, data]) => {
            if (data.newThisWeek > 0) {
              timelineEvents.push({
                id: `new-${pipelineId}`,
                type: 'new_opportunities',
                title: `${data.newThisWeek} New Opportunities Added`,
                description: `${data.newThisWeek} new opportunities added to pipeline`,
                pipelineId,
                time: data.lastActivity || now,
                count: data.newThisWeek
              });
            }

            if (data.recentStageChanges > 0) {
              timelineEvents.push({
                id: `changes-${pipelineId}`,
                type: 'stage_changes',
                title: `${data.recentStageChanges} Stage Changes`,
                description: `${data.recentStageChanges} opportunities moved between stages`,
                pipelineId,
                time: data.lastActivity || now,
                count: data.recentStageChanges
              });
            }
          });

          // Sort timeline events by time (most recent first)
          timelineEvents.sort((a, b) => b.time.getTime() - a.time.getTime());

          data = {
            pipelineActivity,
            summary: {
              totalOpportunities,
              newOpportunities7Days,
              newOpportunities30Days,
              newOpportunitiesSelectedPeriod,
              recentStageChanges
            },
            timelineEvents: timelineEvents.slice(0, 10) // Top 10 recent events
          };

          console.log(`📊 Pipeline Activity: Completed analysis with ${Object.keys(pipelineActivity).length} active pipelines`)

        } catch (error) {
          console.error(`❌ API: Error getting pipeline activity details for ${locationId}:`, error)
          data = {
            pipelineActivity: {},
            summary: { totalOpportunities: 0, newOpportunities7Days: 0, newOpportunities30Days: 0, recentStageChanges: 0 },
            timelineEvents: []
          }
        }
        break;

      case 'pipeline-opportunity-counts':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for pipeline-opportunity-counts endpoint' },
            { status: 400 }
          )
        }

        try {
          console.log(`📊 Pipeline Counts: Getting pipeline-specific opportunity counts for ${locationId}`)

          // Get ALL opportunities with pagination (like opportunities-count does)
          let totalOpportunities = 0;
          let allOpportunities: any[] = [];
          let page = 1;
          const pageSize = 100;
          let hasMore = true;

          while (hasMore) {
            console.log(`📄 Getting opportunities page ${page} for ${locationId}`)

            const oppData = await client.getLocationData(
              `/opportunities/search?location_id=${locationId}&limit=${pageSize}&page=${page}`,
              locationId,
              pitToken
            );

            const opportunities = oppData.opportunities || oppData.data || oppData || [];

            if (Array.isArray(opportunities) && opportunities.length > 0) {
              allOpportunities = allOpportunities.concat(opportunities);
              totalOpportunities += opportunities.length;

              console.log(`📊 Page ${page}: +${opportunities.length} opportunities (total: ${totalOpportunities})`)

              // Log first opportunity fields to see pipeline field and timestamps
              if (page === 1 && opportunities.length > 0) {
                console.log(`📊 Sample opportunity fields:`, Object.keys(opportunities[0]))
                console.log(`📊 Sample opportunity date fields:`, {
                  createdAt: opportunities[0].createdAt,
                  created_at: opportunities[0].created_at,
                  updatedAt: opportunities[0].updatedAt,
                  updated_at: opportunities[0].updated_at,
                  dateAdded: opportunities[0].dateAdded,
                  dateUpdated: opportunities[0].dateUpdated
                })
                console.log(`📊 Sample opportunity pipeline fields:`, {
                  pipeline: opportunities[0].pipeline,
                  pipelineId: opportunities[0].pipelineId,
                  pipeline_id: opportunities[0].pipeline_id,
                  stage: opportunities[0].stage,
                  status: opportunities[0].status
                })
              }

              if (opportunities.length < pageSize) {
                hasMore = false;
              } else {
                page++;
              }
            } else {
              hasMore = false;
            }

            // Safety limit
            if (page >= 100) {
              console.log(`⚠️ Hit safety limit`)
              hasMore = false;
            }

            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          // Group opportunities by pipeline
          const pipelineCounts: Record<string, number> = {};

          allOpportunities.forEach((opp: any) => {
            // Try different possible pipeline field names
            const pipelineId = opp.pipeline || opp.pipelineId || opp.pipeline_id || opp.pipelineId;

            if (pipelineId) {
              pipelineCounts[pipelineId] = (pipelineCounts[pipelineId] || 0) + 1;
            } else {
              console.log(`⚠️ Opportunity ${opp.id} has no pipeline field:`, opp)
            }
          });

          console.log(`📊 Final pipeline counts:`, pipelineCounts)

          data = { pipelineCounts };
          console.log(`📊 Pipeline Counts: Completed with ${Object.keys(pipelineCounts).length} pipeline counts`)

        } catch (error) {
          console.error(`❌ API: Error getting pipeline opportunity counts for ${locationId}:`, error)
          data = { pipelineCounts: {} }
        }
        break;

      case 'campaigns':
        // DISABLED: Campaigns API returns fake data for this account
        // Keeping UI intact but preventing fake campaign display
        console.log('Campaigns disabled - preventing fake data display')
        data = { campaigns: [] }
        break;

      case 'funnels':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for funnels endpoint' },
            { status: 400 }
          )
        }

        try {
          console.log(`📊 Funnels: Attempting comprehensive funnel check for ${locationId}`)

          // STRATEGY 1: Get official GHL funnel data (now working!)
          let funnelsData = null;

          try {
            console.log(`🔄 Funnels: Getting official GHL funnel data...`)
            console.log(`🔑 Using pitToken: ${pitToken ? pitToken.substring(0, 10) + '...' : 'NO TOKEN'}`)

            // Get funnels list - this is now working!
            funnelsData = await client.getLocationData(
              `/funnels/funnel/list?locationId=${locationId}`,
              locationId,
              pitToken
            );

            console.log(`✅ Funnels: Official GHL funnel API successful!`)
            console.log(`📊 Funnels response:`, JSON.stringify(funnelsData, null, 2).substring(0, 500) + '...')

          } catch (officialApiError) {
            console.log(`⚠️ Funnels: Official API failed:`, officialApiError instanceof Error ? officialApiError.message : 'Unknown error')
            console.log(`🔍 Funnels: Full error details:`, officialApiError)
            console.log(`🔄 Funnels: Falling back to custom analytics...`)
          }

          // STRATEGY 2: Custom funnel analytics from opportunities/pipelines
          let customAnalytics = null;

          if (!funnelsData) {
            try {
              console.log(`📊 Funnels: Building custom funnel analytics from opportunities...`)

              // Get ALL opportunities with pagination
              let totalOpportunities = 0;
              let allOpportunities: any[] = [];
              let page = 1;
              const pageSize = 100;
              let hasMore = true;

              while (hasMore && page <= 10) { // Limit to 10 pages for performance
                const oppData = await client.getLocationData(
                  `/opportunities/search?location_id=${locationId}&limit=${pageSize}&page=${page}`,
                  locationId,
                  pitToken
                );

                const opportunities = oppData.opportunities || oppData.data || oppData || [];
                if (Array.isArray(opportunities) && opportunities.length > 0) {
                  allOpportunities = allOpportunities.concat(opportunities);
                  totalOpportunities += opportunities.length;

                  if (opportunities.length < pageSize) {
                    hasMore = false;
                  } else {
                    page++;
                  }
                } else {
                  hasMore = false;
                }
              }

              // Get pipeline structure
              const pipelinesData = await client.getLocationData(
                `/opportunities/pipelines?locationId=${locationId}`,
                locationId,
                pitToken
              );
              const pipelines = pipelinesData.pipelines || pipelinesData.data || pipelinesData || [];

              // Build custom funnel analytics
              const customFunnels: any[] = [];

              if (Array.isArray(pipelines)) {
                pipelines.forEach((pipeline: any) => {
                  const pipelineOpportunities = allOpportunities.filter((opp: any) =>
                    opp.pipeline === pipeline.id || opp.pipelineId === pipeline.id || opp.pipeline_id === pipeline.id
                  );

                  if (pipelineOpportunities.length > 0) {
                    // Create stage analysis
                    const stages: Record<string, any> = {};
                    let totalValue = 0;
                    let wonValue = 0;
                    let wonCount = 0;
                    let lostCount = 0;

                    pipelineOpportunities.forEach((opp: any) => {
                      const stage = opp.status || opp.stage || opp.pipelineStage || 'Unknown';
                      const value = opp.value || opp.amount || opp.dealValue || 0;

                      if (!stages[stage]) {
                        stages[stage] = { count: 0, value: 0 };
                      }
                      stages[stage].count++;
                      stages[stage].value += value;
                      totalValue += value;

                      // Determine win/loss
                      const stageLower = stage.toLowerCase();
                      if (stageLower.includes('won') || stageLower.includes('closed') && !stageLower.includes('lost')) {
                        wonCount++;
                        wonValue += value;
                      } else if (stageLower.includes('lost') || stageLower.includes('disqualified')) {
                        lostCount++;
                      }
                    });

                    const winRate = (wonCount + lostCount) > 0 ?
                      Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

                    customFunnels.push({
                      id: pipeline.id,
                      name: `${pipeline.name || 'Pipeline'} (Analytics)`,
                      type: 'analytics',
                      status: 'active',
                      totalOpportunities: pipelineOpportunities.length,
                      totalValue,
                      wonOpportunities: wonCount,
                      winRate,
                      avgDealSize: wonCount > 0 ? Math.round(wonValue / wonCount) : 0,
                      stages: Object.entries(stages).map(([stageName, stageData]: [string, any]) => ({
                        name: stageName,
                        count: stageData.count,
                        value: stageData.value,
                        percentage: Math.round((stageData.count / pipelineOpportunities.length) * 100)
                      })),
                      source: 'custom_analytics'
                    });
                  }
                });
              }

              customAnalytics = {
                funnels: customFunnels,
                totalFunnels: customFunnels.length,
                source: 'custom_analytics'
              };

            } catch (analyticsError) {
              console.log(`❌ Funnels: Custom analytics also failed:`, analyticsError instanceof Error ? analyticsError.message : 'Unknown error')
            }
          }

          // PRIORITIZE REAL GHL DATA OVER CUSTOM ANALYTICS
          const officialFunnels = funnelsData ? (funnelsData.funnels || funnelsData.data || funnelsData || []) : [];

          // Format real GHL funnel data
          const formattedFunnels = officialFunnels.map((funnel: any) => {
            // Calculate total pages across all steps
            const totalPages = funnel.steps ?
              funnel.steps.reduce((sum: number, step: any) => sum + (step.pages?.length || 0), 0) : 0;

            return {
              id: funnel._id,
              name: funnel.name,
              type: funnel.type, // "website" or "funnel"
              source: 'ghl_official',
              url: funnel.url,
              pageCount: totalPages,
              status: funnel.deleted ? 'deleted' : (funnel.processing ? 'processing' : 'active'),
              lastUpdated: funnel.updatedAt || funnel.dateUpdated,
              locationId: funnel.locationId,
              steps: funnel.steps || [],
              hasChatWidget: funnel.isChatWidgetLive || false,
              hasStore: funnel.isStoreActive || false,
              faviconUrl: funnel.faviconUrl || null,
              description: funnel.description || null
            };
          });

          // Build response using REAL GHL data
          const response = {
            funnels: formattedFunnels,
            summary: {
              totalFunnels: formattedFunnels.length,
              totalPages: formattedFunnels.reduce((sum: number, f: any) => sum + f.pageCount, 0),
              websites: formattedFunnels.filter((f: any) => f.type === 'website').length,
              marketingFunnels: formattedFunnels.filter((f: any) => f.type === 'funnel').length,
              activeFunnels: formattedFunnels.filter((f: any) => f.status === 'active').length
            },
            apiStatus: {
              officialApiAvailable: !!funnelsData,
              customAnalyticsAvailable: !!customAnalytics,
              hasRealFunnelData: formattedFunnels.length > 0
            },
            success: formattedFunnels.length > 0,
            message: formattedFunnels.length > 0 ?
              `Successfully retrieved ${formattedFunnels.length} real GHL funnels with ${formattedFunnels.reduce((sum: number, f: any) => sum + f.pageCount, 0)} total pages` :
              'No funnel data available from GHL API.'
          };

          data = response;
          console.log(`✅ Funnels: Completed with ${formattedFunnels.length} real GHL funnels`)

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ API: Complete funnel check failure for ${locationId}:`, errorMessage)

          data = {
            funnels: [],
            summary: { totalFunnels: 0, officialFunnels: 0, customAnalyticsFunnels: 0 },
            apiStatus: { officialApiAvailable: false, customAnalyticsAvailable: false },
            success: false,
            error: errorMessage,
            message: 'Funnel data unavailable. Check GHL plan or IAM configuration.'
          }
        }
        break;

      case 'website-analytics':
        // Website analytics from our custom tracking system
        try {
          console.log(`📊 Website Analytics: Fetching data for location ${locationId}`)

          // For website analytics, we need to aggregate data from all funnels for this location
          // First, get all funnels for this location
          const funnelsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=funnels&locationId=${locationId}`)
          const funnelsData = funnelsResponse.ok ? await funnelsResponse.json() : { funnels: [] }

          // Generate siteIds for all funnels using the same logic as generateFunnelSiteId
          const siteIds: string[] = []
          if (funnelsData?.funnels) {
            funnelsData.funnels.forEach((funnel: any) => {
              try {
                // Use the same siteId generation logic as generateFunnelSiteId
                if (funnel.id) {
                  siteIds.push(`funnel-${funnel.id}`);
                } else if (funnel.name) {
                  const normalizedName = funnel.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                  siteIds.push(normalizedName);
                }
              } catch (error) {
                console.warn('Failed to generate siteId for funnel:', funnel.id || funnel.name);
              }
            });
          }

          // Fallback to location-based siteId if no funnels found
          if (siteIds.length === 0) {
            siteIds.push(`site-${locationId}`);
          }

          console.log(`📊 Website Analytics: Fetching data for ${siteIds.length} sites:`, siteIds)

          // Fetch analytics data for ALL sites associated with this location
          const analyticsPromises = siteIds.map(siteId =>
            fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/analytics?siteId=${siteId}&days=30`)
              .then(res => res.ok ? res.json() : { pageViews: 0, uniqueVisitors: 0, sessions: 0, avgSessionDuration: 0, eventsCount: 0, siteId })
              .catch(() => ({ pageViews: 0, uniqueVisitors: 0, sessions: 0, avgSessionDuration: 0, eventsCount: 0, siteId }))
          )

          const siteAnalytics = await Promise.all(analyticsPromises)

          // Aggregate data from all sites with proper weighted averaging
          const aggregatedData = siteAnalytics.reduce((acc, site) => {
            const newSessions = acc.sessions + (site.sessions || 0)
            const newPageViews = acc.pageViews + (site.pageViews || 0)
            const newEventsCount = acc.eventsCount + (site.eventsCount || 0)

            // Calculate weighted average for session duration
            const totalWeightedDuration = (acc.avgSessionDuration * acc.sessions) + ((site.avgSessionDuration || 0) * (site.sessions || 0))
            const avgSessionDuration = newSessions > 0 ? totalWeightedDuration / newSessions : 0

            // Calculate weighted average for bounce rate
            const totalWeightedBounceRate = (acc.bounceRate * acc.sessions) + ((site.bounceRate || 0) * (site.sessions || 0))
            const bounceRate = newSessions > 0 ? totalWeightedBounceRate / newSessions : 0

            return {
              pageViews: newPageViews,
              uniqueVisitors: Math.max(acc.uniqueVisitors, site.uniqueVisitors || 0), // Max for unique visitors
              sessions: newSessions,
              avgSessionDuration: Math.round(avgSessionDuration),
              bounceRate: Math.round(bounceRate),
              eventsCount: newEventsCount,
              topPages: [...(acc.topPages || []), ...(site.topPages || []).slice(0, 5)], // Combine top pages
              trafficSources: { ...acc.trafficSources, ...site.trafficSources }, // Merge sources
              percentageChanges: {
                pageViews: null,
                uniqueVisitors: null,
                sessions: null,
                avgSessionDuration: null,
                bounceRate: null
              },
              recentPageViews: [...(acc.recentPageViews || []), ...(site.recentPageViews || [])].slice(0, 50),
              recentEvents: [...(acc.recentEvents || []), ...(site.recentEvents || [])].slice(0, 50),
              visitors: [...(acc.visitors || []), ...(site.visitors || [])].slice(0, 50), // Combine visitors
              websites: siteIds.map(id => ({ siteId: id, analytics: siteAnalytics.find(s => s.siteId === id) })),
              lastUpdated: new Date().toISOString()
            }
          }, {
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
            visitors: [],
            websites: [],
            lastUpdated: new Date().toISOString()
          })

          // Calculate correct weighted average session duration
          if (aggregatedData.sessions > 0) {
            const weightedDurationSum = siteAnalytics.reduce((sum, site) =>
              sum + ((site.avgSessionDuration || 0) * (site.sessions || 0)), 0
            )
            aggregatedData.avgSessionDuration = weightedDurationSum / aggregatedData.sessions
          }

          data = aggregatedData
          console.log(`✅ Website Analytics: Aggregated ${siteIds.length} sites - Total pageViews: ${aggregatedData.pageViews}`)

        } catch (error) {
          console.error(`❌ Website Analytics: Error fetching data for ${locationId}:`, error)
          data = {
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
            lastUpdated: new Date().toISOString(),
            error: 'Failed to fetch website analytics'
          }
        }
        break;

      case 'locations':
        if (!locationId) {
          return NextResponse.json(
            { error: 'locationId required for locations endpoint' },
            { status: 400 }
          )
        }
        try {
          console.log(`📍 Locations: Fetching location data for ${locationId}`)

          const locationData = await client.getLocationData(
            `/locations/${locationId}`,
            locationId!,
            pitToken
          );

          data = {
            location: {
              // Essential display fields
              id: locationData.location.id,
              name: locationData.location.name,
              address: locationData.location.address,
              city: locationData.location.city,
              state: locationData.location.state,
              postalCode: locationData.location.postalCode,
              country: locationData.location.country,

              // Contact details (for details page)
              email: locationData.location.email,
              phone: locationData.location.phone,
              firstName: locationData.location.firstName,
              lastName: locationData.location.lastName,
              website: locationData.location.website,
              logoUrl: locationData.location.logoUrl,

              // Business intelligence
              timezone: locationData.location.timezone,
              googlePlacesId: locationData.location.googlePlacesId,
              dateAdded: locationData.location.dateAdded,

              // Advanced features
              permissions: locationData.location.permissions,
              social: locationData.location.social,
              settings: locationData.location.settings
            },
            success: true,
            message: 'Location data retrieved successfully'
          };

          console.log(`✅ Locations: Retrieved ${locationData.location.name}`)
        } catch (error) {
          console.error(`❌ API: Location fetch failed:`, error)
          data = {
            success: false,
            error: 'Failed to fetch location data',
            location: null
          }
        }
        break;

      case 'get-failed-tokens':
        try {
          console.log('🔍 Getting failed PIT tokens')

          // Get locations with failed tokens from the last 24 hours
          const { data: failures, error } = await supabase
            .from('pit_token_failures')
            .select('location_id, location_name, failure_time, endpoint, error_message')
            .eq('resolved', false)
            .gte('failure_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .order('failure_time', { ascending: false })

          if (error) {
            console.error('Error getting failed tokens:', error)
            data = { failedTokens: [], error: error instanceof Error ? error.message : 'Unknown error' }
          } else {
            // Group by location_id to avoid duplicates
            const uniqueFailures = failures?.reduce((acc: any[], failure) => {
              const existing = acc.find(f => f.location_id === failure.location_id)
              if (!existing) {
                acc.push({
                  location_id: failure.location_id,
                  location_name: failure.location_name,
                  first_failure: failure.failure_time,
                  endpoints: [failure.endpoint],
                  error_message: failure.error_message
                })
              } else if (!existing.endpoints.includes(failure.endpoint)) {
                existing.endpoints.push(failure.endpoint)
              }
              return acc
            }, []) || []

            data = {
              failedTokens: uniqueFailures,
              total: uniqueFailures.length
            }
          }
        } catch (error) {
          console.error('❌ Error getting failed tokens:', error)
          data = { failedTokens: [], error: 'Failed to load failed tokens' }
        }
        break

      case 'update-pit-token':
        try {
          if (!locationId) {
            data = { error: 'locationId required for update-pit-token' }
            break
          }

          const newToken = requestBody?.newToken
          if (!newToken) {
            data = { error: 'newToken required in request body' }
            break
          }

          console.log(`🔄 Updating PIT token for location ${locationId}`)

          // Update the token in ghl_locations table
          const { error: updateError } = await supabase
            .from('ghl_locations')
            .update({
              pit_token: newToken,
              updated_at: new Date().toISOString()
            })
            .eq('id', locationId)

          if (updateError) {
            console.error('❌ Error updating PIT token:', updateError)
            data = { success: false, error: updateError.message }
          } else {
            // Mark failures as resolved
            await supabase
              .from('pit_token_failures')
              .update({
                resolved: true,
                resolved_at: new Date().toISOString()
              })
              .eq('location_id', locationId)
              .eq('resolved', false)

            // Remove from sessionStorage if it exists
            if (typeof window !== 'undefined') {
              const failedLocations = JSON.parse(sessionStorage.getItem('failedPitTokens') || '[]')
              const updated = failedLocations.filter((id: string) => id !== locationId)
              sessionStorage.setItem('failedPitTokens', JSON.stringify(updated))
            }

            console.log(`✅ PIT token updated successfully for ${locationId}`)
            data = { success: true, message: 'PIT token updated successfully' }
          }
        } catch (error) {
          console.error('❌ Error updating PIT token:', error)
          data = { success: false, error: 'Failed to update PIT token' }
        }
        break

      default:
        return NextResponse.json(
          { error: 'Unknown endpoint' },
          { status: 400 }
        )
    }

    // Log successful GHL sync activity
    try {
      const { userId } = await auth()
      if (userId) {
        const { getOrCreateUserWorkspace } = await import('@/lib/workspace-helpers')
        const workspace = await getOrCreateUserWorkspace(userId)
        activityTracker.logActivity(
          userId,
          'ghl_sync',
          'GHL Data Synced',
          `Successfully synced data for ${locationId ? 'location' : 'all locations'}`,
          workspace.id,
          { locationId, dataSummary: { contacts: data.contacts?.length || 0, opportunities: data.opportunities?.length || 0 } }
        )
      }
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn('Failed to log GHL sync activity:', logError)
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error('GHL data API error:', error)

    // Log GHL API error activity
    try {
      const { userId } = await auth()
      if (userId) {
        await activityTracker.logGHLApiError(
          userId,
          endpoint,
          error instanceof Error ? error.message : 'Unknown error',
          locationId || undefined
        )
      }
    } catch (activityError) {
      console.error('Failed to log GHL API error activity:', activityError)
      // Don't interfere with error response
    }

    return NextResponse.json(
      { error: 'Failed to fetch GHL data' },
      { status: 500 }
    )
  }
}