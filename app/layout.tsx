import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/lib/theme-context"
import { FlexboardProvider } from "@/lib/flexboard-context"
import { SystemInitializer } from "@/components/system-initializer"
import { ProfileSync } from "@/components/profile-sync"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Tenn Men AI",
  description: "Tenn Men AI - Elite Real Estate Intelligence Platform",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <FlexboardProvider>
          <html lang="en">
            <body className={inter.className}>
              <SystemInitializer />
              <ProfileSync />
              {children}
            </body>
          </html>
        </FlexboardProvider>
      </ThemeProvider>
    </ClerkProvider>
  )
}


