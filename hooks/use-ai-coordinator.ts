"use client"

import { useState, useCallback } from 'react'

// Client-side AI request coordinator to prevent multiple simultaneous requests
interface AIRequestState {
  isLoading: boolean
  error: string | null
  lastRequestTime: number
}

interface QueuedRequest {
  id: string
  requestFn: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
}

class ClientAICoordinator {
  private activeRequests = 0
  private requestQueue: QueuedRequest[] = []
  private isProcessingQueue = false
  private lastRequestTime = 0
  private readonly MIN_REQUEST_INTERVAL = 5000 // Increased from 2s to 5s between requests
  private readonly MAX_CONCURRENT_REQUESTS = 1 // Only 1 concurrent request on client

  private generateRequestId(): string {
    return `client_ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      // Ensure minimum interval between requests
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      const queuedRequest = this.requestQueue.shift()
      if (!queuedRequest) continue

      try {
        this.activeRequests++
        const result = await queuedRequest.requestFn()
        this.activeRequests--
        queuedRequest.resolve(result)
      } catch (error) {
        this.activeRequests--
        queuedRequest.reject(error)
      }

      this.lastRequestTime = Date.now()
    }

    this.isProcessingQueue = false
  }

  async makeAIRequest<T>(
    componentName: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()

      // If we have capacity, execute immediately
      if (this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
        console.log(`🚀 Client AI Request: ${componentName} (immediate)`)

        this.activeRequests++
        requestFn()
          .then((result) => {
            this.activeRequests--
            console.log(`✅ Client AI Response: ${componentName}`)
            resolve(result)
          })
          .catch((error) => {
            this.activeRequests--
            console.log(`❌ Client AI Error: ${componentName} - ${error.message}`)
            reject(error)
          })

        this.lastRequestTime = Date.now()
        return
      }

      // Otherwise, queue the request
      console.log(`📋 Client AI Request queued: ${componentName} (${this.requestQueue.length + 1} in queue)`)

      this.requestQueue.push({
        id: requestId,
        requestFn,
        resolve,
        reject,
        timestamp: Date.now()
      })

      // Start processing queue
      setTimeout(() => this.processQueue(), 0)
    })
  }

  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      isProcessingQueue: this.isProcessingQueue
    }
  }
}

// Singleton instance
const clientAICoordinator = new ClientAICoordinator()

export function useAICoordinator(componentName: string) {
  const [state, setState] = useState<AIRequestState>({
    isLoading: false,
    error: null,
    lastRequestTime: 0
  })

  const makeAIRequest = useCallback(async <T,>(
    requestFn: () => Promise<T>
  ): Promise<T> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await clientAICoordinator.makeAIRequest(componentName, requestFn)
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastRequestTime: Date.now()
      }))
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI request failed'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [componentName])

  const getStatus = useCallback(() => {
    return clientAICoordinator.getStatus()
  }, [])

  return {
    makeAIRequest,
    getStatus,
    isLoading: state.isLoading,
    error: state.error,
    lastRequestTime: state.lastRequestTime
  }
}

// Export the coordinator for debugging
export { clientAICoordinator }