import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, firstName, lastName, imageUrl } = body

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Sync user profile to database using the RPC function
    const { error } = await supabaseAdmin.rpc('sync_user_profile', {
      p_user_id: userId,
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
      p_image_url: imageUrl
    })

    if (error) {
      console.error('Failed to sync user profile:', error)
      return NextResponse.json({ error: 'Failed to sync profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}