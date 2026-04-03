'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Reminder } from '@/lib/types'

const POLL_INTERVAL = 30_000

interface DueResponse {
  fired: Reminder[]
  due: Reminder[]
  upcomingCount: number
}

export interface UseRemindersResult {
  firedReminders: Reminder[]
  upcomingCount: number
  dismissReminder: (id: string) => void
  snoozeReminder: (id: string, durationMs: number) => void
  clearFired: () => void
}

export function useReminders(): UseRemindersResult {
  const [firedReminders, setFiredReminders] = useState<Reminder[]>([])
  const [upcomingCount, setUpcomingCount] = useState(0)
  const seenIds = useRef(new Set<string>())

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders/due')
      if (!res.ok) return
      const data: DueResponse = await res.json()

      const newFired = data.fired.filter(r => !seenIds.current.has(r.id))
      if (newFired.length > 0) {
        for (const r of newFired) seenIds.current.add(r.id)
        setFiredReminders(prev => [...prev, ...newFired])
      }

      setUpcomingCount(data.upcomingCount)
    } catch {
      // Polling failure is non-fatal
    }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [poll])

  const dismissReminder = useCallback(async (id: string) => {
    setFiredReminders(prev => prev.filter(r => r.id !== id))
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
    } catch {
      // Best-effort
    }
  }, [])

  const snoozeReminder = useCallback(async (id: string, durationMs: number) => {
    setFiredReminders(prev => prev.filter(r => r.id !== id))
    seenIds.current.delete(id)
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozeDurationMs: durationMs }),
      })
    } catch {
      // Best-effort
    }
  }, [])

  const clearFired = useCallback(() => {
    setFiredReminders([])
  }, [])

  return { firedReminders, upcomingCount, dismissReminder, snoozeReminder, clearFired }
}
