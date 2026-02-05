import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

// Validate Supabase URL format
if (supabaseUrl && !supabaseUrl.match(/^https?:\/\//)) {
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL format: "${supabaseUrl}". Must be a valid HTTP or HTTPS URL.`)
}

/**
 * Client-side Supabase client
 * Uses anon key and respects Row Level Security (RLS) policies
 * Use this in client components and API routes that need RLS
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Server-side Supabase admin client
 * Uses service_role key and bypasses RLS policies
 * Use this in API routes and server components when you need full access
 *
 * ⚠️ WARNING: Never expose this client to the client-side!
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// For development, if service role key is missing, create a client with anon key
// This is less secure but allows development to work
export const supabaseAdminFallback: SupabaseClient = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

/**
 * Get a Supabase client for a specific user
 * Useful when you have the user's Clerk ID and want to query their data
 * 
 * @param userId - Clerk user ID
 * @returns Supabase client configured for the user
 */
export function getSupabaseClientForUser(userId: string): SupabaseClient {
  // For now, use the admin client with user_id filtering
  // In the future, you could implement JWT-based auth with Clerk
  if (!supabaseAdmin) {
    throw new Error('Supabase service role key not configured')
  }
  return supabaseAdmin
}

