import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrCreateUserWorkspace, getUserWorkspaces, getUserWorkspaceRole } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/properties - Fetch workspace properties
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get workspace ID from query parameters
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to the workspace
    const userRole = await getUserWorkspaceRole(userId, workspaceId)
    if (!userRole) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Build query - filter by workspace_id for workspace-based access
    // All workspace members can see all properties in the workspace
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('workspace_id', workspaceId) // Filter by workspace instead of user
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ properties: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/properties:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/properties - Save properties (replace all)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { properties, workspaceId } = body

    if (!Array.isArray(properties)) {
      console.error('Invalid request: properties is not an array', { properties })
      return NextResponse.json(
        { error: 'Invalid request: properties must be an array' },
        { status: 400 }
      )
    }

    if (properties.length === 0) {
      console.warn('Empty properties array received')
      return NextResponse.json(
        { error: 'No properties to save' },
        { status: 400 }
      )
    }

    // Get or create workspace and verify access
    let targetWorkspaceId: string | null = workspaceId || null
    try {
      if (workspaceId) {
        // If workspaceId is provided, verify user has access to it
        const userRole = await getUserWorkspaceRole(userId, workspaceId)
        if (!userRole) {
          return NextResponse.json(
            { error: 'Access denied to workspace' },
            { status: 403 }
          )
        }
        targetWorkspaceId = workspaceId
      } else {
        // If no workspaceId provided, check user's workspaces
        const userWorkspaces = await getUserWorkspaces(userId)
        if (userWorkspaces.length === 0) {
          return NextResponse.json(
            { error: 'No workspace access. You must be invited to a workspace first.' },
            { status: 403 }
          )
        }
        targetWorkspaceId = userWorkspaces[0].id
      }
    } catch (workspaceError: any) {
      // If workspace system fails, allow with null workspace_id (legacy support)
      console.warn('Could not verify workspace access, using user_id only:', workspaceError.message)
      targetWorkspaceId = null
    }

    // Use upsert to update/insert properties without deleting others
    // This prevents data loss - properties not in the list won't be deleted
    // Only properties explicitly sent will be updated or inserted
    console.log(`Received ${properties.length} properties to save`)
    
    const propertiesToInsert = properties
      .map((prop: any, index: number) => {
        // Trim and check required fields - treat empty strings as missing
        const address = prop.address ? String(prop.address).trim() : ''
        const type = prop.type ? String(prop.type).trim() : ''
        const status = prop.status ? String(prop.status).trim() : ''
        
        // Validate required fields - skip invalid ones instead of throwing
        if (!address || !type || !status) {
          console.warn(`Skipping property at index ${index} - missing required fields: address="${address}", type="${type}", status="${status}"`)
          return null
        }

        // Validate status is one of the allowed values
        const validStatuses = ['rented', 'vacant', 'under_maintenance', 'sold']
        if (!validStatuses.includes(status)) {
          console.warn(`Skipping property at index ${index} - invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}`)
          return null
        }

      // Build the property object, excluding fields that don't belong in the properties table
      const propertyToInsert: any = {
        user_id: userId,
        workspace_id: targetWorkspaceId || null, // Allow null if workspace system isn't set up
        address: address,
        type: type,
        status: status,
        mortgage_holder: prop.mortgageHolder ? String(prop.mortgageHolder).trim() : null,
        total_mortgage_amount: Number(prop.totalMortgageAmount) || 0,
        purchase_price: Number(prop.purchasePrice) || 0,
        current_est_value: Number(prop.currentEstValue) || 0,
        monthly_mortgage_payment: Number(prop.monthlyMortgagePayment) || 0,
        monthly_insurance: Number(prop.monthlyInsurance) || 0,
        monthly_property_tax: Number(prop.monthlyPropertyTax) || 0,
        monthly_other_costs: Number(prop.monthlyOtherCosts) || 0,
        monthly_gross_rent: Number(prop.monthlyGrossRent) || 0,
        ownership: prop.ownership ? String(prop.ownership).trim() : null,
        linked_websites: Array.isArray(prop.linkedWebsites) && prop.linkedWebsites.length > 0 ? prop.linkedWebsites : null,
      }
      
      // Extract custom fields (fields starting with custom_)
      const customFieldsData: Record<string, any> = {}
      Object.keys(prop).forEach(key => {
        if (key.startsWith('custom_')) {
          customFieldsData[key] = prop[key]
        }
      })
      if (Object.keys(customFieldsData).length > 0) {
        propertyToInsert.custom_fields = customFieldsData
      }
      
      // Preserve ID if it exists and is a valid UUID (from database)
      // This allows upsert to update existing properties
      // Don't include ID if it's not a UUID (e.g., temporary IDs like "1", "2", etc.)
      if (prop.id && typeof prop.id === 'string') {
        const isUUID = prop.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        if (isUUID) {
          propertyToInsert.id = prop.id
        } else {
          // Temporary ID (like "1", "2", etc.) - don't include it, let database generate new UUID
          console.log(`Property has temporary ID "${prop.id}", will get new UUID from database`)
        }
      }

      // Note: We intentionally exclude:
      // - id (database generates it)
      // - rentRoll (stored in rent_roll_units table)
      // - workRequests (stored in work_requests table)

        return propertyToInsert
      })
      .filter((p: any) => p !== null) // Remove null entries (invalid properties)

    console.log(`After validation: ${propertiesToInsert.length} valid properties out of ${properties.length} total`)
    
    if (propertiesToInsert.length === 0) {
      console.error('All properties were filtered out during validation')
      return NextResponse.json(
        { error: 'No valid properties to save. All properties were missing required fields (address, type, status) or had invalid status values.' },
        { status: 400 }
      )
    }

    // Use upsert to update existing properties or insert new ones
    // Only include id in conflict resolution if we have IDs
    const hasIds = propertiesToInsert.some((p: any) => p.id)
    const upsertOptions: any = {
      ignoreDuplicates: false,
    }
    
    if (hasIds) {
      upsertOptions.onConflict = 'id' // If id exists, update; otherwise insert
    }
    
    const { data, error: insertError } = await supabaseAdmin
      .from('properties')
      .upsert(propertiesToInsert, upsertOptions)
      .select()

    if (insertError) {
      console.error('Error upserting properties:', insertError)
      console.error('Properties attempted:', JSON.stringify(propertiesToInsert.slice(0, 2), null, 2)) // Log first 2 only
      return NextResponse.json(
        { error: 'Failed to save properties', details: insertError.message },
        { status: 500 }
      )
    }

    console.log(`Successfully saved ${data?.length || 0} properties`)

    return NextResponse.json({ 
      success: true, 
      properties: data || [],
      message: `Saved ${data?.length || 0} properties` 
    })
  } catch (error: any) {
    console.error('Error in POST /api/properties:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

