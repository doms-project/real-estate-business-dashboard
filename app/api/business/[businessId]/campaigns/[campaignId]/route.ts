import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * PUT /api/business/[businessId]/campaigns/[campaignId] - Update a campaign
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; campaignId: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId, campaignId } = params

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Verify campaign ownership through business
    const { data: campaign, error: campaignError } = await supabaseAdmin!
      .from('campaigns')
      .select('id, business_id')
      .eq('id', campaignId)
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: any = {}

    // Only allow updating certain fields
    const allowedFields = [
      'name', 'status', 'budget', 'spent', 'currency',
      'impressions', 'clicks', 'conversions',
      'start_date', 'end_date', 'target_audience', 'notes'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['budget', 'spent'].includes(field)) {
          updateData[field] = body[field] ? parseFloat(body[field]) : null
        } else if (['impressions', 'clicks', 'conversions'].includes(field)) {
          updateData[field] = parseInt(body[field]) || 0
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // Recalculate derived metrics if performance data changed
    if (updateData.impressions !== undefined || updateData.clicks !== undefined ||
        updateData.conversions !== undefined || updateData.spent !== undefined) {

      // Get current campaign data to calculate with
      const { data: currentCampaign } = await supabaseAdmin!
        .from('campaigns')
        .select('impressions, clicks, conversions, spent')
        .eq('id', campaignId)
        .single()

      if (currentCampaign) {
        const impressions = updateData.impressions ?? currentCampaign.impressions
        const clicks = updateData.clicks ?? currentCampaign.clicks
        const conversions = updateData.conversions ?? currentCampaign.conversions
        const spent = updateData.spent ?? currentCampaign.spent

        // Calculate metrics
        updateData.ctr = impressions > 0 ? Math.min((clicks / impressions) * 100, 100) : 0
        updateData.cpc = clicks > 0 ? spent / clicks : 0
        updateData.cpa = conversions > 0 ? spent / conversions : 0
        updateData.roas = spent > 0 ? (conversions * 100) / spent : 0

        // Round to appropriate precision
        updateData.ctr = Math.round(updateData.ctr * 10000) / 10000
        updateData.cpc = Math.round(updateData.cpc * 10000) / 10000
        updateData.cpa = Math.round(updateData.cpa * 10000) / 10000
        updateData.roas = Math.round(updateData.roas * 100) / 100
      }
    }

    updateData.updated_at = new Date().toISOString()

    const { data: updatedCampaign, error } = await supabaseAdmin!
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign
    })

  } catch (error) {
    console.error('Campaign update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/business/[businessId]/campaigns/[campaignId] - Delete a campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; campaignId: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId, campaignId } = params

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabaseAdmin!
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin!
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })

  } catch (error) {
    console.error('Campaign deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}