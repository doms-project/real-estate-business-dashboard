import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { runSupabaseQuery } from "@/lib/database"
import { getDatabaseSchema } from "@/lib/database-schema"
import { AI_COACH_SYSTEM_PROMPT } from "@/lib/ai-coach/system-prompt"
import { getCachedResponse, setCachedResponse } from "@/lib/ai-coach/cache"

/**
 * POST /api/ai/coach
 * 
 * Protected API route for AI Coach chat with database query capabilities
 * Requires authentication via Clerk
 * 
 * Flow:
 * 1. User asks a question
 * 2. Gemini generates SQL query based on question and schema
 * 3. Execute SQL via Supabase
 * 4. Gemini analyzes results and provides insights
 * 
 * Body:
 * - message: string - User's question or message
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check for Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY is missing from environment variables")
      return NextResponse.json(
        { error: "Gemini API key not configured. Please set GEMINI_API_KEY in your Vercel environment variables." },
        { status: 500 }
      )
    }

    // Check for database URL (optional but recommended)
    const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
    if (!databaseUrl) {
      console.warn("DATABASE_URL is missing - AI Coach will work but won't be able to query the database")
    }

    // Parse request body
    const body = await request.json()
    const { 
      message, 
      stream: useStreaming = true,
      pageContext = null, // New: page context (e.g., "dashboard", "properties", "agency", "business")
      pageData = null // New: specific data visible on the page
    } = body // Default to streaming

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // Check cache first (skip cache if streaming is requested)
    if (!useStreaming) {
      const cached = getCachedResponse(user.id, message)
      if (cached) {
        console.log("Returning cached response")
        return NextResponse.json({
          reply: cached.response,
          cached: true,
          ...(process.env.NODE_ENV === 'development' && {
            debug: {
              sqlQuery: cached.sqlQuery || 'No SQL generated',
              resultCount: cached.resultCount || 0,
            },
          }),
        })
      }
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    
    // Try to fetch available models first using REST API
    let availableModel: string | null = null
    try {
      const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`)
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json()
        const models = modelsData.models || []
        // Find a model that supports generateContent
        const generateContentModel = models.find((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent') || 
          m.supportedGenerationMethods?.includes('GENERATE_CONTENT')
        )
        if (generateContentModel) {
          availableModel = generateContentModel.name.replace('models/', '')
          console.log(`Found available model: ${availableModel}`)
        }
      }
    } catch (listError) {
      console.warn("Could not list models, will try default:", listError)
    }
    
    // Use available model or fallback to common names
    const modelName = availableModel || "gemini-pro"
    const model = genAI.getGenerativeModel({ model: modelName })
    console.log(`Using Gemini model: ${modelName}`)

    // Get database schema for context
    const dbSchema = getDatabaseSchema()

    // Step 1: Generate SQL query from user question
    // Make the query more targeted based on question context
    const sqlGenerationPrompt = `You are a PostgreSQL/Supabase SQL expert. Generate a SQL query to answer the user's question.

Database Schema:
${dbSchema}

User Question: ${message}

Important Rules:
1. Generate ONLY valid PostgreSQL SQL that is compatible with Supabase
2. Use ONLY tables and columns that exist in the schema above
3. Always filter by user_id = '${user.id}' to ensure users only see their own data
4. Return ONLY the SQL query, no explanations or markdown formatting
5. For SELECT queries, limit results to a reasonable number (e.g., LIMIT 50 for lists, no limit for counts/sums)
6. Use proper PostgreSQL syntax (e.g., use TEXT instead of VARCHAR, use DECIMAL for money)
7. Focus on the MOST RELEVANT data for the question - don't query everything
8. If the question is about properties, prioritize the properties table and related tables (rent_roll_units, work_requests)
9. If the question is about subscriptions, focus on the subscriptions table
10. If the question is about clients, focus on ghl_clients and ghl_weekly_metrics tables

Return the SQL query in this JSON format:
{
  "sql_query": "SELECT ... FROM ... WHERE user_id = '${user.id}' ..."
}`

    let sqlQuery: string = ''
    let queryResults: any[] = []

    try {
      // Generate SQL using Gemini
      let sqlResponse: string = ""
      try {
        const sqlResult = await model.generateContent(sqlGenerationPrompt)
        sqlResponse = sqlResult.response.text()
      } catch (geminiError: any) {
        console.error("Gemini API error:", geminiError)
        // Check if it's a 404 model not found error - try different model
        const errorMsg = geminiError?.message || String(geminiError)
        if (errorMsg.includes("404") || errorMsg.includes("not found")) {
          console.log("Model not found, trying alternative models...")
          // Try alternative models (with and without models/ prefix)
          const altModels = [
            "models/gemini-pro",
            "gemini-pro", 
            "models/gemini-1.5-flash",
            "gemini-1.5-flash",
            "models/gemini-1.5-pro",
            "gemini-1.5-pro"
          ]
          let worked = false
          for (const altModelName of altModels) {
            try {
              const altModel = genAI.getGenerativeModel({ model: altModelName })
              const altResult = await altModel.generateContent(sqlGenerationPrompt)
              sqlResponse = altResult.response.text()
              console.log(`Successfully used alternative model: ${altModelName}`)
              worked = true
              break
            } catch (altError) {
              console.warn(`Alternative model ${altModelName} also failed`)
            }
          }
          if (!worked || !sqlResponse) {
            throw new Error(`All Gemini models failed. Please check your API key and available models. Original error: ${errorMsg}`)
          }
        } else {
          throw new Error(`Failed to generate SQL query: ${errorMsg}`)
        }
      }

      // Parse JSON response to extract SQL
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = sqlResponse.match(/\{[\s\S]*"sql_query"[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[0] : sqlResponse
        const parsed = JSON.parse(jsonStr)
        sqlQuery = parsed.sql_query || parsed.sql || sqlResponse.trim()
      } catch (parseError) {
        // If JSON parsing fails, try to extract SQL directly
        // Remove markdown code blocks if present
        sqlQuery = sqlResponse
          .replace(/```sql\n?/g, '')
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        
        // Try to extract SQL from JSON-like structure
        const sqlMatch = sqlQuery.match(/"sql_query"\s*:\s*"([^"]+)"/)
        if (sqlMatch) {
          sqlQuery = sqlMatch[1].replace(/\\n/g, ' ')
        }
      }

      // Ensure user_id filter is present for security
      if (!sqlQuery.toLowerCase().includes('user_id') && !sqlQuery.toLowerCase().includes('where')) {
        // Add user_id filter if not present
        if (sqlQuery.toLowerCase().includes('select')) {
          sqlQuery = sqlQuery.replace(/FROM\s+(\w+)/i, `FROM $1 WHERE user_id = '${user.id}'`)
        }
      } else if (sqlQuery.toLowerCase().includes('where') && !sqlQuery.toLowerCase().includes(`user_id = '${user.id}'`)) {
        // Add user_id to existing WHERE clause
        sqlQuery = sqlQuery.replace(/WHERE\s+/i, `WHERE user_id = '${user.id}' AND `)
      }

      // Step 2: Execute SQL query
      try {
        console.log(`Executing SQL query: ${sqlQuery}`)
        queryResults = await runSupabaseQuery(sqlQuery)
        console.log(`Query returned ${queryResults.length} rows`)
        if (queryResults.length > 0) {
          console.log(`Sample result:`, JSON.stringify(queryResults[0], null, 2))
        }
      } catch (queryError) {
        console.error("SQL execution error:", queryError)
        console.error(`Failed SQL: ${sqlQuery}`)
        // If SQL execution fails, continue without data
        queryResults = []
      }

    } catch (sqlGenError) {
      console.error("SQL generation error:", sqlGenError)
      // If SQL generation fails, proceed without database query
      queryResults = []
    }

    // Step 3: Build page context information
    let pageContextInfo = ""
    if (pageContext) {
      pageContextInfo = `\n**Current Page Context:** The user is on the "${pageContext}" page.`
      
      // Add page-specific guidance
      switch (pageContext.toLowerCase()) {
        case "dashboard":
          pageContextInfo += ` Focus on overall portfolio health, top performers, and biggest opportunities across all their businesses.`
          break
        case "properties":
        case "property":
          pageContextInfo += ` Focus on individual property performance, cash flow analysis, ROE calculations, and property-specific opportunities.`
          break
        case "agency":
        case "agency management":
          pageContextInfo += ` Focus on client performance, marketing ROI, growth strategies, and agency metrics.`
          break
        case "business":
        case "business hub":
          pageContextInfo += ` Focus on campaigns performance, revenue trends, business metrics, and marketing optimization.`
          break
        case "campaigns":
          pageContextInfo += ` Focus on campaign ROI, performance metrics, budget optimization, and marketing strategy.`
          break
      }
    }

    // Add page-specific data if provided
    if (pageData && typeof pageData === 'object') {
      pageContextInfo += `\n\n**Page-Specific Data Available:**\n${JSON.stringify(pageData, null, 2)}\n\nUse this data to provide context-aware insights. Reference specific numbers, properties, campaigns, or metrics visible on the page.`
    }

    // Step 4: Analyze results and generate insights
    const hasData = queryResults.length > 0
    const dataSummary = hasData 
      ? `Here's the data I found from the database:

${JSON.stringify(queryResults, null, 2)}

**SQL Query Used:** ${sqlQuery}

**Database Schema Context:**
${dbSchema}

**IMPORTANT:** Reference the actual data numbers in your response. For example, if the query returned 5 properties, say "You have 5 properties". If it shows specific amounts, mention them. Use property addresses, exact dollar amounts, percentages, and specific metrics.`
      : `I couldn't find specific data in the database for this question. 

**SQL Query Attempted:** ${sqlQuery || 'No SQL query was generated'}

**Note:** I can still provide real estate coaching advice based on the page context and general principles, but I don't have access to your specific database data for this question.`

    const analysisPrompt = `${AI_COACH_SYSTEM_PROMPT}

**User's Question:** "${message}"
${pageContextInfo}

${dataSummary}

**Your Response Guidelines:**
- Use the page context to tailor your response - if they're on the Properties page, focus on property analysis
- Reference specific numbers from the database OR page data (e.g., "You have 5 properties", "Your campaign ROAS is 3.2x", "Property at 123 Main St has 18% ROE")
- Be energetic and motivational but data-driven
- Provide actionable insights, not just observations
- Ask ONE follow-up question to move the conversation forward
- Length: 3-6 sentences for quick answers, 2-3 paragraphs for analysis
- If analyzing properties: calculate ROE, cash-on-cash return, and cash flow
- If analyzing campaigns: focus on ROAS, conversion rates, and optimization opportunities
- Always connect insights to their goals and next steps

**Remember:** You're ELO AI - Elite Real Estate Intelligence. Lead with data, inspire with vision, execute with strategy!`

    // Generate final response (streaming or regular)
    if (useStreaming) {
      // Streaming response
      try {
        const stream = await model.generateContentStream(analysisPrompt)
        
        // Create a readable stream with proper chunking
        const encoder = new TextEncoder()
        const readableStream = new ReadableStream({
          async start(controller) {
            let fullResponse = ""
            try {
              // Process stream chunks - send immediately as they arrive
              let chunkCount = 0
              for await (const chunk of stream.stream) {
                try {
                  const chunkText = chunk.text()
                  if (chunkText) {
                    chunkCount++
                    fullResponse += chunkText
                    // Send each chunk immediately - don't buffer
                    // Send as UTF-8 encoded text
                    controller.enqueue(encoder.encode(chunkText))
                    console.log(`Sent chunk ${chunkCount}, length: ${chunkText.length}`)
                  }
                } catch (chunkError) {
                  console.warn("Error processing chunk:", chunkError)
                  // Continue with next chunk
                }
              }
              
              console.log(`Streaming complete. Processed ${chunkCount} chunks. Total length: ${fullResponse.length}`)
              
              // Cache the full response after streaming completes
              setCachedResponse(user.id, message, fullResponse, {
                sqlQuery: sqlQuery || undefined,
                resultCount: queryResults.length,
              })
              
              controller.close()
            } catch (streamError) {
              console.error("Streaming error:", streamError)
              const errorText = `\n\nError: ${streamError instanceof Error ? streamError.message : String(streamError)}`
              controller.enqueue(encoder.encode(errorText))
              controller.close()
            }
          },
        })

        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8', // Use plain text instead of event-stream
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering in nginx
            'Transfer-Encoding': 'chunked',
          },
        })
      } catch (geminiError: any) {
        console.error("Gemini streaming error:", geminiError)
        // Fallback to non-streaming - continue to regular response below
      }
    }

    // Non-streaming response (or fallback)
    let reply: string = ""
    try {
      const analysisResult = await model.generateContent(analysisPrompt)
      reply = analysisResult.response.text()
      
      // Cache the response
      setCachedResponse(user.id, message, reply, {
        sqlQuery: sqlQuery || undefined,
        resultCount: queryResults.length,
      })
    } catch (geminiError: any) {
      console.error("Gemini analysis error:", geminiError)
      // Check if it's a 404 model not found error - try different model
      const errorMsg = geminiError?.message || String(geminiError)
      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        console.log("Model not found for analysis, trying alternative models...")
          // Try alternative models (with and without models/ prefix)
          const altModels = [
            "models/gemini-pro",
            "gemini-pro", 
            "models/gemini-1.5-flash",
            "gemini-1.5-flash",
            "models/gemini-1.5-pro",
            "gemini-1.5-pro"
          ]
        let worked = false
        for (const altModelName of altModels) {
          try {
            const altModel = genAI.getGenerativeModel({ model: altModelName })
            const altResult = await altModel.generateContent(analysisPrompt)
            reply = altResult.response.text()
            console.log(`Successfully used alternative model for analysis: ${altModelName}`)
            
            // Cache the response
            setCachedResponse(user.id, message, reply, {
              sqlQuery: sqlQuery || undefined,
              resultCount: queryResults.length,
            })
            
            worked = true
            break
          } catch (altError) {
            console.warn(`Alternative model ${altModelName} also failed for analysis`)
          }
        }
        if (!worked || !reply) {
          throw new Error(`All Gemini models failed for analysis. Please check your API key and available models. Original error: ${errorMsg}`)
        }
      } else {
        throw new Error(`Failed to generate analysis: ${errorMsg}`)
      }
    }

    return NextResponse.json({
      reply,
      cached: false,
      // Include query info so user can see what data was accessed
      dataInfo: {
        sqlQuery: sqlQuery || 'No SQL generated',
        resultCount: queryResults.length,
        hasData: queryResults.length > 0,
        sampleData: queryResults.length > 0 ? queryResults.slice(0, 3) : null, // First 3 rows as sample
      },
    })
  } catch (error) {
    console.error("AI Coach API error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log full error details for debugging
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      geminiApiKey: process.env.GEMINI_API_KEY ? "Set" : "Missing",
      databaseUrl: process.env.DATABASE_URL ? "Set" : "Missing",
    })
    
    return NextResponse.json(
      { 
        error: errorMessage || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
