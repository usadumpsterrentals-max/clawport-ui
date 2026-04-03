import { NextResponse } from 'next/server'
import { fireReminders, getDueReminders, getUpcomingReminders } from '@/lib/reminders-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const fired = fireReminders()
    const stillDue = getDueReminders()
    const upcoming = getUpcomingReminders()

    return NextResponse.json({
      fired,
      due: stillDue,
      upcomingCount: upcoming.length,
    })
  } catch {
    return NextResponse.json({ fired: [], due: [], upcomingCount: 0 })
  }
}
