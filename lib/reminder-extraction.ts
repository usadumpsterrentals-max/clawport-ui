import OpenAI from 'openai'
import { chatBaseUrl, chatApiKey, chatModel } from '@/lib/dgx-chat'
import { createReminder } from '@/lib/reminders-store'
import type { Reminder } from '@/lib/types'

const EXTRACTION_PROMPT = `You are a reminder extraction tool. Your ONLY job is to detect if the user's message asks to be reminded about something, or to schedule a reminder/event.

Current date and time: {NOW}

If the message contains a reminder request, return ONLY valid JSON:
{"isReminder":true,"title":"short description","dueAt":"ISO 8601 datetime","description":"optional extra context or null"}

Examples of reminder requests:
- "remind me I have a meeting at 9:30 am tomorrow with Melissa" -> extract it
- "set a reminder for Friday at 2pm to review the quarterly report" -> extract it
- "don't let me forget to call John next Monday at 10am" -> extract it
- "schedule a meeting reminder for April 15 at 3pm" -> extract it

If the message is NOT a reminder request, return ONLY:
{"isReminder":false}

Return ONLY the JSON object, no markdown, no explanation.`

interface ExtractionResult {
  isReminder: boolean
  title?: string
  dueAt?: string
  description?: string | null
}

/**
 * Analyze a user message for reminder intent via a lightweight LLM call.
 * Runs as a non-streaming request concurrently with the main chat stream.
 * Returns the created Reminder or null if no reminder was detected.
 */
export async function extractAndCreateReminder(
  userMessage: string,
  agentId: string,
): Promise<Reminder | null> {
  try {
    const openai = new OpenAI({
      baseURL: chatBaseUrl(),
      apiKey: chatApiKey(),
    })

    const now = new Date().toISOString()
    const systemPrompt = EXTRACTION_PROMPT.replace('{NOW}', now)

    const response = await openai.chat.completions.create({
      model: chatModel(),
      stream: false,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) return null

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    let parsed: ExtractionResult
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return null
    }

    if (!parsed.isReminder || !parsed.title || !parsed.dueAt) return null

    const dueAtMs = new Date(parsed.dueAt).getTime()
    if (isNaN(dueAtMs)) return null

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      agentId,
      title: parsed.title,
      description: parsed.description ?? null,
      dueAt: dueAtMs,
      createdAt: Date.now(),
      status: 'pending',
      recurrence: null,
      snoozedUntil: null,
      deliveryChannel: 'ui',
    }

    return createReminder(reminder)
  } catch (err) {
    console.error('Reminder extraction failed (non-fatal):', err)
    return null
  }
}
