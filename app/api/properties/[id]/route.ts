import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"
import { activityTracker } from "@/lib/activity-tracker"
import { getUserWorkspaceRole } from "@/lib/workspace-helpers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      notes, photos, rentRoll, maintenanceRequests, linkedWebsites,
      // Financial fields that users edit in the table
      total_mortgage_amount,
      purchase_price,
      current_est_value,
      monthly_mortgage_payment,
      monthly_insurance,
      monthly_property_tax,
      monthly_other_costs,
      monthly_gross_rent,
      mortgage_holder,
      ownership,
      // Basic property fields
      address,
      type,
      status
    } = body

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // First, get the property to verify workspace access
    const { data: property, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("workspace_id, address")
      .eq("id", params.id)
      .single()

    if (fetchError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Verify user has access to the workspace
    if (property.workspace_id) {
      const userRole = await getUserWorkspaceRole(userId, property.workspace_id)
      if (!userRole) {
        return NextResponse.json(
          { error: "Access denied to workspace" },
          { status: 403 }
        )
      }
    }

    // Prepare update object with only defined fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Modal-related fields
    if (notes !== undefined) updateData.notes = notes
    if (photos !== undefined) updateData.photos = photos
    if (rentRoll !== undefined) updateData.rent_roll = rentRoll
    if (maintenanceRequests !== undefined) updateData.maintenance_requests = maintenanceRequests
    if (linkedWebsites !== undefined) updateData.linked_websites = linkedWebsites

    // Financial fields (edited in table)
    if (total_mortgage_amount !== undefined) updateData.total_mortgage_amount = total_mortgage_amount
    if (purchase_price !== undefined) updateData.purchase_price = purchase_price
    if (current_est_value !== undefined) updateData.current_est_value = current_est_value
    if (monthly_mortgage_payment !== undefined) updateData.monthly_mortgage_payment = monthly_mortgage_payment
    if (monthly_insurance !== undefined) updateData.monthly_insurance = monthly_insurance
    if (monthly_property_tax !== undefined) updateData.monthly_property_tax = monthly_property_tax
    if (monthly_other_costs !== undefined) updateData.monthly_other_costs = monthly_other_costs
    if (monthly_gross_rent !== undefined) updateData.monthly_gross_rent = monthly_gross_rent
    if (mortgage_holder !== undefined) updateData.mortgage_holder = mortgage_holder
    if (ownership !== undefined) updateData.ownership = ownership

    // Basic property fields
    if (address !== undefined) updateData.address = address
    if (type !== undefined) updateData.type = type
    if (status !== undefined) updateData.status = status

    const { data, error } = await supabaseAdmin
      .from("properties")
      .update(updateData)
      .eq("id", params.id)
      .select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Log property update activity to the correct workspace
    try {
      await activityTracker.logPropertyUpdated(userId, data[0].address, property.workspace_id)
    } catch (activityError) {
      console.error('Failed to log property update activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    return NextResponse.json({ property: data[0] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // Get property details before deleting and verify workspace access
    const { data: propertyData, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("address, workspace_id")
      .eq("id", params.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error("Database error fetching property:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!propertyData) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Verify user has access to the workspace
    if (propertyData.workspace_id) {
      const userRole = await getUserWorkspaceRole(userId, propertyData.workspace_id)
      if (!userRole) {
        return NextResponse.json(
          { error: "Access denied to workspace" },
          { status: 403 }
        )
      }
    }

    // Delete the property
    const { error } = await supabaseAdmin
      .from("properties")
      .delete()
      .eq("id", params.id)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log property deletion activity to the correct workspace
    if (propertyData?.address) {
      try {
        await activityTracker.logPropertyDeleted(userId, propertyData.address, propertyData.workspace_id)
      } catch (activityError) {
        console.error('Failed to log property deletion activity:', activityError)
        // Don't fail the main operation if activity logging fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}