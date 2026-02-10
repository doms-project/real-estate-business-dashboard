// Debug script to check activities setup
// Run with: node debug-activities.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugActivities() {
  console.log('🔍 Debugging Activities Setup...\n')

  try {
    // 1. Check if activities table exists
    console.log('1️⃣ Checking activities table...')
    const { data: countData, error: countError } = await supabase
      .from('activities')
      .select('count', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Activities table does not exist:', countError.message)
      return
    }

    console.log(`✅ Activities table exists with ${countData || 0} activities`)

    // 2. Check recent activities
    console.log('\n2️⃣ Checking recent activities...')
    const { data: recentActivities, error: recentError } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      console.error('❌ Error fetching recent activities:', recentError.message)
      return
    }

    console.log(`✅ Found ${recentActivities?.length || 0} recent activities:`)
    recentActivities?.forEach((activity, index) => {
      console.log(`   ${index + 1}. ${activity.title} (${new Date(activity.created_at).toLocaleString()})`)
    })

    // 3. Check realtime publication
    console.log('\n3️⃣ Checking realtime publication...')
    const { data: pubData, error: pubError } = await supabase
      .from('pg_publication_tables')
      .select('*')
      .eq('pubname', 'supabase_realtime')
      .eq('tablename', 'activities')

    if (pubError) {
      console.log('⚠️ Could not check publication (might be normal):', pubError.message)
    } else if (pubData && pubData.length > 0) {
      console.log('✅ Activities table is in realtime publication')
    } else {
      console.log('⚠️ Activities table is NOT in realtime publication')
    }

    // 4. Test workspace-specific activities
    console.log('\n4️⃣ Testing workspace-specific activities...')
    const workspaceId = '4ccf4b05-36c5-48a4-8858-5222dec50021' // The workspace ID from the test

    const { data: workspaceActivities, error: workspaceError } = await supabase
      .from('activities')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (workspaceError) {
      console.error('❌ Error fetching workspace activities:', workspaceError.message)
    } else {
      console.log(`✅ Found ${workspaceActivities?.length || 0} activities for workspace ${workspaceId}`)
      workspaceActivities?.forEach((activity, index) => {
        console.log(`   ${index + 1}. ${activity.title} (user: ${activity.user_id})`)
      })
    }

    // 5. Check all activities with their workspace info
    console.log('\n5️⃣ All activities with workspace info...')
    const { data: allActivities, error: allError } = await supabase
      .from('activities')
      .select('id, title, user_id, workspace_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!allError && allActivities) {
      console.log('📋 All recent activities:')
      allActivities.forEach((activity, index) => {
        console.log(`   ${index + 1}. "${activity.title}" | User: ${activity.user_id} | Workspace: ${activity.workspace_id || 'null'}`)
      })
    }

    console.log('\n🎯 Summary:')
    console.log(`   📊 Total activities: ${countData || 0}`)
    console.log(`   🔄 Realtime enabled: ${pubData && pubData.length > 0 ? 'Yes' : 'Unknown'}`)
    console.log(`   👤 User activities: ${userActivities?.length || 0} (for sample user)`)

    if ((countData || 0) > 0) {
      console.log('\n✅ Activities table is working! The UI issue might be elsewhere.')
      console.log('🔍 Check browser console for dashboard debugging messages.')
    } else {
      console.log('\n⚠️ No activities found. Try creating some activities first.')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

debugActivities()