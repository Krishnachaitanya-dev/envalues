import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export const AVAILABLE_TAGS = ['VIP', 'Follow-up', 'Interested', 'Blocked'] as const
export type Tag = typeof AVAILABLE_TAGS[number]

export type Contact = {
  id: string
  phone: string
  first_seen_at: string
  last_active_at: string
  last_active_ago: string
  total_messages: number
  notes: string | null
  tags: string[]
}

export function useContactsData(chatbotId: string | null) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')

  const load = useCallback(async () => {
    if (!chatbotId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, first_seen_at, last_active_at, total_messages, notes, tags')
        .eq('chatbot_id', chatbotId)
        .order('last_active_at', { ascending: false })
      if (error) throw error
      setContacts((data ?? []).map(c => ({
        ...c,
        last_active_ago: formatDistanceToNow(new Date(c.last_active_at), { addSuffix: true }),
      })))
    } catch (e) {
      console.error('Failed to load contacts:', e)
    } finally {
      setLoading(false)
    }
  }, [chatbotId])

  useEffect(() => { load() }, [load])

  // ── Save notes ───────────────────────────────────────────────────────────
  const saveNotes = useCallback(async (contactId: string, notes: string): Promise<boolean> => {
    setSaving(true)
    try {
      const { error } = await supabase.from('contacts').update({ notes }).eq('id', contactId)
      if (error) throw error
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes } : c))
      return true
    } catch (e) {
      console.error('Failed to save notes:', e)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  // ── Toggle tag ───────────────────────────────────────────────────────────
  const toggleTag = useCallback(async (contactId: string, tag: string): Promise<boolean> => {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return false
    const newTags = contact.tags.includes(tag)
      ? contact.tags.filter(t => t !== tag)
      : [...contact.tags, tag]
    try {
      const { error } = await supabase.from('contacts').update({ tags: newTags }).eq('id', contactId)
      if (error) throw error
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, tags: newTags } : c))
      return true
    } catch (e) {
      console.error('Failed to toggle tag:', e)
      return false
    }
  }, [contacts])

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const rows = [
      ['Phone', 'First Seen', 'Last Active', 'Total Messages', 'Tags', 'Notes'],
      ...contacts.map(c => [
        c.phone,
        new Date(c.first_seen_at).toLocaleDateString('en-IN'),
        new Date(c.last_active_at).toLocaleDateString('en-IN'),
        c.total_messages.toString(),
        c.tags.join('; '),
        (c.notes ?? '').replace(/,/g, ' '),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [contacts])

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    const matchSearch = !search.trim() || c.phone.includes(search.trim())
    const matchTag = selectedTag === 'all' || c.tags.includes(selectedTag)
    return matchSearch && matchTag
  })

  return {
    contacts: filtered,
    totalContacts: contacts.length,
    loading, saving, search, setSearch, selectedTag, setSelectedTag,
    saveNotes, toggleTag, exportCSV, refresh: load,
  }
}
