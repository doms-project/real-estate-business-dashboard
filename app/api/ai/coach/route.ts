import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { AI_COACH_SYSTEM_PROMPT } from "@/lib/ai-coach/system-prompt"
import { BusinessContext } from "@/lib/ai-coach/context-builder"

/**
 * POST /api/ai/coach
 * 
 * Protected API route for AI Coach chat
 * Requires authentication via Clerk
 * 
 * Body:
 * - message: string - User's question or message
 * - context: BusinessContext - Business data summary (optional, can be fetched server-side)
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

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { message, context } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // Build user message with context
    const userMessage = context
      ? `${message}\n\nBusiness Context:\n${JSON.stringify(context, null, 2)}`
      : message

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // or "gpt-4" for better quality
        messages: [
          {
            role: "system",
            content: AI_COACH_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json()
      console.error("OpenAI API error:", error)
      return NextResponse.json(
        { error: "Failed to get AI response" },
        { status: 500 }
      )
    }

    const data = await openaiResponse.json()
    const reply = data.choices[0]?.message?.content || "I apologize, but I couldn't generate a response."

    return NextResponse.json({
      reply,
    })
  } catch (error) {
    console.error("AI Coach API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

