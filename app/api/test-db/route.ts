import { NextResponse } from 'next/server'
import { supabaseAdminFallback } from '@/lib/supabase'

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabaseAdminFallback
      .from('agency_health_scores')
      .select('count', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        env: {
          url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: data,
      env: {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      env: {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }, { status: 500 })
  }
}