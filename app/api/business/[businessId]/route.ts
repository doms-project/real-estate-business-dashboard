import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/business/[businessId] - Delete a business
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const businessId = params.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // First, delete all campaigns for this business
    const { error: campaignsError } = await supabaseAdmin!
      .from('campaigns')
      .delete()
      .eq('business_id', businessId)

    if (campaignsError) {
      console.error('Error deleting campaigns:', campaignsError)
      // Continue with business deletion even if campaigns deletion fails
    }

    // Then delete the business
    const { data, error } = await supabaseAdmin!
      .from('businesses')
      .delete()
      .eq('id', businessId)
      .select()

    if (error) {
      console.error('Error deleting business:', error)
      return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Business and associated campaigns deleted successfully',
      deletedBusiness: data[0]
    })
  } catch (error) {
    console.error('Business deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}