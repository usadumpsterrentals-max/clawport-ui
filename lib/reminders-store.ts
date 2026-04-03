import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'
import type { Reminder, ReminderStatus } from '@/lib/types'

function getRemindersDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'reminders')
}

function getRemindersFile(): string {
  return path.join(getRemindersDir(), 'reminders.json')
}

function readAll(): Reminder[] {
  const filePath = getRemindersFile()
  if (!existsSync(filePath)) return []
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeAll(reminders: Reminder[]): void {
  const dir = getRemindersDir()
  mkdirSync(dir, { recursive: true })
  writeFileSync(getRemindersFile(), JSON.stringify(reminders, null, 2), 'utf-8')
}

export function getReminders(): Reminder[] {
  return readAll().sort((a, b) => a.dueAt - b.dueAt)
}

export function getReminderById(id: string): Reminder | null {
  return readAll().find(r => r.id === id) ?? null
}

export function getDueReminders(): Reminder[] {
  const now = Date.now()
  return readAll()
    .filter(r => {
      const effectiveDue = r.status === 'snoozed' && r.snoozedUntil ? r.snoozedUntil : r.dueAt
      return r.status !== 'dismissed' && r.status !== 'fired' && effectiveDue <= now
    })
    .sort((a, b) => a.dueAt - b.dueAt)
}

export function getUpcomingReminders(): Reminder[] {
  const now = Date.now()
  return readAll()
    .filter(r => {
      if (r.status === 'dismissed' || r.status === 'fired') return false
      const effectiveDue = r.status === 'snoozed' && r.snoozedUntil ? r.snoozedUntil : r.dueAt
      return effectiveDue > now
    })
    .sort((a, b) => a.dueAt - b.dueAt)
}

export function createReminder(reminder: Reminder): Reminder {
  const all = readAll()
  all.push(reminder)
  writeAll(all)
  return reminder
}

export function updateReminder(id: string, updates: Partial<Pick<Reminder, 'status' | 'snoozedUntil' | 'title' | 'description' | 'dueAt'>>): Reminder | null {
  const all = readAll()
  const idx = all.findIndex(r => r.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...updates }
  writeAll(all)
  return all[idx]
}

export function deleteReminder(id: string): boolean {
  const all = readAll()
  const filtered = all.filter(r => r.id !== id)
  if (filtered.length === all.length) return false
  writeAll(filtered)
  return true
}

/** Mark all due pending/snoozed reminders as fired. Returns the fired reminders. */
export function fireReminders(): Reminder[] {
  const all = readAll()
  const now = Date.now()
  const fired: Reminder[] = []

  for (const r of all) {
    if (r.status === 'fired' || r.status === 'dismissed') continue
    const effectiveDue = r.status === 'snoozed' && r.snoozedUntil ? r.snoozedUntil : r.dueAt
    if (effectiveDue <= now) {
      r.status = 'fired'
      r.snoozedUntil = null
      fired.push(r)
    }
  }

  if (fired.length > 0) writeAll(all)
  return fired
}

export function snoozeReminder(id: string, durationMs: number): Reminder | null {
  return updateReminder(id, {
    status: 'snoozed' as ReminderStatus,
    snoozedUntil: Date.now() + durationMs,
  })
}
