/**
 * External Business Knowledge Integration
 * Provides competitor analysis, market data, and industry benchmarks
 */

import { createClient } from '@supabase/supabase-js'

interface CompetitorData {
  name: string
  website?: string
  location: string
  services: string[]
  strengths: string[]
  weaknesses: string[]
  pricingRange?: string
  marketShare?: number
  lastUpdated: Date
}

interface MarketData {
  location: string
  industry: string
  marketSize: number
  growthRate: number
  competitionLevel: 'low' | 'medium' | 'high'
  averageRevenue: number
  averageProfitMargin: number
  keyTrends: string[]
  entryBarriers: string[]
  lastUpdated: Date
}

interface IndustryBenchmark {
  industry: string
  metric: string
  average: number
  percentile25: number
  percentile75: number
  topPerformers: number
  source: string
  lastUpdated: Date
}

interface EconomicIndicator {
  location: string
  metric: string
  value: number
  change: number
  trend: 'improving' | 'stable' | 'declining'
  lastUpdated: Date
}

export class ExternalKnowledgeService {
  private supabase: any
  private cacheExpiry = 7 * 24 * 60 * 60 * 1000 // 7 days

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Get competitor analysis for a business
   */
  async getCompetitorAnalysis(
    businessType: string,
    location: string,
    radius: number = 25
  ): Promise<CompetitorData[]> {
    const cacheKey = `competitors_${businessType}_${location}_${radius}`

    // Check cache first
    const cached = await this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      // Simulate competitor research (in production, this would call real APIs)
      const competitors = await this.researchCompetitors(businessType, location, radius)

      // Cache the results
      await this.setCachedData(cacheKey, competitors)
      return competitors
    } catch (error) {
      console.error('Error fetching competitor data:', error)
      return []
    }
  }

  /**
   * Get market analysis for a location and industry
   */
  async getMarketAnalysis(
    location: string,
    industry: string
  ): Promise<MarketData | null> {
    const cacheKey = `market_${industry}_${location}`

    // Check cache first
    const cached = await this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const marketData = await this.analyzeMarket(location, industry)

      // Cache the results
      await this.setCachedData(cacheKey, marketData)
      return marketData
    } catch (error) {
      console.error('Error fetching market data:', error)
      return null
    }
  }

  /**
   * Get industry benchmarks for specific metrics
   */
  async getIndustryBenchmarks(
    industry: string,
    metrics?: string[]
  ): Promise<IndustryBenchmark[]> {
    const cacheKey = `benchmarks_${industry}_${metrics?.join('_') || 'all'}`

    // Check cache first
    const cached = await this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const benchmarks = await this.fetchIndustryBenchmarks(industry, metrics)

      // Cache the results
      await this.setCachedData(cacheKey, benchmarks)
      return benchmarks
    } catch (error) {
      console.error('Error fetching industry benchmarks:', error)
      return []
    }
  }

  /**
   * Get economic indicators for a location
   */
  async getEconomicIndicators(location: string): Promise<EconomicIndicator[]> {
    const cacheKey = `economics_${location}`

    // Check cache first
    const cached = await this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const indicators = await this.fetchEconomicIndicators(location)

      // Cache the results
      await this.setCachedData(cacheKey, indicators)
      return indicators
    } catch (error) {
      console.error('Error fetching economic indicators:', error)
      return []
    }
  }

  /**
   * Generate competitor insights for business analysis
   */
  async generateCompetitorInsights(
    userBusiness: any,
    competitors: CompetitorData[]
  ): Promise<string[]> {
    const insights = []

    if (competitors.length === 0) {
      return ['Unable to gather competitor data at this time.']
    }

    // Analyze pricing positioning
    const avgCompetitorPricing = this.calculateAveragePricing(competitors)
    if (userBusiness.pricing && avgCompetitorPricing) {
      if (userBusiness.pricing > avgCompetitorPricing * 1.2) {
        insights.push(`Your pricing is ${Math.round((userBusiness.pricing / avgCompetitorPricing - 1) * 100)}% above market average. Consider emphasizing premium value or targeting luxury segment.`)
      } else if (userBusiness.pricing < avgCompetitorPricing * 0.8) {
        insights.push(`Your pricing is ${Math.round((1 - userBusiness.pricing / avgCompetitorPricing) * 100)}% below market average. Focus on volume and efficiency to maintain profitability.`)
      }
    }

    // Analyze service differentiation
    const uniqueServices = this.findServiceGaps(userBusiness.services, competitors)
    if (uniqueServices.length > 0) {
      insights.push(`Consider differentiating with unique services: ${uniqueServices.join(', ')}`)
    }

    // Analyze market saturation
    const marketSaturation = competitors.length
    if (marketSaturation > 10) {
      insights.push(`High competition in your area (${marketSaturation} competitors). Focus on specialization or superior customer experience.`)
    } else if (marketSaturation < 3) {
      insights.push(`Limited competition in your area. Opportunity for market expansion and first-mover advantage.`)
    }

    return insights
  }

  /**
   * Generate market insights for business strategy
   */
  async generateMarketInsights(
    marketData: MarketData,
    userBusiness: any
  ): Promise<string[]> {
    const insights = []

    // Market size analysis
    if (marketData.marketSize > 1000000) {
      insights.push(`Large market opportunity: $${(marketData.marketSize / 1000000).toFixed(1)}M total addressable market.`)
    }

    // Growth rate analysis
    if (marketData.growthRate > 0.05) {
      insights.push(`Strong market growth: ${marketData.growthRate.toFixed(1)}% annual growth rate indicates expansion opportunity.`)
    } else if (marketData.growthRate < 0.01) {
      insights.push(`Slow growth market: ${marketData.growthRate.toFixed(1)}% annual growth. Focus on efficiency and market share.`)
    }

    // Competition analysis
    if (marketData.competitionLevel === 'low') {
      insights.push(`Low competition level suggests opportunity for market penetration and brand establishment.`)
    } else if (marketData.competitionLevel === 'high') {
      insights.push(`High competition requires strong differentiation and operational excellence.`)
    }

    // Profitability analysis
    if (marketData.averageProfitMargin > 0.20) {
      insights.push(`Above-average profitability: ${Math.round(marketData.averageProfitMargin * 100)}% industry margin suggests good profit potential.`)
    }

    return insights
  }

  // Private helper methods

  private async researchCompetitors(
    businessType: string,
    location: string,
    radius: number
  ): Promise<CompetitorData[]> {
    // Simulate competitor research
    // In production, this would call:
    // - Google Places API
    // - Yelp API
    // - Yellow Pages API
    // - Local business directories

    const mockCompetitors: CompetitorData[] = [
      {
        name: 'ABC Realty',
        website: 'abcrealty.com',
        location: `${location} area`,
        services: ['Residential Sales', 'Property Management', 'Market Analysis'],
        strengths: ['Established brand', 'Large agent network'],
        weaknesses: ['Higher pricing', 'Less personalized service'],
        pricingRange: '$8,000 - $15,000',
        marketShare: 0.15,
        lastUpdated: new Date()
      },
      {
        name: 'Local Property Solutions',
        website: 'localproperty.com',
        location: `${location} downtown`,
        services: ['Residential Sales', 'Investment Properties', 'Consulting'],
        strengths: ['Local expertise', 'Quick response time'],
        weaknesses: ['Limited marketing budget', 'Smaller network'],
        pricingRange: '$5,000 - $10,000',
        marketShare: 0.08,
        lastUpdated: new Date()
      }
    ]

    return mockCompetitors
  }

  private async analyzeMarket(
    location: string,
    industry: string
  ): Promise<MarketData> {
    // Simulate market analysis
    // In production, this would call:
    // - Census Bureau data
    // - Local economic development APIs
    // - Industry association data
    // - Commercial real estate databases

    return {
      location,
      industry,
      marketSize: 2500000, // $2.5M market size
      growthRate: 0.035, // 3.5% annual growth
      competitionLevel: 'medium',
      averageRevenue: 450000, // $450K average business revenue
      averageProfitMargin: 0.18, // 18% profit margin
      keyTrends: [
        'Remote work increasing demand for home offices',
        'Sustainability focus driving green renovations',
        'Technology adoption for virtual tours and automation'
      ],
      entryBarriers: [
        'Real estate licensing requirements',
        'Initial marketing costs',
        'Building client relationships'
      ],
      lastUpdated: new Date()
    }
  }

  private async fetchIndustryBenchmarks(
    industry: string,
    metrics?: string[]
  ): Promise<IndustryBenchmark[]> {
    // Simulate benchmark data
    // In production, this would call:
    // - IBISWorld industry reports
    // - Gartner benchmarks
    // - Local business association data
    // - Government economic data

    const defaultMetrics = ['revenue', 'profit_margin', 'customer_acquisition_cost', 'customer_lifetime_value']

    const benchmarks: IndustryBenchmark[] = [
      {
        industry,
        metric: 'revenue',
        average: 425000,
        percentile25: 150000,
        percentile75: 750000,
        topPerformers: 1200000,
        source: 'Industry Association Data',
        lastUpdated: new Date()
      },
      {
        industry,
        metric: 'profit_margin',
        average: 0.22,
        percentile25: 0.12,
        percentile75: 0.35,
        topPerformers: 0.45,
        source: 'Financial Benchmarking Study',
        lastUpdated: new Date()
      },
      {
        industry,
        metric: 'customer_acquisition_cost',
        average: 450,
        percentile25: 200,
        percentile75: 800,
        topPerformers: 150,
        source: 'Marketing Analytics Platform',
        lastUpdated: new Date()
      }
    ]

    return metrics ? benchmarks.filter(b => metrics.includes(b.metric)) : benchmarks
  }

  private async fetchEconomicIndicators(location: string): Promise<EconomicIndicator[]> {
    // Simulate economic data
    // In production, this would call:
    // - Bureau of Labor Statistics
    // - Local economic development APIs
    // - Federal Reserve data
    // - Real estate market indices

    return [
      {
        location,
        metric: 'unemployment_rate',
        value: 0.042,
        change: -0.003,
        trend: 'improving',
        lastUpdated: new Date()
      },
      {
        location,
        metric: 'median_household_income',
        value: 65000,
        change: 0.025,
        trend: 'improving',
        lastUpdated: new Date()
      },
      {
        location,
        metric: 'population_growth',
        value: 0.015,
        change: 0.002,
        trend: 'stable',
        lastUpdated: new Date()
      }
    ]
  }

  private calculateAveragePricing(competitors: CompetitorData[]): number | null {
    const prices = competitors
      .map(c => c.pricingRange)
      .filter(Boolean)
      .map(range => {
        // Extract numeric values from ranges like "$5,000 - $10,000"
        const matches = range!.match(/\$[\d,]+/g)
        if (matches && matches.length >= 2) {
          const low = parseInt(matches[0].replace(/[$,]/g, ''))
          const high = parseInt(matches[1].replace(/[$,]/g, ''))
          return (low + high) / 2
        }
        return null
      })
      .filter(Boolean) as number[]

    if (prices.length === 0) return null
    return prices.reduce((sum, price) => sum + price, 0) / prices.length
  }

  private findServiceGaps(
    userServices: string[],
    competitors: CompetitorData[]
  ): string[] {
    const allCompetitorServices = competitors.flatMap(c => c.services)
    const uniqueServices = new Set(allCompetitorServices)

    // Find services competitors offer that user doesn't
    return Array.from(uniqueServices).filter(service =>
      !userServices.some(userService =>
        userService.toLowerCase().includes(service.toLowerCase())
      )
    )
  }

  private async getCachedData(key: string): Promise<any> {
    const { data } = await this.supabase
      .from('external_knowledge_cache')
      .select('data, expires_at')
      .eq('query_hash', key)
      .single()

    if (data && new Date(data.expires_at) > new Date()) {
      return data.data
    }

    return null
  }

  private async setCachedData(key: string, data: any): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheExpiry)

    await this.supabase
      .from('external_knowledge_cache')
      .upsert({
        knowledge_type: key.split('_')[0], // Extract type from key
        query_hash: key,
        data,
        expires_at: expiresAt.toISOString()
      })
  }
}