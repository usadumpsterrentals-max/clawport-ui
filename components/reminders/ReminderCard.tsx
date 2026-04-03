'use client'

import { useState } from 'react'
import { Clock, Trash2, BellOff, AlarmClock, Check } from 'lucide-react'
import type { Reminder } from '@/lib/types'

interface ReminderCardProps {
  reminder: Reminder
  onDismiss: (id: string) => void
  onSnooze: (id: string, durationMs: number) => void
  onDelete: (id: string) => void
}

const SNOOZE_OPTIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
]

function formatDue(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (d.toDateString() === now.toDateString()) return `Today at ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`
}

function relativeTime(ts: number): string {
  const diff = ts - Date.now()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0

  if (absDiff < 60 * 1000) return isPast ? 'just now' : 'in less than a minute'

  const minutes = Math.floor(absDiff / (60 * 1000))
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`

  const days = Math.floor(hours / 24)
  return isPast ? `${days}d ago` : `in ${days}d`
}

export function ReminderCard({ reminder, onDismiss, onSnooze, onDelete }: ReminderCardProps) {
  const [showSnooze, setShowSnooze] = useState(false)
  const isPast = reminder.dueAt <= Date.now()
  const isFired = reminder.status === 'fired'
  const isDismissed = reminder.status === 'dismissed'

  const borderColor = isDismissed
    ? 'var(--text-tertiary)'
    : isFired
      ? 'var(--system-orange)'
      : isPast
        ? 'var(--system-red)'
        : 'var(--system-green)'

  return (
    <div
      style={{
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        opacity: isDismissed ? 0.6 : 1,
        transition: 'opacity 200ms var(--ease-smooth)',
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {reminder.title}
          </div>
          {reminder.description && (
            <div
              style={{
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {reminder.description}
            </div>
          )}
          <div
            className="flex items-center"
            style={{ gap: 'var(--space-2)', fontSize: 'var(--text-caption1)' }}
          >
            <Clock size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ color: isPast ? 'var(--system-orange)' : 'var(--text-tertiary)' }}>
              {formatDue(reminder.dueAt)}
            </span>
            <span style={{ color: 'var(--text-quaternary)' }}>&middot;</span>
            <span style={{ color: 'var(--text-tertiary)' }}>{relativeTime(reminder.dueAt)}</span>
            {reminder.agentId && reminder.agentId !== 'system' && (
              <>
                <span style={{ color: 'var(--text-quaternary)' }}>&middot;</span>
                <span style={{ color: 'var(--accent)' }}>via {reminder.agentId}</span>
              </>
            )}
          </div>
        </div>

        {!isDismissed && (
          <div className="flex items-center" style={{ gap: 'var(--space-1)', flexShrink: 0 }}>
            {(isFired || isPast) && (
              <button
                onClick={() => onDismiss(reminder.id)}
                className="btn-ghost focus-ring"
                aria-label="Dismiss reminder"
                title="Dismiss"
                style={{
                  padding: 'var(--space-1)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} style={{ color: 'var(--system-green)' }} />
              </button>
            )}
            <button
              onClick={() => setShowSnooze(!showSnooze)}
              className="btn-ghost focus-ring"
              aria-label="Snooze reminder"
              title="Snooze"
              style={{
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlarmClock size={14} style={{ color: 'var(--text-tertiary)' }} />
            </button>
            <button
              onClick={() => onDelete(reminder.id)}
              className="btn-ghost focus-ring"
              aria-label="Delete reminder"
              title="Delete"
              style={{
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={14} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        )}

        {isDismissed && (
          <div className="flex items-center" style={{ gap: 'var(--space-1)', flexShrink: 0 }}>
            <BellOff size={14} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)' }}>Dismissed</span>
          </div>
        )}
      </div>

      {showSnooze && (
        <div
          className="animate-slide-down flex items-center flex-wrap"
          style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--separator)',
            gap: 'var(--space-2)',
          }}
        >
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginRight: 'var(--space-1)' }}>
            Snooze for:
          </span>
          {SNOOZE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => { onSnooze(reminder.id, opt.ms); setShowSnooze(false) }}
              className="focus-ring"
              style={{
                padding: '4px 12px',
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-medium)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--fill-secondary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-smooth)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
