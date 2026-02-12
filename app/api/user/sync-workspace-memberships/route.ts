import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    console.log('🔄 Syncing workspace memberships for:', email, 'with user_id:', userId)

    // Find all accepted invitations for this email
    const { data: acceptedInvitations, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('workspace_id, role')
      .eq('email', email.toLowerCase())
      .eq('status', 'accepted')

    if (inviteError) {
      console.error('Error fetching invitations:', inviteError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!acceptedInvitations || acceptedInvitations.length === 0) {
      console.log('ℹ️ No accepted invitations found for:', email)
      return NextResponse.json({ message: 'No accepted invitations found' })
    }

    console.log('📋 Found', acceptedInvitations.length, 'accepted invitations')

    // Sync workspace memberships for each accepted invitation
    const syncResults = []
    for (const invitation of acceptedInvitations) {
      console.log('🔍 Checking membership for workspace:', invitation.workspace_id)

      // Check if membership already exists with correct user_id
      const { data: existingMember } = await supabaseAdmin
        .from('workspace_members')
        .select('id, role')
        .eq('workspace_id', invitation.workspace_id)
        .eq('user_id', userId)
        .single()

      if (!existingMember) {
        console.log('➕ Creating new membership for workspace:', invitation.workspace_id)

        // Create new membership with correct user_id
        const { data: newMember, error: memberError } = await supabaseAdmin
          .from('workspace_members')
          .insert({
            workspace_id: invitation.workspace_id,
            user_id: userId,
            role: invitation.role,
            joined_at: new Date().toISOString()
          })
          .select()
          .single()

        if (memberError) {
          console.error('❌ Error creating membership:', memberError)
          syncResults.push({
            workspace_id: invitation.workspace_id,
            status: 'error',
            error: memberError.message
          })
        } else {
          console.log('✅ Created membership:', newMember)
          syncResults.push({
            workspace_id: invitation.workspace_id,
            status: 'created',
            member: newMember
          })
        }
      } else {
        console.log('✅ Membership already exists for workspace:', invitation.workspace_id)
        syncResults.push({
          workspace_id: invitation.workspace_id,
          status: 'already_exists',
          existing_role: existingMember.role
        })
      }
    }

    const createdCount = syncResults.filter(r => r.status === 'created').length
    console.log('🎉 Sync complete. Created', createdCount, 'new memberships')

    return NextResponse.json({
      message: 'Workspace memberships synced',
      results: syncResults,
      synced_count: createdCount,
      total_invitations: acceptedInvitations.length
    })

  } catch (error) {
    console.error('❌ Sync workspace memberships error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}