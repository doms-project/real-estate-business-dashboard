import { NextRequest, NextResponse } from 'next/server'

// Test GHL credentials and fetch location details
export async function POST(request: NextRequest) {
  try {
    const { locationId, pitToken } = await request.json()

    if (!locationId || !pitToken) {
      return NextResponse.json({
        success: false,
        error: 'Location ID and PIT Token are required'
      }, { status: 400 })
    }

    // Test credentials by making a simple API call to GHL
    // We'll try to get basic location information
    const testUrl = `https://services.leadconnectorhq.com/locations/${locationId}`

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-04-15'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Invalid credentials or location not found (${response.status})`
      }, { status: 400 })
    }

    const locationData = await response.json()

    // Extract relevant information
    const processedData = {
      name: locationData.name || locationData.businessName || '',
      city: locationData.city || '',
      state: locationData.state || '',
      country: locationData.country || 'US',
      address: locationData.address || locationData.fullAddress || '',
      phone: locationData.phone || '',
      email: locationData.email || ''
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials validated successfully',
      locationData: processedData
    })

  } catch (error) {
    console.error('Test credentials error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to validate credentials. Please check your connection and try again.'
    }, { status: 500 })
  }
}
