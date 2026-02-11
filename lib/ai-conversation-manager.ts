/**
 * Advanced Conversation Manager for ELO Business Intelligence AI
 * Handles conversation memory, context awareness, and proactive intelligence
 */

import { createClient } from '@supabase/supabase-js'
import { BusinessContext } from './ai-coach/context-builder'
import { ExternalKnowledgeService } from './external-knowledge'

interface ConversationMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: {
    analysisType?: string
    dataReferenced?: string[]
    insightsGenerated?: string[]
    questionsAsked?: string[]
    actionsSuggested?: string[]
  }
  createdAt: Date
}

interface ConversationState {
  conversationId: string
  userId: string
  workspaceId?: string
  messages: ConversationMessage[]
  context: BusinessContext
  summary?: string
  keyTopics: string[]
  lastActivity: Date
}

interface UserPreferences {
  businessGoals: string[]
  preferredAnalysisTypes: string[]
  communicationStyle: 'professional' | 'casual' | 'technical'
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced'
  proactiveInsights: boolean
  externalKnowledgeEnabled: boolean
  realTimeAlerts: boolean
  industryFocus: string[]
  keyMetrics: string[]
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
}

interface BusinessInsight {
  id: string
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation' | 'alert'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  recommendations: string[]
  impactEstimate?: string
  confidenceScore: number
  dataReferences: any[]
}

export class ConversationManager {
  private supabase: any
  private externalKnowledge: ExternalKnowledgeService
  private conversationStates: Map<string, ConversationState> = new Map()

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    this.externalKnowledge = new ExternalKnowledgeService()
  }

  /**
   * Initialize or load conversation state
   */
  async initializeConversation(
    userId: string,
    workspaceId?: string,
    conversationId?: string
  ): Promise<ConversationState> {
    const convId = conversationId || `conv_${userId}_${Date.now()}`

    // Check if we have this conversation in memory
    if (this.conversationStates.has(convId)) {
      return this.conversationStates.get(convId)!
    }

    // Load from database
    const { data: messages } = await this.supabase
      .from('ai_conversations')
      .select('*')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    const { data: summary } = await this.supabase
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', convId)
      .eq('user_id', userId)
      .single()

    // Load user preferences
    const { data: userContext } = await this.supabase
      .from('ai_user_context')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    const preferences: UserPreferences = userContext ? {
      businessGoals: userContext.business_goals || [],
      preferredAnalysisTypes: userContext.preferred_analysis_types || [],
      communicationStyle: userContext.communication_style || 'professional',
      expertiseLevel: userContext.expertise_level || 'intermediate',
      proactiveInsights: userContext.proactive_insights ?? true,
      externalKnowledgeEnabled: userContext.external_knowledge_enabled ?? true,
      realTimeAlerts: userContext.real_time_alerts ?? true,
      industryFocus: userContext.industry_focus || [],
      keyMetrics: userContext.key_metrics || [],
      riskTolerance: userContext.risk_tolerance || 'moderate'
    } : this.getDefaultPreferences()

    const state: ConversationState = {
      conversationId: convId,
      userId,
      workspaceId,
      messages: messages?.map(this.mapDatabaseMessage) || [],
      context: {} as BusinessContext, // Will be populated by caller
      summary: summary?.summary,
      keyTopics: summary?.key_topics || [],
      lastActivity: new Date()
    }

    this.conversationStates.set(convId, state)
    return state
  }

  /**
   * Process a new message and generate response context
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    currentBusinessContext: BusinessContext
  ): Promise<{
    enrichedContext: any
    relevantHistory: ConversationMessage[]
    userPreferences: UserPreferences
    proactiveInsights: BusinessInsight[]
  }> {

    const state = this.conversationStates.get(conversationId)
    if (!state) {
      throw new Error('Conversation not initialized')
    }

    // Update conversation state with fresh business context
    state.context = currentBusinessContext
    state.lastActivity = new Date()

    // Get user preferences
    const userPreferences = await this.getUserPreferences(state.userId, state.workspaceId)

    // Find relevant historical context
    const relevantHistory = await this.findRelevantHistory(userMessage, state)

    // Generate proactive insights based on current business state
    const proactiveInsights = await this.generateProactiveInsights(currentBusinessContext, state)

    // Enrich context with conversation history and preferences
    const enrichedContext = {
      ...currentBusinessContext,
      conversationHistory: relevantHistory.slice(-5), // Last 5 messages for context
      userPreferences,
      proactiveInsights: proactiveInsights.slice(0, 3), // Top 3 insights
      conversationSummary: state.summary,
      keyTopics: state.keyTopics
    }

    return {
      enrichedContext,
      relevantHistory,
      userPreferences,
      proactiveInsights
    }
  }

  /**
   * Save a message to conversation history
   */
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    const state = this.conversationStates.get(conversationId)
    if (!state) return

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      role,
      content,
      metadata,
      createdAt: new Date()
    }

    // Add to in-memory state
    state.messages.push(message)
    state.lastActivity = new Date()

    // Save to database
    await this.supabase
      .from('ai_conversations')
      .insert({
        user_id: state.userId,
        workspace_id: state.workspaceId,
        conversation_id: conversationId,
        message_id: message.id,
        role,
        content,
        metadata: metadata || {}
      })

    // Update conversation summary if needed (every 10 messages)
    if (state.messages.length % 10 === 0) {
      await this.updateConversationSummary(state)
    }
  }

  /**
   * Generate proactive business insights
   */
  private async generateProactiveInsights(
    context: BusinessContext,
    conversationState: ConversationState
  ): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = []

    // Get external knowledge for enhanced insights
    let competitorData: any[] = []
    let marketData: any = null
    let benchmarks: any[] = []

    try {
      // Get competitor analysis
      competitorData = await this.externalKnowledge.getCompetitorAnalysis(
        'real_estate',
        context.location || 'local_area',
        25
      )

      // Get market analysis
      marketData = await this.externalKnowledge.getMarketAnalysis(
        context.location || 'local_area',
        'real_estate'
      )

      // Get industry benchmarks
      benchmarks = await this.externalKnowledge.getIndustryBenchmarks(
        'real_estate',
        ['revenue', 'profit_margin', 'customer_acquisition_cost']
      )
    } catch (error) {
      console.error('Error fetching external knowledge:', error)
    }

    // Revenue analysis with external context
    if (context.revenueBreakdown?.total) {
      const totalRevenue = context.revenueBreakdown.total

      // Low revenue warning
      if (totalRevenue < 10000) {
        insights.push({
          id: `insight_${Date.now()}_revenue`,
          type: 'risk',
          severity: 'high',
          title: 'Revenue Optimization Needed',
          description: `Monthly revenue of $${totalRevenue.toLocaleString()} is below optimal levels for business growth. ${marketData ? `Market shows $${(marketData.marketSize / 1000000).toFixed(1)}M opportunity in your area.` : ''}`,
          recommendations: [
            'Analyze competitor pricing and service strategies',
            'Implement targeted marketing campaigns based on market analysis',
            'Review pricing strategy against local competition',
            'Consider service expansion to match competitor offerings'
          ],
          impactEstimate: '$5,000-$15,000 monthly revenue increase',
          confidenceScore: 0.85,
          dataReferences: ['revenueBreakdown.total']
        })
      }

      // Revenue concentration warning
      const propertyRevenue = context.revenueBreakdown.properties || 0
      const revenueConcentration = propertyRevenue / totalRevenue
      if (revenueConcentration > 0.8) {
        insights.push({
          id: `insight_${Date.now()}_diversification`,
          type: 'opportunity',
          severity: 'medium',
          title: 'Revenue Diversification Opportunity',
          description: `${(revenueConcentration * 100).toFixed(0)}% of revenue from properties - consider diversifying income streams`,
          recommendations: [
            'Develop consulting services',
            'Create digital products',
            'Expand service offerings',
            'Partner with complementary businesses'
          ],
          impactEstimate: 'Reduce revenue risk by 40%',
          confidenceScore: 0.75,
          dataReferences: ['revenueBreakdown']
        })
      }
    }

    // Location performance analysis
    if (context.allLocations && context.allLocations.length > 0) {
      const avgHealthScore = context.allLocations.reduce((sum: number, loc: any) =>
        sum + (loc.currentMetrics?.health_score || 0), 0) / context.allLocations.length

      if (avgHealthScore < 70) {
        insights.push({
          id: `insight_${Date.now()}_health`,
          type: 'alert',
          severity: 'high',
          title: 'Location Health Optimization Required',
          description: `Average location health score of ${avgHealthScore.toFixed(0)}% indicates performance issues`,
          recommendations: [
            'Audit location-specific marketing campaigns',
            'Review operational processes at underperforming locations',
            'Analyze competitor strategies in those areas',
            'Implement location-specific improvement plans'
          ],
          impactEstimate: '15-25% performance improvement',
          confidenceScore: 0.8,
          dataReferences: ['allLocations']
        })
      }
    }

    // Opportunity pipeline analysis
    if (context.totalOpportunities && context.totalContacts) {
      const conversionRate = (context.totalOpportunities / context.totalContacts) * 100

      if (conversionRate < 5) {
        insights.push({
          id: `insight_${Date.now()}_conversion`,
          type: 'opportunity',
          severity: 'medium',
          title: 'Conversion Rate Optimization',
          description: `Lead conversion rate of ${conversionRate.toFixed(1)}% is below industry average of 8-12%`,
          recommendations: [
            'Improve lead qualification process',
            'Enhance sales follow-up sequences',
            'Train sales team on conversion techniques',
            'Implement lead scoring system'
          ],
          impactEstimate: '2-3x increase in conversion rate',
          confidenceScore: 0.9,
          dataReferences: ['totalOpportunities', 'totalContacts']
        })
      }
    }

    // Save insights to database if they're significant
    for (const insight of insights) {
      if (insight.severity === 'high' || insight.severity === 'critical') {
        await this.saveInsight(insight, conversationState)
      }
    }

    return insights
  }

  /**
   * Find relevant historical messages for context
   */
  private async findRelevantHistory(
    currentMessage: string,
    conversationState: ConversationState
  ): Promise<ConversationMessage[]> {
    const messages = conversationState.messages

    // Simple relevance scoring based on keywords
    const currentKeywords = this.extractKeywords(currentMessage.toLowerCase())
    const relevantMessages: Array<{message: ConversationMessage, score: number}> = []

    for (const message of messages.slice(-20)) { // Last 20 messages
      if (message.role === 'user') {
        const messageKeywords = this.extractKeywords(message.content.toLowerCase())
        const commonKeywords = currentKeywords.filter(k =>
          messageKeywords.some(mk => mk.includes(k) || k.includes(mk))
        )
        const score = commonKeywords.length / Math.max(currentKeywords.length, 1)
        if (score > 0.2) { // 20% keyword overlap
          relevantMessages.push({ message, score })
        }
      }
    }

    // Return top 5 most relevant messages
    return relevantMessages
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.message)
  }

  /**
   * Extract keywords from text for relevance matching
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'how', 'what', 'when', 'where', 'why', 'which', 'who', 'that', 'this', 'these', 'those']

    return text
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !stopWords.includes(word))
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)
  }

  /**
   * Get user preferences with defaults
   */
  private async getUserPreferences(userId: string, workspaceId?: string): Promise<UserPreferences> {
    const { data } = await this.supabase
      .from('ai_user_context')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    if (data) {
      return {
        businessGoals: data.business_goals || [],
        preferredAnalysisTypes: data.preferred_analysis_types || [],
        communicationStyle: data.communication_style || 'professional',
        expertiseLevel: data.expertise_level || 'intermediate',
        proactiveInsights: data.proactive_insights ?? true,
        externalKnowledgeEnabled: data.external_knowledge_enabled ?? true,
        realTimeAlerts: data.real_time_alerts ?? true,
        industryFocus: data.industry_focus || [],
        keyMetrics: data.key_metrics || [],
        riskTolerance: data.risk_tolerance || 'moderate'
      }
    }

    return this.getDefaultPreferences()
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      businessGoals: ['growth', 'profitability', 'efficiency'],
      preferredAnalysisTypes: ['financial', 'operational', 'marketing'],
      communicationStyle: 'professional',
      expertiseLevel: 'intermediate',
      proactiveInsights: true,
      externalKnowledgeEnabled: true,
      realTimeAlerts: true,
      industryFocus: ['real_estate'],
      keyMetrics: ['revenue', 'profit', 'conversion_rate'],
      riskTolerance: 'moderate'
    }
  }

  /**
   * Map database message to ConversationMessage
   */
  private mapDatabaseMessage(dbMessage: any): ConversationMessage {
    return {
      id: dbMessage.message_id,
      conversationId: dbMessage.conversation_id,
      role: dbMessage.role,
      content: dbMessage.content,
      metadata: dbMessage.metadata || {},
      createdAt: new Date(dbMessage.created_at)
    }
  }

  /**
   * Save insight to database
   */
  private async saveInsight(insight: BusinessInsight, conversationState: ConversationState): Promise<void> {
    await this.supabase
      .from('business_insights')
      .insert({
        user_id: conversationState.userId,
        workspace_id: conversationState.workspaceId,
        insight_type: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        data_references: insight.dataReferences,
        recommendations: insight.recommendations,
        impact_estimate: insight.impactEstimate,
        confidence_score: insight.confidenceScore,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })
  }

  /**
   * Update conversation summary
   */
  private async updateConversationSummary(conversationState: ConversationState): Promise<void> {
    // This would call AI to generate a summary
    // For now, create a basic summary
    const summary = `Conversation with ${conversationState.messages.length} messages covering ${conversationState.keyTopics.join(', ') || 'various business topics'}`

    await this.supabase
      .from('conversation_summaries')
      .upsert({
        conversation_id: conversationState.conversationId,
        user_id: conversationState.userId,
        workspace_id: conversationState.workspaceId,
        summary,
        key_topics: conversationState.keyTopics,
        last_message_at: new Date(),
        message_count: conversationState.messages.length
      })
  }

  /**
   * Get active insights for user
   */
  async getActiveInsights(userId: string, workspaceId?: string, limit: number = 10): Promise<BusinessInsight[]> {
    const { data } = await this.supabase
      .rpc('get_active_business_insights', {
        p_user_id: userId,
        p_workspace_id: workspaceId,
        p_limit: limit
      })

    return data?.map(this.mapDatabaseInsight) || []
  }

  private mapDatabaseInsight(dbInsight: any): BusinessInsight {
    return {
      id: dbInsight.id,
      type: dbInsight.insight_type,
      severity: dbInsight.severity,
      title: dbInsight.title,
      description: dbInsight.description,
      recommendations: dbInsight.recommendations,
      impactEstimate: dbInsight.impact_estimate,
      confidenceScore: dbInsight.confidence_score,
      dataReferences: dbInsight.data_references
    }
  }
}