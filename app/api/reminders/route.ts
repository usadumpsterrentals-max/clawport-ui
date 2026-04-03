import { NextResponse } from 'next/server'
import { getReminders, createReminder } from '@/lib/reminders-store'
import type { Reminder } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const reminders = getReminders()
    return NextResponse.json(reminders)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId, title, description, dueAt, recurrence, deliveryChannel } = body as Partial<Reminder>

    if (!title || !dueAt) {
      return NextResponse.json(
        { error: 'title and dueAt are required' },
        { status: 400 },
      )
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      agentId: agentId || 'system',
      title,
      description: description ?? null,
      dueAt: typeof dueAt === 'string' ? new Date(dueAt).getTime() : dueAt,
      createdAt: Date.now(),
      status: 'pending',
      recurrence: recurrence ?? null,
      snoozedUntil: null,
      deliveryChannel: deliveryChannel ?? 'ui',
    }

    const created = createReminder(reminder)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create reminder' },
      { status: 500 },
    )
  }
}
