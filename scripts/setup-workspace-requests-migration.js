/**
 * Setup Workspace Creation Requests Migration
 *
 * This script sets up the database schema for workspace creation request functionality.
 * Run this after deploying the new code.
 */

const fs = require('fs')
const path = require('path')

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'setup-workspace-requests.sql')
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

console.log('=== WORKSPACE CREATION REQUESTS MIGRATION ===')
console.log('')
console.log('This migration adds workspace creation request functionality with:')
console.log('- workspace_creation_requests table')
console.log('- Permission-based workspace creation')
console.log('- Request approval workflow for admins/owners')
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
console.log('5. The workspace creation permission system will be active')
console.log('')
console.log('WHAT THIS DOES:')
console.log('- Owners and Admins: Can create workspaces directly')
console.log('- Members: Must request approval before creating workspaces')
console.log('- Admins/Owners: Can approve/reject workspace creation requests')
console.log('')