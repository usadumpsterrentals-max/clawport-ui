'use client'

import { useReminders } from '@/lib/useReminders'
import { ReminderToast } from './ReminderToast'

export function ReminderProvider() {
  const { firedReminders, dismissReminder, snoozeReminder, clearFired } = useReminders()

  return (
    <ReminderToast
      reminders={firedReminders}
      onDismiss={dismissReminder}
      onSnooze={snoozeReminder}
      onClearAll={clearFired}
    />
  )
}
