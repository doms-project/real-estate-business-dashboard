import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.GHL_CLIENT_ID
  const redirectUri = process.env.GHL_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'OAuth configuration missing' },
      { status: 500 }
    )
  }

  // GHL OAuth authorization URL for agency installation
  const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'contacts.readonly opportunities.readonly conversations.readonly calendars.readonly campaigns.readonly forms.readonly funnels/page.readonly funnels/funnel.readonly funnels/pagecount.readonly funnels/redirect.readonly workflows.readonly invoices.readonly surveys.readonly users.readonly')
  authUrl.searchParams.set('state', 'agency_install')

  // Redirect to GHL OAuth page
  return NextResponse.redirect(authUrl.toString())
}