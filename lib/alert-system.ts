// Automated Alert System for Agency Health Monitoring
// Handles alert generation, escalation, and notification workflows

import { supabaseAdmin, supabaseAdminFallback } from '@/lib/supabase'

// Alert configuration
interface AlertRule {
  id: string
  name: string
  type: 'financial' | 'operational' | 'team' | 'customer' | 'overall'
  severity: 'low' | 'medium' | 'high' | 'critical'
  condition: string // JavaScript expression to evaluate
  message: string
  escalation: {
    delay: number // minutes
    channels: ('email' | 'sms' | 'slack' | 'push')[]
    recipients: string[]
  }
  cooldown: number // minutes between alerts of same type
  enabled: boolean
}

interface AlertInstance {
  id: string
  ruleId: string
  locationId: string
  severity: string
  message: string
  triggeredAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated'
  escalationLevel: number
  notificationHistory: NotificationRecord[]
}

interface NotificationRecord {
  id: string
  channel: 'email' | 'sms' | 'slack' | 'push'
  recipient: string
  status: 'sent' | 'delivered' | 'failed' | 'bounced'
  sentAt: Date
  errorMessage?: string
}

// Default alert rules
const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'revenue_critical',
    name: 'Critical Revenue Decline',
    type: 'financial',
    severity: 'critical',
    condition: 'healthScore.revenue_achievement_rate < 50',
    message: 'CRITICAL: Revenue achievement below 50% of target',
    escalation: {
      delay: 15,
      channels: ['email', 'sms'],
      recipients: ['agency_manager', 'owner']
    },
    cooldown: 240, // 4 hours
    enabled: true
  },
  {
    id: 'revenue_warning',
    name: 'Revenue Below Target',
    type: 'financial',
    severity: 'high',
    condition: 'healthScore.revenue_achievement_rate < 75',
    message: 'Revenue achievement below 75% of target',
    escalation: {
      delay: 60,
      channels: ['email'],
      recipients: ['agency_manager']
    },
    cooldown: 480, // 8 hours
    enabled: true
  },
  {
    id: 'health_critical',
    name: 'Critical Health Score',
    type: 'overall',
    severity: 'critical',
    condition: 'healthScore.overall_score < 40',
    message: 'CRITICAL: Overall health score below 40%',
    escalation: {
      delay: 10,
      channels: ['email', 'sms', 'slack'],
      recipients: ['agency_manager', 'owner', 'team_lead']
    },
    cooldown: 120, // 2 hours
    enabled: true
  },
  {
    id: 'leads_declining',
    name: 'Lead Generation Decline',
    type: 'operational',
    severity: 'high',
    condition: 'healthScore.lead_change_percentage < -20',
    message: 'Lead generation declined by more than 20%',
    escalation: {
      delay: 30,
      channels: ['email', 'slack'],
      recipients: ['agency_manager', 'marketing_lead']
    },
    cooldown: 360, // 6 hours
    enabled: true
  },
  {
    id: 'conversion_low',
    name: 'Low Conversion Rate',
    type: 'operational',
    severity: 'medium',
    condition: 'healthScore.conversion_rate < 0.15',
    message: 'Conversion rate below 15%',
    escalation: {
      delay: 120,
      channels: ['email'],
      recipients: ['agency_manager']
    },
    cooldown: 720, // 12 hours
    enabled: true
  },
  {
    id: 'agent_utilization',
    name: 'Low Agent Utilization',
    type: 'team',
    severity: 'medium',
    condition: 'healthScore.agent_utilization_rate < 60',
    message: 'Agent utilization below 60%',
    escalation: {
      delay: 180,
      channels: ['email'],
      recipients: ['agency_manager', 'operations_lead']
    },
    cooldown: 1440, // 24 hours
    enabled: true
  }
]

// Initialize alert system
export function initializeAlertSystem() {
  // Start alert monitoring
  setInterval(checkAndGenerateAlerts, 5 * 60 * 1000) // Check every 5 minutes
  setInterval(processEscalations, 2 * 60 * 1000) // Process escalations every 2 minutes

  console.log('Alert system initialized')
}

// Check and generate alerts for all locations
export async function checkAndGenerateAlerts(): Promise<void> {
  try {
    // Get all active locations
    const { data: locations, error: locError } = await supabaseAdminFallback
      .from('agency_health_scores')
      .select('location_id')
      .order('calculated_at', { ascending: false })

    if (locError) throw locError

    const uniqueLocations = [...new Set(locations?.map(l => l.location_id) || [])]

    // Check each location
    for (const locationId of uniqueLocations) {
      await checkLocationAlerts(locationId)
    }
  } catch (error) {
    console.error('Error checking alerts:', error)
  }
}

// Check alerts for a specific location
async function checkLocationAlerts(locationId: string): Promise<void> {
  try {
    // Get latest health score
    const { data: healthScore, error } = await supabaseAdminFallback
      .from('agency_health_scores')
      .select('*')
      .eq('location_id', locationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !healthScore) return

    // Evaluate each rule
    for (const rule of DEFAULT_ALERT_RULES) {
      if (!rule.enabled) continue

      const shouldTrigger = evaluateAlertCondition(rule.condition, healthScore)
      if (shouldTrigger) {
        await createAlert(rule, locationId, healthScore)
      }
    }
  } catch (error) {
    console.error(`Error checking alerts for location ${locationId}:`, error)
  }
}

// Evaluate alert condition
function evaluateAlertCondition(condition: string, healthScore: any): boolean {
  try {
    // Create evaluation context
    const context = { healthScore }

    // Simple expression evaluator (in production, use a proper expression parser)
    const evalCondition = condition
      .replace(/healthScore\.(\w+)/g, 'context.healthScore.$1')

    // Use Function constructor for safe evaluation
    const evaluator = new Function('context', `return ${evalCondition}`)
    return evaluator(context)
  } catch (error) {
    console.error('Error evaluating alert condition:', error)
    return false
  }
}

// Create an alert
async function createAlert(rule: AlertRule, locationId: string, healthScore: any): Promise<void> {
  try {
    // Check cooldown period
    const { data: recentAlerts } = await supabaseAdminFallback
      .from('health_alerts')
      .select('created_at')
      .eq('location_id', locationId)
      .eq('alert_type', rule.type)
      .gte('created_at', new Date(Date.now() - rule.cooldown * 60 * 1000).toISOString())
      .limit(1)

    if (recentAlerts && recentAlerts.length > 0) {
      return // Still in cooldown
    }

    // Create alert
    const alertData = {
      location_id: locationId,
      alert_type: rule.type,
      severity: rule.severity,
      message: rule.message,
      status: 'active',
      trigger_metric: rule.condition.split('.')[1], // Extract metric name
      trigger_value: getMetricValue(rule.condition.split('.')[1], healthScore),
      threshold_value: extractThresholdFromCondition(rule.condition)
    }

    const { data, error } = await supabaseAdminFallback
      .from('health_alerts')
      .insert(alertData)
      .select()
      .single()

    if (error) throw error

    // Send initial notifications
    await sendAlertNotifications(data, rule.escalation.channels, rule.escalation.recipients)

    // Schedule escalation if configured
    if (rule.escalation.delay > 0) {
      setTimeout(() => {
        processAlertEscalation(data.id, rule)
      }, rule.escalation.delay * 60 * 1000)
    }

  } catch (error) {
    console.error('Error creating alert:', error)
  }
}

// Send alert notifications
async function sendAlertNotifications(
  alert: any,
  channels: string[],
  recipients: string[]
): Promise<void> {
  const notifications = []

  for (const channel of channels) {
    for (const recipient of Array.from(recipients)) {
      // Resolve recipient to actual contact info
      const contactInfo = await resolveRecipient(recipient, channel)
      if (!contactInfo) continue

      try {
        const success = await sendNotification(channel, contactInfo, alert)

        notifications.push({
          alert_id: alert.id,
          notification_type: channel,
          recipient: contactInfo,
          status: success ? 'sent' : 'failed',
          sent_at: new Date(),
          message_content: generateNotificationMessage(alert, channel)
        })
      } catch (error: any) {
        console.error(`Failed to send ${channel} notification:`, error)
        notifications.push({
          alert_id: alert.id,
          notification_type: channel,
          recipient: contactInfo,
          status: 'failed',
          sent_at: new Date(),
          error_message: error?.message || 'Unknown error'
        })
      }
    }
  }

  // Log notifications
  if (notifications.length > 0) {
    await supabaseAdminFallback
      .from('notification_log')
      .insert(notifications)
  }
}

// Send notification via specific channel
async function sendNotification(channel: string, recipient: string, alert: any): Promise<boolean> {
  switch (channel) {
    case 'email':
      return await sendEmailNotification(recipient, alert)
    case 'sms':
      return await sendSMSNotification(recipient, alert)
    case 'slack':
      return await sendSlackNotification(recipient, alert)
    case 'push':
      return await sendPushNotification(recipient, alert)
    default:
      return false
  }
}

// Process alert escalations
async function processEscalations(): Promise<void> {
  try {
    // Find active alerts that need escalation
    const { data: alerts, error } = await supabaseAdminFallback
      .from('health_alerts')
      .select('*')
      .eq('status', 'active')
      .is('acknowledged_at', null)
      .gt('escalation_level', 0)

    if (error) throw error

    for (const alert of alerts || []) {
      // Check if escalation time has passed
      const createdAt = new Date(alert.created_at)
      const escalationTime = new Date(createdAt.getTime() + (alert.escalation_level * 30 * 60 * 1000)) // 30 min levels

      if (new Date() > escalationTime) {
        await escalateAlert(alert)
      }
    }
  } catch (error) {
    console.error('Error processing escalations:', error)
  }
}

// Process alert escalation
async function processAlertEscalation(alertId: string, rule: AlertRule): Promise<void> {
  try {
    const { data: alert, error } = await supabaseAdminFallback
      .from('health_alerts')
      .select('*')
      .eq('id', alertId)
      .single()

    if (error || !alert) return

    await escalateAlert(alert)
  } catch (error) {
    console.error('Error processing alert escalation:', error)
  }
}

// Escalate an alert
async function escalateAlert(alert: any): Promise<void> {
  const newLevel = (alert.escalation_level || 0) + 1

  // Update alert
  await supabaseAdminFallback
    .from('health_alerts')
    .update({
      escalation_level: newLevel,
      status: newLevel >= 3 ? 'escalated' : 'active'
    })
    .eq('id', alert.id)

  // Send escalated notifications
  const escalationChannels = ['email', 'sms'] // Escalated alerts get more urgent channels
  const escalationRecipients = ['agency_manager', 'owner'] // Higher level recipients

  await sendAlertNotifications(alert, escalationChannels, escalationRecipients)
}

// Acknowledge alert
export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdminFallback
      .from('health_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId
      })
      .eq('id', alertId)

    return !error
  } catch (error) {
    console.error('Error acknowledging alert:', error)
    return false
  }
}

// Resolve alert
export async function resolveAlert(alertId: string, resolutionNotes?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdminFallback
      .from('health_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes
      })
      .eq('id', alertId)

    return !error
  } catch (error) {
    console.error('Error resolving alert:', error)
    return false
  }
}

// Get active alerts
export async function getActiveAlerts(locationId?: string): Promise<any[]> {
  try {
    let query = supabaseAdminFallback
      .from('health_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query
    return error ? [] : data || []
  } catch (error) {
    console.error('Error getting active alerts:', error)
    return []
  }
}

// Utility functions
function getMetricValue(metricName: string, healthScore: any): number {
  return healthScore[metricName] || 0
}

function extractThresholdFromCondition(condition: string): number {
  // Extract numeric threshold from condition (simple implementation)
  const matches = condition.match(/[\d.]+/)
  return matches ? parseFloat(matches[0]) : 0
}

async function resolveRecipient(recipient: string, channel: string): Promise<string | null> {
  // In production, this would look up actual contact info from user database
  // For now, return mock data
  const mockContacts: Record<string, Record<string, string>> = {
    agency_manager: { email: 'manager@agency.com', sms: '+1234567890', slack: '@manager' },
    owner: { email: 'owner@agency.com', sms: '+1234567891', slack: '@owner' },
    marketing_lead: { email: 'marketing@agency.com', sms: '+1234567892', slack: '@marketing' },
    operations_lead: { email: 'operations@agency.com', sms: '+1234567893', slack: '@operations' },
    team_lead: { email: 'team@agency.com', sms: '+1234567894', slack: '@team' }
  }

  return mockContacts[recipient]?.[channel] || null
}

function generateNotificationMessage(alert: any, channel: string): string {
  const baseMessage = `🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.message}`

  switch (channel) {
    case 'email':
      return `${baseMessage}\n\nLocation: ${alert.location_id}\nTriggered: ${new Date(alert.created_at).toLocaleString()}\n\nPlease review the agency dashboard for details.`
    case 'sms':
      return `${baseMessage} - Check dashboard`
    case 'slack':
      return `🚨 *${alert.severity.toUpperCase()} ALERT*\n${alert.message}\nLocation: ${alert.location_id}`
    default:
      return baseMessage
  }
}

// Mock notification functions (replace with actual implementations)
async function sendEmailNotification(email: string, alert: any): Promise<boolean> {
  console.log(`Sending email to ${email}: ${alert.message}`)
  // In production: integrate with SendGrid, AWS SES, etc.
  return true
}

async function sendSMSNotification(phone: string, alert: any): Promise<boolean> {
  console.log(`Sending SMS to ${phone}: ${alert.message}`)
  // In production: integrate with Twilio, AWS SNS, etc.
  return true
}

async function sendSlackNotification(channel: string, alert: any): Promise<boolean> {
  console.log(`Sending Slack message to ${channel}: ${alert.message}`)
  // In production: integrate with Slack API
  return true
}

async function sendPushNotification(token: string, alert: any): Promise<boolean> {
  console.log(`Sending push notification: ${alert.message}`)
  // In production: integrate with Firebase, OneSignal, etc.
  return true
}