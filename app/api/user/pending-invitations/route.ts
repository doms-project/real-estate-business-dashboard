import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/pending-invitations - Get pending invitations for a user email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get pending invitations for this email
    const { data: pendingInvitations, error } = await supabaseAdmin
      .from('invitations')
      .select(`
        id,
        workspace_id,
        email,
        role,
        invited_by,
        created_at,
        expires_at,
        workspaces!inner (
          id,
          name
        )
      `)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending invitations:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    // Transform the data to match InvitationCard interface
    const formattedInvitations = pendingInvitations?.map(inv => ({
      id: inv.id,
      workspace_id: inv.workspace_id,
      email: inv.email,
      role: inv.role,
      invited_by: inv.invited_by,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      workspaces: inv.workspaces
    })) || []

    console.log(`📋 Found ${formattedInvitations.length} pending invitations for ${email}`)

    return NextResponse.json({
      invitations: formattedInvitations
    })

  } catch (error: any) {
    console.error('Error in GET /api/user/pending-invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}