import { NextResponse } from 'next/server'
import { supabaseAdminFallback } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if activities table exists
    const { data, error } = await supabaseAdminFallback
      .from('activities')
      .select('count', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({
        exists: false,
        error: error.message,
        message: 'Activities table does not exist. Run the schema migration.'
      }, { status: 500 })
    }

    return NextResponse.json({
      exists: true,
      count: data,
      message: 'Activities table exists and is accessible.'
    })

  } catch (error) {
    return NextResponse.json({
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}