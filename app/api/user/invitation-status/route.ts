import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/invitation-status - Check if user has accepted invitations
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

    // Check if user has any accepted invitations
    const { data: acceptedInvitations, error } = await supabaseAdmin
      .from('invitations')
      .select('id, workspace_id, role')
      .eq('email', email.toLowerCase())
      .eq('status', 'accepted')
      .limit(1) // Just need to know if they have at least one

    if (error) {
      console.error('Error checking invitation status:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    const hasAcceptedInvitation = acceptedInvitations && acceptedInvitations.length > 0

    return NextResponse.json({
      hasAcceptedInvitation,
      invitationCount: acceptedInvitations?.length || 0,
      invitation: hasAcceptedInvitation ? acceptedInvitations[0] : null
    })
  } catch (error: any) {
    console.error('Error in GET /api/user/invitation-status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}