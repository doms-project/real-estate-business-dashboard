"use client"

import { Button } from "@/components/ui/button"
import { Rocket } from "lucide-react"
import { useState } from "react"

export function GoHighLevelButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg z-50"
        size="lg"
      >
        <Rocket className="mr-2 h-5 w-5" />
        GoHighLevel
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">GoHighLevel</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                ×
              </Button>
            </div>
            <iframe
              src="https://app.gohighlevel.com"
              className="flex-1 w-full border-0"
              title="GoHighLevel"
            />
          </div>
        </div>
      )}
    </>
  )
}


