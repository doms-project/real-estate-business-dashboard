/**
 * Test script to check member removal functionality
 * Run with: node test-member-removal.js
 */

const { createClient } = require('@supabase/supabase-js')

// You'll need to set these environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testMemberRemoval() {
  try {
    console.log('Testing member removal functionality...\n')

    // Get all workspaces
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')

    if (workspaceError) {
      console.error('Error fetching workspaces:', workspaceError)
      return
    }

    console.log('Workspaces found:')
    workspaces.forEach(w => console.log(`- ${w.id}: ${w.name} (owner: ${w.owner_id})`))
    console.log()

    // For each workspace, get members
    for (const workspace of workspaces) {
      console.log(`Members in workspace "${workspace.name}" (${workspace.id}):`)

      const { data: members, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspace.id)

      if (memberError) {
        console.error('Error fetching members:', memberError)
        continue
      }

      if (members.length === 0) {
        console.log('  No members found')
      } else {
        members.forEach(m => console.log(`  - ${m.user_id} (${m.role}) joined ${m.joined_at}`))
      }
      console.log()
    }

    console.log('Test completed. Check the console output above.')
    console.log('\nTo test deletion manually, you can run:')
    console.log(`DELETE FROM workspace_members WHERE workspace_id = 'YOUR_WORKSPACE_ID' AND user_id = 'MEMBER_USER_ID';`)

  } catch (error) {
    console.error('Test failed:', error)
  }
}

testMemberRemoval()