"use client"

import { useState, useRef, useEffect, Component, ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Loader2, Mic, MicOff, Brain } from "lucide-react"
import { BusinessContext } from "@/lib/ai-coach/context-builder"
import { MarkdownRenderer } from "./markdown-renderer"

// TypeScript types for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface Message {
  role: "user" | "assistant"
  content: string
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

// Error boundary for AI Coach
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ReactNode
}

class AiCoachErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AI Coach Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full p-4 space-y-4">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-red-500 text-6xl">⚠️</div>
              <h3 className="text-lg font-semibold">AI Coach Temporarily Unavailable</h3>
              <p className="text-muted-foreground max-w-md">
                There was an error loading the AI coach. This might be due to a temporary issue.
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

interface AiCoachPanelProps {
  initialContext: BusinessContext
  quickActions?: Array<{
    label: string
    message: string
  }>
  pageContext?: string // e.g., "dashboard", "properties", "agency", "business"
  pageData?: Record<string, any> // Specific data visible on the current page
  selectedModel?: string // Selected AI model
  onModelChange?: (model: string) => void // Callback when model changes
}

const DEFAULT_QUICK_ACTIONS = [
  { label: "Analyze this week", message: "Analyze my performance this week. What's working and what needs attention?" },
  { label: "7-day growth plan", message: "Give me a 7-day action plan to grow my business." },
  { label: "Focus today", message: "What should I focus on today to move my business forward?" },
  { label: "Client summary", message: "Summarize performance across all my clients. Highlight top performers and areas for improvement." },
]

// Internal AI Coach Panel Component
function AiCoachPanelInternal({
  initialContext,
  quickActions = DEFAULT_QUICK_ACTIONS,
  pageContext,
  pageData,
  selectedModel = "auto",
  onModelChange
}: AiCoachPanelProps) {
  console.log('🤖 AiCoachPanel - Received pageContext:', pageContext, 'quickActions:', quickActions?.map(qa => qa.label), 'pageData keys:', pageData ? Object.keys(pageData) : 'none')

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI business coach. I can analyze your business data, provide insights, and help you create action plans. What would you like to know?",
    },
  ])
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize speech recognition with browser compatibility check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        try {
          const recognitionInstance = new SpeechRecognition()

          // Check if we can actually create and configure the instance
          recognitionInstance.continuous = false
          recognitionInstance.interimResults = false
          recognitionInstance.lang = 'en-US'

          recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
            const transcript = event.results[0][0].transcript
            setInput(transcript)
            setIsListening(false)
          }

          recognitionInstance.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error)
            setIsListening(false)

            // Show user-friendly error message
            if (event.error === 'not-allowed') {
              alert('Microphone access denied. Please allow microphone access to use voice input.')
            } else if (event.error === 'no-speech') {
              // Silent - no speech detected, just stop listening
            } else {
              console.warn('Speech recognition error:', event.error)
            }
          }

          recognitionInstance.onend = () => {
            setIsListening(false)
          }

          setRecognition(recognitionInstance)
        } catch (error) {
          console.warn('Failed to initialize speech recognition:', error)
          // Don't set recognition - speech recognition will be disabled
        }
      } else {
        console.info('Speech recognition not supported in this browser')
        // Speech recognition will be disabled (recognition remains null)
      }
    }
  }, [])

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true)
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop()
      setIsListening(false)
    }
  }

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    setIsLoading(true)

    const userMessage: Message = {
      role: "user",
      content: messageText,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Create placeholder for streaming response with thinking indicator
    const assistantMessage: Message = {
      role: "assistant",
      content: "Thinking...", // Show thinking immediately
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          stream: true, // Enable streaming
          pageContext: pageContext || null,
          pageData: pageData || null,
          model: selectedModel === "auto" ? null : selectedModel, // Pass model if not auto
        }),
      })

      if (!response.ok) {
        // Try to parse error as JSON, fallback to text
        const errorData = await response.json().catch(async () => {
          const text = await response.text()
          return { error: text || "Failed to get AI response" }
        })
        const errorMsg = errorData.error || errorData.details || "Failed to get AI response"
        throw new Error(errorMsg)
      }

      // Check if response is streaming (text/plain or text/event-stream) or JSON
      const contentType = response.headers.get("content-type") || ""

      if (contentType.includes("text/plain") || contentType.includes("text/event-stream")) {
        // Handle streaming response - display text as it comes in
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ""

        if (!reader) {
          throw new Error("No response body")
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Decode chunk and append to full text
          const chunk = decoder.decode(value, { stream: true })
          if (chunk) {
            fullText += chunk

            // Update the message with the current full text
            setMessages((prev) => {
              const newMessages = [...prev]
              const lastMessage = newMessages[newMessages.length - 1]
              if (lastMessage && lastMessage.role === "assistant") {
                lastMessage.content = fullText
              }
              return newMessages
            })
          }
        }

        // If no chunks were received, show a fallback message
        if (!fullText) {
          setMessages((prev) => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content = "I'm processing your request..."
            }
            return newMessages
          })
        }

        setIsLoading(false)
      } else {
        // Handle non-streaming JSON response (fallback or cached)
        const data = await response.json()

        if (data.error) {
          throw new Error(data.error)
        }

        // Update the assistant message with full response
        let replyText = data.reply || "I apologize, but I couldn't generate a response."

        // Add database info if available (for visibility)
        if (data.dataInfo && data.dataInfo.hasData) {
          replyText += `\n\n_📊 Found ${data.dataInfo.resultCount} result(s) in your database_`
        } else if (data.dataInfo && !data.dataInfo.hasData && data.dataInfo.sqlQuery !== 'No SQL generated') {
          replyText += `\n\n_💡 Note: I queried your database but didn't find matching data_`
        }

        // Update the assistant message with full response immediately
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.role === "assistant") {
            lastMessage.content = replyText
          }
          return newMessages
        })

        setIsLoading(false)

        // Log database info to console for debugging
        if (data.dataInfo) {
          console.log("Database Query Info:", {
            sql: data.dataInfo.sqlQuery,
            resultCount: data.dataInfo.resultCount,
            hasData: data.dataInfo.hasData,
            sampleData: data.dataInfo.sampleData,
          })
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
      // Update the error message
      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage.role === "assistant") {
          lastMessage.content = error instanceof Error
            ? `Error: ${error.message}`
            : "I apologize, but I'm having trouble processing your request right now. Please try again in a moment."
        }
        return newMessages
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (message: string) => {
    sendMessage(message)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick Actions */}
      <div className="p-4 border-b space-y-2">
        <div className="text-sm font-medium text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.message)}
              disabled={isLoading}
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 break-words ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.role === "assistant" ? (
                <MarkdownRenderer content={message.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Model Selection & Input */}
      <div className="p-4 border-t space-y-3">
        {/* Model Selector */}
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedModel} onValueChange={onModelChange || (() => {})}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Select AI Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🤖 Auto (Recommended)</SelectItem>
              <SelectItem value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Free)</SelectItem>
              <SelectItem value="gemini-1.5-flash">🚀 Gemini 1.5 Flash (Free)</SelectItem>
              <SelectItem value="gemini-2.0-flash-lite">💡 Gemini 2.0 Flash-Lite (Free)</SelectItem>
              <SelectItem value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Paid)</SelectItem>
              <SelectItem value="gemini-2.5-flash">⭐ Gemini 2.5 Flash (Paid)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
          <Input
            id="aiCoachInput"
            name="aiCoachInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your business..."
            disabled={isLoading || isListening}
            className="flex-1"
          />
          {recognition ? (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              title={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={true}
              title="Voice input not supported in this browser"
            >
              <Mic className="h-4 w-4 opacity-50" />
            </Button>
          )}
          <Button type="submit" disabled={isLoading || !input.trim() || isListening}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {isListening && recognition && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            Listening... Speak now or click the mic to stop.
          </div>
        )}
        </form>
      </div>
    </div>
  )
}

// Export with error boundary
export function AiCoachPanel(props: AiCoachPanelProps) {
  return (
    <AiCoachErrorBoundary>
      <AiCoachPanelInternal {...props} />
    </AiCoachErrorBoundary>
  )
}