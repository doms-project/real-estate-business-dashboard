#!/usr/bin/env node

// Script to fix workspace mismatch for activities
// Run with: node scripts/fix-workspace-activities.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixWorkspaceActivities() {
  console.log('🔧 Fixing workspace mismatch for activities...\n')

  try {
    // Get all activities and their current workspace
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })

    if (activitiesError) {
      console.error('❌ Error fetching activities:', activitiesError.message)
      return
    }

    console.log(`📊 Found ${activities?.length || 0} activities`)

    if (!activities || activities.length === 0) {
      console.log('⚠️ No activities to fix')
      return
    }

    // Group activities by workspace
    const workspaceGroups = {}
    activities.forEach(activity => {
      const wsId = activity.workspace_id || 'null'
      if (!workspaceGroups[wsId]) {
        workspaceGroups[wsId] = []
      }
      workspaceGroups[wsId].push(activity)
    })

    console.log('🏢 Activities grouped by workspace:')
    Object.keys(workspaceGroups).forEach(wsId => {
      console.log(`   Workspace ${wsId}: ${workspaceGroups[wsId].length} activities`)
    })

    // Find the workspace with the most activities (likely the correct one)
    let mainWorkspaceId = null
    let maxCount = 0
    Object.keys(workspaceGroups).forEach(wsId => {
      if (workspaceGroups[wsId].length > maxCount) {
        maxCount = workspaceGroups[wsId].length
        mainWorkspaceId = wsId
      }
    })

    console.log(`\n🎯 Main workspace (most activities): ${mainWorkspaceId} (${maxCount} activities)`)

    // Option 1: Update dashboard to use main workspace
    console.log('\n📝 Option 1: Update dashboard to use correct workspace')
    console.log(`   Add this to your workspace context or dashboard:`)
    console.log(`   setCurrentWorkspace({ id: '${mainWorkspaceId}' })`)

    // Option 2: Move all activities to a specific workspace
    const targetWorkspaceId = '4ccf4b05-36c5-48a4-8858-5222dec50021' // Current workspace from error
    console.log(`\n📦 Option 2: Move all activities to current workspace (${targetWorkspaceId})`)

    const activitiesToMove = activities.filter(a => a.workspace_id !== targetWorkspaceId)
    console.log(`   Would move ${activitiesToMove.length} activities`)

    if (activitiesToMove.length > 0) {
      console.log('   Run this SQL to move activities:')
      console.log(`   UPDATE activities SET workspace_id = '${targetWorkspaceId}' WHERE workspace_id != '${targetWorkspaceId}';`)
    }

    console.log('\n💡 Recommended: Use Option 1 (update dashboard) to preserve existing data')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
fixWorkspaceActivities()