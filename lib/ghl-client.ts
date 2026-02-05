// Simple, reusable GHL API client with rate limiting and retry logic
export class GHLClient {
  private lastRequestTime = 0;

  // Rate limiting: max ~4 requests per second to be safe (GHL limit is around 10-20 per second)
  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Use 300ms delay between requests to stay well under GHL limits
    const minDelay = 300;

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`🔄 Rate limiting: Waiting ${waitTime}ms before next GHL API request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
  async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, pitToken?: string, extraHeaders?: Record<string, string>) {
    // Apply rate limiting before making the request
    await this.rateLimit();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Version': '2021-07-28'
    };

    if (pitToken) {
      headers['Authorization'] = `Bearer ${pitToken}`;
    }

    if (method === 'POST' && body) {
      headers['Content-Type'] = 'application/json';
    }

    // Add any extra headers
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    console.log(`🚀 GHL API ${method}: ${endpoint}`);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(`https://services.leadconnectorhq.com${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ GHL API ${method} ${endpoint} succeeded (attempt ${attempt + 1})`);
          return result;
        }

        // Handle rate limiting (429) with exponential backoff
        if (response.status === 429) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
          console.warn(`⚠️ GHL API rate limited (429). Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          attempt++;
          continue;
        }

        // For other errors, don't retry
        console.error(`❌ GHL API ${method} ${endpoint} failed: ${response.status} ${response.statusText}`);
        throw new Error(`GHL API error: ${response.status}`);

      } catch (error) {
        if (attempt >= maxRetries) {
          console.error(`❌ GHL API ${method} ${endpoint} failed after ${maxRetries + 1} attempts:`, error);
          throw error;
        }
        attempt++;
      }
    }
  }

  // Get any data from any location (GET)
  async getLocationData(endpoint: string, locationId: string, pitToken: string) {
    return this.makeRequest(endpoint, 'GET', undefined, pitToken);
  }

  // Post data to any endpoint
  async postData(endpoint: string, body: any, pitToken?: string) {
    return this.makeRequest(endpoint, 'POST', body, pitToken);
  }
}