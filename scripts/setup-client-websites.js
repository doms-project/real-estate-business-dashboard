#!/usr/bin/env node

/**
 * Setup script for client-website mappings
 * This helps you map your GHL clients to their website analytics
 */

const fs = require('fs')
const path = require('path')

console.log('🏗️  Client-Website Mapping Setup')
console.log('================================\n')

console.log('📋 To enable real Weekly Views, you need to:')
console.log('1. Run the database migration')
console.log('2. Map your GHL clients to their website siteIds\n')

console.log('📄 Migration SQL file created: supabase/client-websites-migration.sql')
console.log('🔗 API endpoint created: /api/client-websites\n')

console.log('📊 How Weekly Views now works:')
console.log('• Fetches all websites mapped to each GHL client')
console.log('• Gets page views from each website for the last 7 days')
console.log('• Sums views across all websites for each client')
console.log('• Aggregates totals across all clients\n')

console.log('🎯 Example mapping:')
console.log('GHL Location ID: be4yGETqzGQ4sknbwXb3')
console.log('Mapped websites:')
console.log('  • funnel-vRwWeI3XuXffOFsLo7YT (Main site)')
console.log('  • test-site-123 (Landing page)')
console.log('Total views: Sum of both websites\n')

console.log('🚀 Next steps:')
console.log('1. Run the migration in Supabase SQL Editor')
console.log('2. Add your client-website mappings via the API')
console.log('3. Weekly Views will show real aggregated numbers!\n')

console.log('📚 API Usage:')
console.log('GET  /api/client-websites?ghlLocationId=xxx (get mappings)')
console.log('POST /api/client-websites (add mapping)')
console.log('DELETE /api/client-websites?ghlLocationId=xxx&siteId=yyy (remove mapping)\n')

console.log('✨ Ready for real Weekly Views data! 🎉')