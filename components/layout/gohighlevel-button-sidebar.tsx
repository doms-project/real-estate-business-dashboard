"use client"

import { Button } from "@/components/ui/button"
import { Rocket } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

interface GoHighLevelButtonSidebarProps {
  collapsed?: boolean
}

export function GoHighLevelButtonSidebar({ collapsed }: GoHighLevelButtonSidebarProps) {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const handleClick = () => {
    if (!isLoaded) return // Wait for auth to load

    if (!user) {
      // Not logged in - only redirect if auth redirects are enabled
      if (process.env.NODE_ENV === 'production' || !process.env.DISABLE_AUTH_REDIRECT) {
        router.push('/sign-in')
      } else {
        // Auth redirects disabled - show GHL anyway or do nothing
        window.open('http://app.gohighlevel.com/', '_blank')
      }
    } else {
      // Logged in - go to GoHighLevel main app
      window.open('http://app.gohighlevel.com/', '_blank')
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        className={collapsed ? "w-full h-10" : "w-full"}
        variant="outline"
      >
        <Rocket className={collapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {!collapsed && <span>GoHighLevel</span>}
      </Button>
    </>
  )
}

