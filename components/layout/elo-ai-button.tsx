"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import { AiCoachSlideout } from "@/components/ai-coach/ai-coach-slideout"
import { BusinessContext } from "@/lib/ai-coach/context-builder"
import { useUser } from "@clerk/nextjs"
import { usePageData } from "./page-data-context"

export function EloAiButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<BusinessContext | null>(null)
  const { user } = useUser()
  const pathname = usePathname()
  const { pageData } = usePageData()

  // Detect page context from pathname
  const getPageContext = (path: string): string | null => {
    if (path.includes("/dashboard")) return "dashboard"
    if (path.includes("/properties")) return "properties"
    if (path.includes("/agency")) return "agency"
    if (path.includes("/business")) return "business"
    if (path.includes("/campaigns")) return "campaigns"
    if (path.includes("/websites")) return "websites"
    if (path.includes("/subscriptions")) return "subscriptions"
    return null
  }

  const pageContext = getPageContext(pathname || "")

  console.log('🔍 ELO AI Button - Current pathname:', pathname, 'Detected pageContext:', pageContext)

  // Define page-specific quick actions
  const getQuickActions = (context: string | null) => {
    switch (context) {
      case "dashboard":
        return [
          { label: "Analyze dashboard", message: "Analyze my overall dashboard performance. What's working and what needs attention?" },
          { label: "7-day growth plan", message: "Give me a 7-day action plan to grow my business." },
          { label: "Focus today", message: "What should I focus on today to move my business forward?" },
          { label: "Portfolio summary", message: "Summarize my entire portfolio. Highlight top performers and biggest opportunities." },
        ]
      case "agency":
        const totalLocations = pageData?.totalLocations || 0
        const totalContacts = pageData?.totalContacts || 0
        const activeOpportunities = pageData?.activeOpportunities || 0
        const totalAssociations = pageData?.totalAssociations || 0
        const contactsWithOpportunities = pageData?.contactsWithOpportunities || 0

        return [
          { label: "Analyze agency health", message: "Analyze my agency health score and suggest improvements across all locations." },
          { label: "Performance insights", message: `I have ${totalLocations} locations with ${totalContacts} contacts and ${activeOpportunities} active opportunities. What are the key insights?` },
          { label: "Relationship analysis", message: `I have ${totalAssociations} data associations with ${contactsWithOpportunities} contacts linked to opportunities. What does this tell me about my customer relationships?` },
          { label: "Growth strategy", message: "Based on my current metrics, what strategies should I implement to grow my real estate agency?" },
          { label: "Location optimization", message: "Which locations need attention and what specific actions should I take?" },
          { label: "Focus today", message: "What should I focus on today to improve my agency performance?" },
        ]
      case "properties":
        return [
          { label: "Property analysis", message: "Analyze my property portfolio performance and identify optimization opportunities." },
          { label: "Rent optimization", message: "Which properties should I consider adjusting rent for and by how much?" },
          { label: "Maintenance insights", message: "What maintenance issues need attention and what preventive measures should I implement?" },
          { label: "Cash flow analysis", message: "How is my cash flow performing across all properties?" },
        ]
      case "business":
        return [
          { label: "Business overview", message: "Give me a comprehensive overview of my business performance." },
          { label: "Revenue analysis", message: "Analyze my revenue streams and suggest ways to increase income." },
          { label: "Expense optimization", message: "Where can I cut costs and improve profitability?" },
          { label: "Competitive strategy", message: "How can I differentiate my business in the market?" },
        ]
      case "campaigns":
        return [
          { label: "Campaign performance", message: "Analyze the effectiveness of my marketing campaigns." },
          { label: "Lead generation", message: "What campaigns are generating the most qualified leads?" },
          { label: "ROI analysis", message: "Which campaigns have the best return on investment?" },
          { label: "Campaign optimization", message: "How can I improve my campaign performance?" },
        ]
      case "websites":
        return [
          { label: "Website analytics", message: "Analyze my website performance and user engagement." },
          { label: "SEO optimization", message: "What SEO improvements should I make to drive more traffic?" },
          { label: "Conversion analysis", message: "Where are visitors dropping off and how can I improve conversions?" },
          { label: "Content strategy", message: "What content should I create to attract more leads?" },
        ]
      case "subscriptions":
        return [
          { label: "Subscription analysis", message: "Analyze my subscription and recurring revenue performance." },
          { label: "Churn prevention", message: "What strategies can I implement to reduce customer churn?" },
          { label: "Pricing strategy", message: "Is my pricing optimal for maximum revenue?" },
          { label: "Customer lifetime value", message: "How can I increase customer lifetime value?" },
        ]
      default:
        return [
          { label: "Analyze this week", message: "Analyze my performance this week. What's working and what needs attention?" },
          { label: "7-day growth plan", message: "Give me a 7-day action plan to grow my business." },
          { label: "Focus today", message: "What should I focus on today to move my business forward?" },
          { label: "Client summary", message: "Summarize performance across all my clients. Highlight top performers and areas for improvement." },
        ]
    }
  }

  const quickActions = getQuickActions(pageContext)

  useEffect(() => {
    if (user) {
      // Create a minimal general context
      const ctx: BusinessContext = {
        userId: user.id,
        summary: {
          clients: [],
        },
      }
      setContext(ctx)
    }
  }, [user])

  if (!context) return null

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40 p-0"
        size="lg"
        title="ELO AI - Talk to your AI assistant"
      >
        <Brain className="h-5 w-5" />
      </Button>

      <AiCoachSlideout
        context={context}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onClose={() => setIsOpen(false)}
        title="ELO AI"
        icon={Brain}
        pageContext={pageContext || undefined}
        pageData={pageData || undefined}
        quickActions={quickActions}
      />
    </>
  )
}

