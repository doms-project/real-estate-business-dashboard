"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, X } from "lucide-react"
import { AiCoachPanel } from "./ai-coach-panel"
import { BusinessContext } from "@/lib/ai-coach/context-builder"
import { cn } from "@/lib/utils"

interface AiCoachSlideoutProps {
  context: BusinessContext
  quickActions?: Array<{
    label: string
    message: string
  }>
}

export function AiCoachSlideout({ context, quickActions }: AiCoachSlideoutProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="lg"
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      {/* Slide-out Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l shadow-2xl z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold">AI Coach</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 overflow-hidden">
            <AiCoachPanel initialContext={context} quickActions={quickActions} />
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

