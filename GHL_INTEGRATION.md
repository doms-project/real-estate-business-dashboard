# GoHighLevel API Integration Guide

This guide explains how to connect the GoHighLevel client dashboard to the real GoHighLevel API.

## Current Implementation

The dashboard currently uses mock data. To connect to the real GoHighLevel API, you'll need to:

1. **Set up GoHighLevel API credentials**
2. **Create API routes to fetch data**
3. **Update components to use real data**

## GoHighLevel API Setup

### 1. Get API Credentials

1. Log into your GoHighLevel account
2. Go to Settings → Integrations → API
3. Generate an API key
4. Store it securely (use environment variables)

### 2. Environment Variables

Add to `.env.local`:

```env
GHL_API_KEY=your_ghl_api_key_here
GHL_API_URL=https://services.leadconnectorhq.com
```

### 3. Create API Routes

Create these files in `app/api/ghl/`:

#### `app/api/ghl/clients/route.ts`
```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const apiKey = process.env.GHL_API_KEY
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') // For affiliate filtering

  try {
    // Fetch locations/clients from GHL API
    const response = await fetch(`${process.env.GHL_API_URL}/locations`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    // Transform GHL data to our format
    const clients = data.locations?.map((location: any) => ({
      id: location.id,
      name: location.name,
      email: location.email,
      phone: location.phone,
      company: location.companyName,
      subscriptionPlan: determinePlan(location),
      affiliateUserId: userId, // Set based on your affiliate logic
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      status: location.status === 'active' ? 'active' : 'inactive',
      ghlLocationId: location.id,
    }))

    return NextResponse.json({ clients })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}
```

#### `app/api/ghl/metrics/[id]/route.ts`
```typescript
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const apiKey = process.env.GHL_API_KEY

  try {
    // Fetch metrics from GHL API
    // This will depend on what metrics GHL provides
    // You may need to aggregate data from multiple endpoints
    
    const [contacts, opportunities, deals] = await Promise.all([
      fetch(`${process.env.GHL_API_URL}/contacts?locationId=${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }),
      fetch(`${process.env.GHL_API_URL}/opportunities?locationId=${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }),
      fetch(`${process.env.GHL_API_URL}/deals?locationId=${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }),
    ])

    // Calculate metrics
    const metrics = {
      clientId: id,
      currentWeek: calculateWeeklyMetrics(contacts, opportunities, deals),
      lastWeek: calculateLastWeekMetrics(contacts, opportunities, deals),
      thisMonth: calculateMonthlyMetrics(contacts, opportunities, deals),
      allTime: calculateAllTimeMetrics(contacts, opportunities, deals),
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
```

## Affiliate System

### How It Works

1. **User Registration**: When a user signs up, they get a unique affiliate ID (their Clerk user ID)
2. **Client Assignment**: When adding a client, assign them to the current user's affiliate ID
3. **Filtering**: The dashboard filters clients by `affiliateUserId === currentUser.id`

### Database Schema (Supabase)

If using Supabase, create these tables:

```sql
-- GoHighLevel Clients
CREATE TABLE ghl_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Clerk user ID (affiliate)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  subscription_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ghl_location_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Weekly Metrics
CREATE TABLE ghl_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES ghl_clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  views INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, week_start)
);

-- Create indexes
CREATE INDEX idx_ghl_clients_user_id ON ghl_clients(user_id);
CREATE INDEX idx_ghl_metrics_client_id ON ghl_weekly_metrics(client_id);
CREATE INDEX idx_ghl_metrics_week ON ghl_weekly_metrics(week_start);
```

## Updating Components

### Update `app/(dashboard)/ghl-clients/page.tsx`

Replace mock data with API calls:

```typescript
"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"

export default function GHLClientsPage() {
  const { user } = useUser()
  const [clients, setClients] = useState<GoHighLevelClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch(`/api/ghl/clients?userId=${user?.id}`)
        const data = await response.json()
        setClients(data.clients)
      } catch (error) {
        console.error('Failed to fetch clients:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchClients()
    }
  }, [user])

  // ... rest of component
}
```

## Subscription Plan Mapping

Map GoHighLevel subscription tiers to your plan types:

```typescript
function determinePlan(ghlLocation: any): SubscriptionPlan {
  // Map based on GHL subscription data
  // This depends on what GHL provides
  if (ghlLocation.subscriptionTier === 'starter') return 'starter'
  if (ghlLocation.subscriptionTier === 'professional') return 'professional'
  if (ghlLocation.subscriptionTier === 'agency') return 'agency'
  if (ghlLocation.subscriptionTier === 'enterprise') return 'enterprise'
  return 'custom'
}
```

## Next Steps

1. **Set up GoHighLevel API credentials**
2. **Create API routes** (see examples above)
3. **Set up database** (if using Supabase)
4. **Update components** to fetch real data
5. **Add error handling** and loading states
6. **Implement data refresh** (polling or webhooks)

## Resources

- [GoHighLevel API Documentation](https://highlevel.stoplight.io/docs/integrations)
- [GoHighLevel API Reference](https://highlevel.stoplight.io/docs/integrations/api-reference)

