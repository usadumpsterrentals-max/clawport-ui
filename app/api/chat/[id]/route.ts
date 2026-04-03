export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getAgent } from '@/lib/agents'
import { validateChatMessages } from '@/lib/validation'
import { hasImageContent, extractImageAttachments, buildTextPrompt, sendViaOpenClaw } from '@/lib/anthropic'
import {
  buildChatSystemPrompt,
  chatApiKey,
  chatBaseUrl,
  chatModel,
  dgxChatEnabled,
  dgxChatMaxTokens,
  dgxUnavailableMessage,
  extractChatDeltaText,
  isDgxTransientError,
} from '@/lib/dgx-chat'
import { extractAndCreateReminder } from '@/lib/reminder-extraction'
import OpenAI from 'openai'

const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || ''

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const result = validateChatMessages(body)
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages } = result

  const rawBody = body as Record<string, unknown>
  const operatorName = typeof rawBody.operatorName === 'string' ? rawBody.operatorName : 'Operator'

  const reminderCapability = `\n\nYou can set reminders for ${operatorName}. When they ask you to remind them about something (e.g. "remind me I have a meeting at 9:30 AM tomorrow with Melissa"), acknowledge it naturally and confirm the time. The reminder is automatically saved by the system. Just confirm it conversationally.`

  const baseSystemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are speaking directly with ${operatorName}, your operator. Stay fully in character. Be concise — this is a live chat. 2-4 sentences unless detail is asked for. No em dashes.${reminderCapability}`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.${reminderCapability}`
  const systemPrompt = buildChatSystemPrompt(baseSystemPrompt)

  // Fire-and-forget: extract reminder intent from the latest user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMsg?.content) {
    const textContent = typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
    if (textContent) extractAndCreateReminder(textContent, id).catch(() => {})
  }

  // When the LATEST user message contains images, use the OpenClaw gateway's
  // chat.send pipeline. Only check the last message — older messages with images
  // should not force all future messages through this path.
  const latestHasImages = lastUserMsg ? hasImageContent([lastUserMsg]) : false

  if (latestHasImages && GATEWAY_TOKEN) {
    const attachments = extractImageAttachments([lastUserMsg!])
    const textPrompt = buildTextPrompt(systemPrompt, messages)

    const response = await sendViaOpenClaw({
      gatewayToken: GATEWAY_TOKEN,
      message: textPrompt,
      attachments,
    })

    // Return as a non-streaming SSE response (complete text at once)
    const encoder = new TextEncoder()
    const content = response || 'I had trouble processing that image. Could you try again or describe what you see?'
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  try {
    const openai = new OpenAI({
      baseURL: chatBaseUrl(),
      apiKey: chatApiKey(),
    })

    const stream = await openai.chat.completions.create({
      model: chatModel(agent.model),
      stream: true,
      ...(dgxChatEnabled()
        ? {
            temperature: 0.2,
            max_tokens: dgxChatMaxTokens(),
            chat_template_kwargs: { enable_thinking: true },
          }
        : {}),
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ] as OpenAI.ChatCompletionMessageParam[],
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const content = extractChatDeltaText(chunk.choices[0]?.delta || {})
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: unknown) {
    console.error('Chat API error:', err)

    let userMessage = 'Chat failed. Make sure OpenClaw gateway is running.'
    if (dgxChatEnabled() && isDgxTransientError(err)) {
      userMessage = dgxUnavailableMessage()
    }
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 405) {
      userMessage = 'Gateway returned 405. Enable the HTTP endpoint: set gateway.http.endpoints.chatCompletions.enabled = true in ~/.openclaw/openclaw.json, then restart the gateway.'
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
