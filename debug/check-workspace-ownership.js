// Check workspace ownership
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkWorkspaceOwnership() {
  console.log('🔍 Checking workspace ownership...\n')

  const workspaceId = '467e72e9-0643-4296-ad5b-f3dd5544d26e'
  const userId = 'user_38CZmoswsMI45GDQjhDfbiacB8f'

  try {
    // Check if workspace exists
    console.log('1️⃣ Checking if workspace exists...')
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (wsError) {
      console.error('❌ Workspace not found:', wsError.message)
      return
    }

    console.log('✅ Workspace found:', {
      id: workspace.id,
      name: workspace.name,
      owner_id: workspace.owner_id,
      created_at: workspace.created_at
    })

    // Check ownership
    console.log('\n2️⃣ Checking ownership...')
    const isOwner = workspace.owner_id === userId
    console.log(`👤 User ${userId} ${isOwner ? 'OWNS' : 'does NOT own'} workspace`)
    console.log(`👑 Actual owner: ${workspace.owner_id}`)

    if (!isOwner) {
      console.log('\n❌ OWNERSHIP MISMATCH! This is why the API call fails.')
      console.log('The API checks that owner_id matches the requesting user.')
      console.log(`Expected: ${userId}`)
      console.log(`Actual: ${workspace.owner_id}`)
    } else {
      console.log('\n✅ Ownership is correct. The issue might be elsewhere.')
    }

    // Check workspace members
    console.log('\n3️⃣ Checking workspace members...')
    const { data: members, error: memberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (memberError) {
      console.error('❌ Error fetching members:', memberError.message)
    } else {
      console.log(`👥 Workspace has ${members?.length || 0} members:`)
      members?.forEach(member => {
        console.log(`   - ${member.user_id} (${member.role})`)
      })
    }

    // Test the exact query the API uses
    console.log('\n4️⃣ Testing API ownership check query...')
    const { data: apiCheck, error: apiError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', userId)
      .single()

    console.log('API Query Result:', { data: apiCheck, error: apiError })

    if (apiError || !apiCheck) {
      console.log('❌ This confirms why the API returns 404 - ownership check fails')
    } else {
      console.log('✅ Ownership check would pass')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkWorkspaceOwnership()