'use client'

import { useEffect, useState } from 'react'

interface TestResult {
  location: string
  locationId: string
  contacts: number | string
  opportunities: number | string
  conversations: number | string
  timestamp: string
  error?: string
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/test-endpoints')
      .then(res => res.json())
      .then(data => {
        setResults(data.results || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing GHL API Integration</h1>
        <div className="text-lg">Loading test results...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Test Failed</h1>
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">GHL API Integration Test</h1>

      <div className="space-y-6">
        {results.map((result, index) => (
          <div key={index} className="border rounded-lg p-6 bg-white shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              {result.location}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {typeof result.contacts === 'number' ? result.contacts.toLocaleString() : result.contacts}
                </div>
                <div className="text-sm text-gray-600">Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {typeof result.opportunities === 'number' ? result.opportunities.toLocaleString() : result.opportunities}
                </div>
                <div className="text-sm text-gray-600">Opportunities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {typeof result.conversations === 'number' ? result.conversations.toLocaleString() : result.conversations}
                </div>
                <div className="text-sm text-gray-600">Conversations</div>
              </div>
            </div>
            {result.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-red-600 font-medium">Error:</div>
                <div className="text-red-500 text-sm">{result.error}</div>
              </div>
            )}
            <div className="mt-4 text-xs text-gray-500">
              Last updated: {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Test Summary</h3>
        <p className="text-sm text-gray-600">
          This page tests the GHL API integration by calling the real endpoints.
          If you see numbers above, the API is working correctly.
          If you see &quot;ERROR&quot;, there are API issues to fix.
        </p>
      </div>
    </div>
  )
}
