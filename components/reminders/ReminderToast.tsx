'use client'

import { useState } from 'react'
import { Bell, X, AlarmClock, Check } from 'lucide-react'
import type { Reminder } from '@/lib/types'

interface ReminderToastProps {
  reminders: Reminder[]
  onDismiss: (id: string) => void
  onSnooze: (id: string, durationMs: number) => void
  onClearAll: () => void
}

const SNOOZE_OPTIONS = [
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
]

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function ReminderToast({ reminders, onDismiss, onSnooze, onClearAll }: ReminderToastProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (reminders.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-4)',
        right: 'var(--space-4)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxWidth: 380,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {reminders.slice(0, 5).map(r => (
        <div
          key={r.id}
          className="animate-slide-down"
          style={{
            background: 'var(--material-thick)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid var(--separator)',
            borderLeft: '3px solid var(--system-orange)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'var(--shadow-overlay)',
            pointerEvents: 'auto',
          }}
        >
          <div className="flex items-start" style={{ gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,149,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Bell size={14} style={{ color: 'var(--system-orange)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                lineHeight: 'var(--leading-tight)',
              }}>
                {r.title}
              </div>
              {r.description && (
                <div style={{
                  fontSize: 'var(--text-caption1)',
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                  lineHeight: 'var(--leading-snug)',
                }}>
                  {r.description}
                </div>
              )}
              <div style={{
                fontSize: 'var(--text-caption2)',
                color: 'var(--text-tertiary)',
                marginTop: 4,
              }}>
                {formatTime(r.dueAt)}
                {r.agentId && r.agentId !== 'system' && ` \u00b7 via ${r.agentId}`}
              </div>
            </div>
            <button
              onClick={() => onDismiss(r.id)}
              className="btn-ghost focus-ring"
              aria-label="Dismiss"
              style={{
                padding: 2,
                borderRadius: 'var(--radius-sm)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>

          {/* Action bar */}
          <div className="flex items-center" style={{ marginTop: 'var(--space-2)', gap: 'var(--space-2)' }}>
            <button
              onClick={() => onDismiss(r.id)}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'rgba(52,199,89,0.12)',
                color: 'var(--system-green)',
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
            >
              <Check size={12} /> Done
            </button>
            <button
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--fill-secondary)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-caption1)',
                fontWeight: 'var(--weight-medium)',
                cursor: 'pointer',
              }}
            >
              <AlarmClock size={12} /> Snooze
            </button>
          </div>

          {expandedId === r.id && (
            <div className="flex items-center flex-wrap animate-slide-down" style={{ marginTop: 'var(--space-2)', gap: 'var(--space-1)' }}>
              {SNOOZE_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { onSnooze(r.id, opt.ms); setExpandedId(null) }}
                  className="focus-ring"
                  style={{
                    padding: '2px 10px',
                    fontSize: 'var(--text-caption2)',
                    fontWeight: 'var(--weight-medium)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--fill-tertiary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {reminders.length > 1 && (
        <button
          onClick={onClearAll}
          className="focus-ring"
          style={{
            alignSelf: 'flex-end',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--material-thick)',
            backdropFilter: 'blur(20px)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-caption1)',
            fontWeight: 'var(--weight-medium)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          Dismiss all
        </button>
      )}
    </div>
  )
}
