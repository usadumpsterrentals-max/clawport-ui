import { NextResponse } from 'next/server'
import { updateReminder, deleteReminder, snoozeReminder, getReminderById } from '@/lib/reminders-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const reminder = getReminderById(id)
  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
  }
  return NextResponse.json(reminder)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { status, snoozeDurationMs, title, description, dueAt } = body as {
      status?: string
      snoozeDurationMs?: number
      title?: string
      description?: string
      dueAt?: number
    }

    if (snoozeDurationMs && snoozeDurationMs > 0) {
      const result = snoozeReminder(id, snoozeDurationMs)
      if (!result) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
      return NextResponse.json(result)
    }

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (dueAt !== undefined) updates.dueAt = dueAt

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const result = updateReminder(id, updates)
    if (!result) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update reminder' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = deleteReminder(id)
  if (!deleted) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
