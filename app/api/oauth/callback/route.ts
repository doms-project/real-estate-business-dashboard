import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  console.log('🚀 OAuth callback started - code present:', !!code, 'error:', error)

  const clientId = process.env.GHL_CLIENT_ID
  const clientSecret = process.env.GHL_CLIENT_SECRET
  const redirectUri = process.env.GHL_REDIRECT_URI

  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url))
  }

  if (!code || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing OAuth parameters' },
      { status: 400 }
    )
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/dashboard?error=token_exchange_failed', request.url))
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, userType, companyId } = tokenData

    console.log('🎫 Token received - userType:', userType, 'companyId:', companyId)
    console.log('🔑 Token data scopes:', tokenData.scope)
    console.log('🔑 Full token data keys:', Object.keys(tokenData))

    // For agency installations, get all sub-account locations
    if (userType === 'Company' && companyId) {
      console.log('🏢 Agency installation detected - getting sub-account tokens')
      await handleAgencyInstallation(access_token, companyId)
    } else {
      console.log('👤 Individual installation - no sub-accounts to process')
    }

    // Store the main token (agency or individual) - use upsert to avoid duplicates
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available')
      return NextResponse.redirect(new URL('/dashboard?error=db_connection_failed', request.url))
    }

    const { error: dbError } = await supabaseAdmin
      .from('ghl_oauth_tokens')
      .upsert({
        company_id: companyId || 'individual',
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: new Date(Date.now() + (expires_in * 1000)),
        user_type: userType,
        scopes: tokenData.scope?.split(' ') || [],
      }, {
        onConflict: 'company_id'
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(new URL('/dashboard?error=database_error', request.url))
    }

    // Redirect to dashboard with success
    return NextResponse.redirect(new URL('/dashboard?success=oauth_complete', request.url))

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=oauth_error', request.url))
  }
}

async function handleAgencyInstallation(accessToken: string, companyId: string) {
  try {
    console.log('🔍 Getting installed locations for company:', companyId)

    // Use the working installedLocations API
    const clientId = process.env.GHL_CLIENT_ID
    if (!clientId) {
      console.error('❌ GHL_CLIENT_ID not found in environment')
      return
    }

    const response = await fetch(`https://services.leadconnectorhq.com/oauth/installedLocations?companyId=${companyId}&appId=${clientId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
    })

    console.log('📡 Installed locations API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to get installed locations:', response.status, errorText)

      // Fallback: Read from database instead
      console.log('🔄 API failed - falling back to database lookup')
      await createTokensFromDatabase(companyId, accessToken)
      return
    }

    const locations = await response.json()
    console.log('📍 Found installed locations:', Array.isArray(locations) ? locations.length : 'unknown format')

    if (!Array.isArray(locations) || locations.length === 0) {
      console.log('⚠️ No installed locations found or invalid response format')
      return
    }

    // For each installed location, create and store a location-specific token
    let successCount = 0
    for (const location of locations) {
      try {
        const locationId = location._id || location.id
        if (!locationId) {
          console.log('⚠️ Skipping location without ID:', location)
          continue
        }

        console.log('🔄 Creating token for location:', locationId, location.name || 'Unknown')
        const tokenData = await getLocationToken(accessToken, locationId, companyId)

        if (tokenData && supabaseAdmin) {
          // Store the location token in database
          const { error: tokenError } = await supabaseAdmin
            .from('ghl_location_tokens')
            .upsert({
              location_id: locationId,
              company_id: companyId,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)),
              scopes: tokenData.scope?.split(' ') || [],
            }, {
              onConflict: 'location_id'
            })

          if (tokenError) {
            console.error('❌ Database error storing location token:', tokenError)
          } else {
            console.log('✅ Location token stored successfully for:', locationId)
            successCount++
          }
        }
      } catch (error) {
        console.error(`💥 Error creating token for location ${location._id || location.id}:`, error)
      }
    }

    console.log(`🎉 Successfully created and stored tokens for ${successCount}/${locations.length} locations`)

  } catch (error) {
    console.error('💥 Error handling agency installation:', error)
  }
}

async function createTokensFromDatabase(companyId: string, accessToken: string) {
  try {
    console.log('📊 Reading locations from database for company:', companyId)

    // Read all active installations for this company
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available')
      throw new Error('Database connection failed')
    }

    const { data: installations, error } = await supabaseAdmin
      .from('ghl_app_installations')
      .select('location_id, location_name')
      .eq('company_id', companyId)
      .eq('status', 'active')

    if (error) {
      console.error('❌ Database error reading installations:', error)
      return
    }

    if (!installations || installations.length === 0) {
      console.log('⚠️ No active installations found in database')
      return
    }

    console.log(`📍 Found ${installations.length} active installations in database`)

    // Create tokens for each installation
    let successCount = 0
    for (const installation of installations) {
      try {
        console.log('🔄 Creating token for location:', installation.location_id, installation.location_name)
        const tokenData = await getLocationToken(accessToken, installation.location_id, companyId)

        if (tokenData && supabaseAdmin) {
          // Store the location token in database
          const { error: tokenError } = await supabaseAdmin
            .from('ghl_location_tokens')
            .upsert({
              location_id: installation.location_id,
              company_id: companyId,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)),
              scopes: tokenData.scope?.split(' ') || [],
            }, {
              onConflict: 'location_id'
            })

          if (tokenError) {
            console.error('❌ Database error storing location token:', tokenError)
          } else {
            console.log('✅ Location token stored successfully for:', installation.location_id)
            successCount++
          }
        }
      } catch (error) {
        console.error(`💥 Error creating token for location ${installation.location_id}:`, error)
      }
    }

    console.log(`🎉 Successfully created and stored tokens for ${successCount}/${installations.length} database locations`)

  } catch (error) {
    console.error('💥 Error creating tokens from database:', error)
  }
}

async function getLocationToken(agencyToken: string, locationId: string, companyId: string) {
  try {
    console.log('🔑 Requesting token for location:', locationId)

    const locationTokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agencyToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify({
        companyId: companyId,
        locationId: locationId,
      }),
    })

    console.log('🔑 Location token API response:', locationTokenResponse.status)

    if (locationTokenResponse.ok) {
      const locationTokenData = await locationTokenResponse.json()
      console.log('✅ Got token for location:', locationId)
      return locationTokenData // Return the token data so it can be stored
    } else {
      const errorText = await locationTokenResponse.text()
      console.error('❌ Failed to get location token:', locationTokenResponse.status, errorText)
      return null
    }
  } catch (error) {
    console.error(`💥 Error getting token for location ${locationId}:`, error)
    return null
  }
}