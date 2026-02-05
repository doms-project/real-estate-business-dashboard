// Global AI state management to coordinate requests across components
// Prevents multiple simultaneous AI requests that could trigger rate limits

// Circuit breaker to temporarily disable AI when quota is consistently exceeded
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  isOpen: boolean
  nextAttemptTime: number
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    nextAttemptTime: 0
  }

  private readonly FAILURE_THRESHOLD = 5 // Open circuit after 5 failures
  private readonly TIMEOUT_MS = 300000 // 5 minutes timeout
  private readonly RESET_TIMEOUT_MS = 60000 // Reset failure count after 1 minute

  recordFailure(): void {
    const now = Date.now()
    this.state.failures++

    // Reset failure count if it's been more than RESET_TIMEOUT_MS since last failure
    if (now - this.state.lastFailureTime > this.RESET_TIMEOUT_MS) {
      this.state.failures = 1
    }

    this.state.lastFailureTime = now

    if (this.state.failures >= this.FAILURE_THRESHOLD) {
      this.state.isOpen = true
      this.state.nextAttemptTime = now + this.TIMEOUT_MS
      console.log(`🔴 Circuit breaker OPENED: Too many AI failures (${this.state.failures}). Next attempt in ${this.TIMEOUT_MS / 1000}s`)
    }
  }

  recordSuccess(): void {
    if (this.state.failures > 0) {
      this.state.failures = Math.max(0, this.state.failures - 1)
      if (this.state.failures < this.FAILURE_THRESHOLD) {
        this.state.isOpen = false
        console.log(`🟢 Circuit breaker CLOSED: AI request succeeded, failures reduced to ${this.state.failures}`)
      }
    }
  }

  canMakeRequest(): boolean {
    const now = Date.now()

    // If circuit is open, check if we can attempt again
    if (this.state.isOpen) {
      if (now >= this.state.nextAttemptTime) {
        // Allow one attempt
        console.log(`🟡 Circuit breaker HALF-OPEN: Allowing test request`)
        return true
      }
      return false
    }

    return true
  }

  getStatus() {
    return {
      isOpen: this.state.isOpen,
      failures: this.state.failures,
      nextAttemptIn: Math.max(0, this.state.nextAttemptTime - Date.now())
    }
  }
}

interface AIRequest {
  id: string
  promise: Promise<any>
  timestamp: number
  component: string
}

class GlobalAIState {
  private activeRequests = new Map<string, AIRequest>()
  private requestQueue: Array<{
    id: string
    component: string
    requestFn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    timestamp: number
  }> = []
  private isProcessingQueue = false
  private lastRequestTime = 0
  private readonly MAX_CONCURRENT_REQUESTS = 1 // Reduced from 3 to 1 for stricter limiting
  private readonly MIN_REQUEST_INTERVAL = 3000 // Increased from 1s to 3s between requests
  private circuitBreaker = new CircuitBreaker()

  private generateRequestId(): string {
    return `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
        const result = await queuedRequest.requestFn()
        queuedRequest.resolve(result)
      } catch (error) {
        queuedRequest.reject(error)
      }

      this.lastRequestTime = Date.now()
    }

    this.isProcessingQueue = false
  }

  async makeAIRequest<T>(
    component: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()

      // Check circuit breaker first
      if (!this.circuitBreaker.canMakeRequest()) {
        const status = this.circuitBreaker.getStatus()
        console.log(`🚫 AI Request blocked by circuit breaker: ${component} (${Math.round(status.nextAttemptIn / 1000)}s remaining)`)
        reject(new Error(`AI service temporarily unavailable due to high error rate. Please try again in ${Math.round(status.nextAttemptIn / 1000)} seconds.`))
        return
      }

      // Check if there are too many active requests
      if (this.activeRequests.size >= this.MAX_CONCURRENT_REQUESTS) {
        // Queue the request instead of rejecting
        this.requestQueue.push({
          id: requestId,
          component,
          requestFn,
          resolve,
          reject,
          timestamp: Date.now()
        })

        console.log(`📋 AI Request queued: ${component} (${this.requestQueue.length} in queue)`)

        // Start processing queue if not already
        setTimeout(() => this.processQueue(), 0)
        return
      }

      // Execute immediately if under limit
      const aiRequest: AIRequest = {
        id: requestId,
        promise: requestFn(),
        timestamp: Date.now(),
        component
      }

      this.activeRequests.set(requestId, aiRequest)

      console.log(`🚀 AI Request started: ${component} (${this.activeRequests.size}/${this.MAX_CONCURRENT_REQUESTS} active)`)

      aiRequest.promise
        .then((result) => {
          this.activeRequests.delete(requestId)
          this.circuitBreaker.recordSuccess()
          console.log(`✅ AI Request completed: ${component}`)
          resolve(result)

          // Process next queued request
          setTimeout(() => this.processQueue(), this.MIN_REQUEST_INTERVAL)
        })
        .catch((error) => {
          this.activeRequests.delete(requestId)
          this.circuitBreaker.recordFailure()
          console.log(`❌ AI Request failed: ${component} - ${error.message}`)
          reject(error)

          // Process next queued request even on failure
          setTimeout(() => this.processQueue(), this.MIN_REQUEST_INTERVAL)
        })
    })
  }

  getActiveRequestsCount(): number {
    return this.activeRequests.size
  }

  getQueueLength(): number {
    return this.requestQueue.length
  }

  getStatus(): {
    activeRequests: number
    queuedRequests: number
    activeComponents: string[]
    queuedComponents: string[]
    circuitBreaker: any
  } {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      activeComponents: Array.from(this.activeRequests.values()).map(req => req.component),
      queuedComponents: this.requestQueue.map(req => req.component),
      circuitBreaker: this.circuitBreaker.getStatus()
    }
  }

  // Emergency cleanup for stuck requests (timeout after 30 seconds)
  cleanupStuckRequests(): void {
    const now = Date.now()
    const stuckRequests: string[] = []
    const oldQueuedRequests: number[] = []

    // Clean up stuck active requests
    this.activeRequests.forEach((request, id) => {
      if (now - request.timestamp > 30000) { // 30 seconds timeout
        stuckRequests.push(id)
      }
    })

    // Clean up old queued requests (older than 5 minutes)
    this.requestQueue.forEach((request, index) => {
      if (now - request.timestamp > 300000) { // 5 minutes
        oldQueuedRequests.push(index)
      }
    })

    // Remove stuck requests
    stuckRequests.forEach(id => {
      const request = this.activeRequests.get(id)
      console.log(`🧹 Cleaning up stuck AI request: ${request?.component || 'unknown'} (${Math.round((now - (request?.timestamp || 0)) / 1000)}s old)`)
      this.activeRequests.delete(id)
    })

    // Remove old queued requests (in reverse order to maintain indices)
    oldQueuedRequests.reverse().forEach(index => {
      const request = this.requestQueue[index]
      console.log(`🧹 Removing old queued AI request: ${request.component} (${Math.round((now - request.timestamp) / 1000)}s old)`)
      this.requestQueue.splice(index, 1)
    })

    if (stuckRequests.length > 0 || oldQueuedRequests.length > 0) {
      console.log(`🧹 Cleanup completed: ${stuckRequests.length} stuck, ${oldQueuedRequests.length} old queued requests removed`)
      setTimeout(() => this.processQueue(), 0)
    }
  }
}

// Singleton instance
export const globalAIState = new GlobalAIState()

// Periodic cleanup
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    globalAIState.cleanupStuckRequests()
  }, 5000) // Clean up every 5 seconds

  // Also run cleanup on startup
  setTimeout(() => {
    globalAIState.cleanupStuckRequests()
  }, 1000)
}