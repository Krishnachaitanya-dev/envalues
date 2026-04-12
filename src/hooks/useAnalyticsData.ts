import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { subDays, format, startOfDay, getHours, parseISO } from 'date-fns'

export type DailyCount = { date: string; conversations: number }
export type HourCount = { hour: string; count: number }
export type NodeStat = { label: string; count: number }

export type AnalyticsData = {
  totalConversations: number
  conversationsToday: number
  conversationsThisWeek: number
  uniqueCustomers: number
  daily: DailyCount[]
  peakHours: HourCount[]
  topNodes: NodeStat[]
  loading: boolean
  error: string | null
}

export function useAnalyticsData(chatbotId: string | null): AnalyticsData {
  const [data, setData] = useState<Omit<AnalyticsData, 'loading' | 'error'>>({
    totalConversations: 0,
    conversationsToday: 0,
    conversationsThisWeek: 0,
    uniqueCustomers: 0,
    daily: [],
    peakHours: [],
    topNodes: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chatbotId) { setLoading(false); return }

    async function fetchAnalytics() {
      setLoading(true)
      setError(null)
      try {
        // Fetch all sessions for this chatbot (last 90 days for performance)
        const since = subDays(new Date(), 90).toISOString()
        const { data: sessions, error: sessErr } = await supabase
          .from('customer_sessions')
          .select('id, created_at, customer_phone_number, current_question_id')
          .eq('chatbot_id', chatbotId)
          .gte('created_at', since)
          .order('created_at', { ascending: true })

        if (sessErr) throw sessErr

        const rows = sessions ?? []
        const todayStart = startOfDay(new Date()).toISOString()
        const weekStart = subDays(new Date(), 7).toISOString()

        // ── KPI stats ──────────────────────────────────────────────────────────
        const totalConversations = rows.length
        const conversationsToday = rows.filter(r => (r.created_at ?? '') >= todayStart).length
        const conversationsThisWeek = rows.filter(r => (r.created_at ?? '') >= weekStart).length
        const uniqueCustomers = new Set(rows.map(r => r.customer_phone_number)).size

        // ── Daily chart — last 30 days ────────────────────────────────────────
        const last30: DailyCount[] = []
        for (let i = 29; i >= 0; i--) {
          last30.push({ date: format(subDays(new Date(), i), 'dd MMM'), conversations: 0 })
        }
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
        rows
          .filter(r => (r.created_at ?? '') >= thirtyDaysAgo)
          .forEach(r => {
            const label = format(parseISO(r.created_at!), 'dd MMM')
            const slot = last30.find(d => d.date === label)
            if (slot) slot.conversations++
          })

        // ── Peak hours ────────────────────────────────────────────────────────
        const hourMap: Record<number, number> = {}
        rows.forEach(r => {
          const h = getHours(parseISO(r.created_at!))
          hourMap[h] = (hourMap[h] ?? 0) + 1
        })
        const peakHours: HourCount[] = Array.from({ length: 24 }, (_, h) => ({
          hour: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
          count: hourMap[h] ?? 0,
        }))

        // ── Top nodes (most-visited qa_pairs) ────────────────────────────────
        const nodeIds = rows.map(r => r.current_question_id).filter(Boolean) as string[]
        const nodeCountMap: Record<string, number> = {}
        nodeIds.forEach(id => { nodeCountMap[id] = (nodeCountMap[id] ?? 0) + 1 })

        let topNodes: NodeStat[] = []
        const uniqueNodeIds = Object.keys(nodeCountMap)
        if (uniqueNodeIds.length > 0) {
          const { data: qaPairs } = await supabase
            .from('qa_pairs')
            .select('id, question_text')
            .in('id', uniqueNodeIds.slice(0, 20))
          const labelMap: Record<string, string> = {}
          ;(qaPairs ?? []).forEach(q => { labelMap[q.id] = q.question_text })
          topNodes = Object.entries(nodeCountMap)
            .map(([id, count]) => ({ label: labelMap[id] ?? 'Unknown', count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        }

        setData({ totalConversations, conversationsToday, conversationsThisWeek, uniqueCustomers, daily: last30, peakHours, topNodes })
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [chatbotId])

  return { ...data, loading, error }
}
