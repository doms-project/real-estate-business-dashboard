import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Analytics script: Request received', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    });

    // Serve the analytics script
    const scriptPath = join(process.cwd(), 'public', 'analytics.js')
    const scriptContent = readFileSync(scriptPath, 'utf-8')

    return new NextResponse(scriptContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error serving analytics script:', error)
    return NextResponse.json(
      { error: 'Failed to serve analytics script' },
      { status: 500 }
    )
  }
}