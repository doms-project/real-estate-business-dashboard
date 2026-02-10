import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Debug: Log middleware configuration
console.log('🔍 Middleware: BYPASS_AUTH_FOR_TESTING =', process.env.BYPASS_AUTH_FOR_TESTING);
console.log('🔍 Middleware: NODE_ENV =', process.env.NODE_ENV);

// Configure Clerk middleware for development and production
const bypassAuth = process.env.BYPASS_AUTH_FOR_TESTING === 'true';
const publicRoutes = bypassAuth ? [
  // Make everything public for testing when bypass is enabled
  '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'
] : [
  '/sign-in',
  '/sign-up',
  '/',
  '/invite/(.*)', // Allow access to invitation links without authentication
  '/api/public(.*)',
  '/api/workspace/invitations/by-token', // Allow getting invitation details by token
  // '/api/workspace/invitations/accept', // Removed - requires authentication
  '/api/ghl/data', // Allow authenticated users to access GHL data
  '/api/ghl/locations', // Allow access to GHL locations
  '/api/ghl/metrics(.*)', // Allow access to metrics APIs
  '/api/analytics/script', // Allow public access to analytics script for external websites
  '/api/ai/business-insights', // Allow access to AI business insights
];

console.log('🔍 Middleware: Using bypass auth?', bypassAuth);
console.log('🔍 Middleware: Public routes:', publicRoutes);

export default authMiddleware({
  // Same authentication rules in development and production
  publicRoutes,
    // Make everything public for testing when bypass is enabled
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'
  ] : [
    '/sign-in',
    '/sign-up',
    '/',
    '/invite/(.*)', // Allow access to invitation links without authentication
    '/api/public(.*)',
    '/api/workspace/invitations/by-token', // Allow getting invitation details by token
    // '/api/workspace/invitations/accept', // Removed - requires authentication
    '/api/ghl/data', // Allow authenticated users to access GHL data
    '/api/ghl/locations', // Allow access to GHL locations
    '/api/ghl/metrics(.*)', // Allow access to metrics APIs
    '/api/analytics/script', // Allow public access to analytics script for external websites
    '/api/ai/business-insights', // Allow access to AI business insights
  ],
  // Add clock skew tolerance (helps with minor time sync issues)
  clockSkewInMs: 300000, // 5 minutes tolerance (300 seconds * 1000ms)

  // Routes that can always be accessed, and have no authentication information
  ignoredRoutes: [
    '/api/health',
    '/api/public(.*)',
  ],
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
