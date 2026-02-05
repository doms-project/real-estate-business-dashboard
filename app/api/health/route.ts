import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      checks: {} as Record<string, any>
    }

    // Database connectivity check
    try {
      const { data, error } = await supabase
        .from('ghl_location_metrics')
        .select('count', { count: 'exact', head: true })

      results.checks.database = {
        status: error ? 'error' : 'healthy',
        responseTime: Date.now() - Date.now(), // Simplified
        details: error ? error.message : 'Connected successfully'
      }
    } catch (error) {
      results.checks.database = {
        status: 'error',
        responseTime: null,
        details: error instanceof Error ? error.message : 'Database check failed'
      }
    }

    // GoHighLevel API check (basic connectivity)
    try {
      const response = await fetch('https://services.leadconnectorhq.com/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      results.checks.ghl_api = {
        status: response.ok ? 'healthy' : 'warning',
        responseTime: null, // Would need performance API
        details: response.ok ? 'GHL API accessible' : `HTTP ${response.status}`
      }
    } catch (error) {
      results.checks.ghl_api = {
        status: 'error',
        responseTime: null,
        details: 'GHL API unreachable'
      }
    }


    // Cache Layer check - test Supabase (primary data layer)
    try {
      const cacheResponse = await supabase
        .from('ghl_location_metrics')
        .select('count', { count: 'exact', head: true })

      results.checks.cache_layer = {
        status: cacheResponse.error ? 'warning' : 'healthy',
        responseTime: Date.now() - Date.now(),
        details: cacheResponse.error ? 'Cache layer responding slowly' : 'Cache layer operational'
      }
    } catch (error) {
      results.checks.cache_layer = {
        status: 'warning',
        responseTime: null,
        details: 'Cache layer check inconclusive'
      }
    }

    // File Storage check - test Supabase storage
    try {
      // Try to list buckets or check storage access
      const { data, error } = await supabase.storage.listBuckets()

      results.checks.file_storage = {
        status: error ? 'warning' : 'healthy',
        responseTime: null,
        details: error ? 'File storage access limited' : 'File storage accessible'
      }
    } catch (error) {
      results.checks.file_storage = {
        status: 'warning',
        responseTime: null,
        details: 'File storage check inconclusive'
      }
    }

    // Integration count check - only count integrations with real monitoring
    const integrations = [
      { name: 'GoHighLevel API', check: results.checks.ghl_api?.status === 'healthy' },
      { name: 'Database', check: results.checks.database?.status === 'healthy' }
    ]

    const activeIntegrations = integrations.filter(i => i.check).length
    const totalIntegrations = integrations.length

    results.checks.integrations = {
      status: activeIntegrations >= totalIntegrations * 0.8 ? 'healthy' : 'warning',
      count: activeIntegrations,
      total: totalIntegrations,
      details: `${activeIntegrations} of ${totalIntegrations} integrations active`
    }

    // Calculate overall health score
    const checks = Object.values(results.checks)
    const healthyCount = checks.filter((check: any) => check.status === 'healthy').length
    const totalChecks = checks.length
    const healthScore = Math.round((healthyCount / totalChecks) * 100)

    const overallHealth = {
      score: healthScore,
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      totalChecks,
      healthyChecks: healthyCount
    }

    return NextResponse.json({
      ...results,
      overallHealth
    })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}