/**
 * Add Workspace Context Migration
 *
 * This migration adds workspace-specific visibility to workspace creation requests.
 * Run this after deploying the updated code.
 */

const fs = require('fs')
const path = require('path')

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'add-workspace-context-migration.sql')
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

console.log('=== ADD WORKSPACE CONTEXT MIGRATION ===')
console.log('')
console.log('This migration adds workspace-specific visibility to workspace creation requests:')
console.log('- workspace_context field tracks which workspace the request came from')
console.log('- Requests are only visible to admins/owners of that specific workspace')
console.log('- Members can only request workspaces from workspaces they belong to')
console.log('')
console.log('INSTRUCTIONS:')
console.log('1. Go to your Supabase Dashboard')
console.log('2. Open the SQL Editor')
console.log('3. Copy and paste the following SQL:')
console.log('')
console.log('=' + '='.repeat(50))
console.log(sqlContent)
console.log('=' + '='.repeat(50))
console.log('')
console.log('4. Click "Run" to execute the migration')
console.log('')
console.log('WHAT THIS CHANGES:')
console.log('- Workspace creation requests now have workspace context')
console.log('- Admins only see requests from workspaces they manage')
console.log('- Members can request workspaces from any workspace they belong to')
console.log('')