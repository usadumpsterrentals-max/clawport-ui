'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Plus, RefreshCw } from 'lucide-react'
import type { Reminder, ReminderStatus } from '@/lib/types'
import { ReminderCard } from '@/components/reminders/ReminderCard'
import { Skeleton } from '@/components/ui/skeleton'

type Tab = 'upcoming' | 'fired' | 'dismissed' | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'fired', label: 'Fired' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
]

function filterReminders(reminders: Reminder[], tab: Tab): Reminder[] {
  switch (tab) {
    case 'upcoming':
      return reminders.filter(r => r.status === 'pending' || r.status === 'snoozed')
    case 'fired':
      return reminders.filter(r => r.status === 'fired')
    case 'dismissed':
      return reminders.filter(r => r.status === 'dismissed')
    case 'all':
    default:
      return reminders
  }
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [tab, setTab] = useState<Tab>('upcoming')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(() => {
    setRefreshing(true)
    fetch('/api/reminders')
      .then(r => r.ok ? r.json() : [])
      .then((data: Reminder[]) => {
        setReminders(data)
        setLoading(false)
        setRefreshing(false)
      })
      .catch(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleDismiss = useCallback((id: string) => {
    fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' as ReminderStatus }),
    }).then(() => refresh())
  }, [refresh])

  const handleSnooze = useCallback((id: string, durationMs: number) => {
    fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snoozeDurationMs: durationMs }),
    }).then(() => refresh())
  }, [refresh])

  const handleDelete = useCallback((id: string) => {
    fetch(`/api/reminders/${id}`, { method: 'DELETE' }).then(() => refresh())
  }, [refresh])

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newDate || !newTime) return
    setCreating(true)
    const dueAt = new Date(`${newDate}T${newTime}`).getTime()
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        dueAt,
        agentId: 'system',
      }),
    })
    setNewTitle('')
    setNewDate('')
    setNewTime('')
    setNewDescription('')
    setShowCreate(false)
    setCreating(false)
    refresh()
  }, [newTitle, newDate, newTime, newDescription, refresh])

  const filtered = filterReminders(reminders, tab)
  const counts = {
    upcoming: reminders.filter(r => r.status === 'pending' || r.status === 'snoozed').length,
    fired: reminders.filter(r => r.status === 'fired').length,
    dismissed: reminders.filter(r => r.status === 'dismissed').length,
    all: reminders.length,
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-6)' }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-title1)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.5px',
              lineHeight: 'var(--leading-tight)',
            }}>
              Reminders
            </h1>
            {!loading && (
              <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {counts.upcoming} upcoming
                {counts.fired > 0 && <span style={{ color: 'var(--system-orange)' }}> &middot; {counts.fired} need attention</span>}
              </p>
            )}
          </div>
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="focus-ring"
              aria-label="Create reminder"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: '#000',
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-smooth)',
              }}
            >
              <Plus size={14} />
              New
            </button>
            <button
              onClick={refresh}
              className="focus-ring"
              aria-label="Refresh reminders"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center" style={{ padding: '0 var(--space-6) var(--space-3)', gap: 'var(--space-1)' }}>
          {TABS.map(t => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="focus-ring"
                style={{
                  padding: '6px 16px',
                  fontSize: 'var(--text-footnote)',
                  fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 200ms var(--ease-smooth)',
                  background: isActive ? 'var(--accent-fill)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--accent)' : 'var(--fill-quaternary)',
                  color: isActive ? '#000' : 'var(--text-tertiary)',
                  lineHeight: '16px',
                }}>
                  {counts[t.key]}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
        {/* Create form */}
        {showCreate && (
          <div
            className="animate-slide-down"
            style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div style={{ fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
              New Reminder
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="What to remember..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--separator)',
                  background: 'var(--fill-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-subheadline)',
                  outline: 'none',
                }}
              />
              <div className="flex items-center flex-wrap" style={{ gap: 'var(--space-2)' }}>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--separator)',
                    background: 'var(--fill-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-footnote)',
                    outline: 'none',
                  }}
                />
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--separator)',
                    background: 'var(--fill-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-footnote)',
                    outline: 'none',
                  }}
                />
              </div>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--separator)',
                  background: 'var(--fill-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-footnote)',
                  outline: 'none',
                }}
              />
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim() || !newDate || !newTime}
                  className="focus-ring"
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#000',
                    fontSize: 'var(--text-footnote)',
                    fontWeight: 'var(--weight-semibold)',
                    cursor: 'pointer',
                    opacity: creating || !newTitle.trim() || !newDate || !newTime ? 0.5 : 1,
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="btn-ghost focus-ring"
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-footnote)',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <Skeleton style={{ width: '60%', height: 16, marginBottom: 8 }} />
                <Skeleton style={{ width: '40%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ height: 300, color: 'var(--text-secondary)', gap: 'var(--space-2)' }}>
            <Bell size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
            <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)' }}>
              {tab === 'upcoming' ? 'No upcoming reminders' : `No ${tab} reminders`}
            </span>
            <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 360, lineHeight: 'var(--leading-relaxed)' }}>
              {tab === 'upcoming'
                ? 'Ask any agent to set a reminder, use the /remind command in chat, or create one manually above.'
                : 'Reminders will appear here as their status changes.'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filtered.map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onDismiss={handleDismiss}
                onSnooze={handleSnooze}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
