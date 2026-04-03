import { gatewayBaseUrl } from './env'

const DEFAULT_DGX_CHAT_BASE_URL = 'http://192.168.5.73:8000/v1'
const DEFAULT_DGX_CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b'
const DEFAULT_DGX_CHAT_MAX_TOKENS = 1200

const EVIDENCE_FIRST_POLICY = `Evidence-first policy:
- Think carefully before answering and keep detailed reasoning enabled.
- For factual or current claims, state whether your answer is grounded in repo, doc, api, web, or reasoning-only evidence.
- If evidence is weak, missing, stale, or contradictory, say so explicitly and abstain rather than guessing.
- For coding tasks, inspect the available context first and reason about edge cases, null handling, type safety, and backwards compatibility before proposing changes.
- If the question depends on external information that is not present in the conversation, say what evidence is missing.`

export function dgxChatEnabled(): boolean {
  const raw = (process.env.DGX_CHAT_ENABLED || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function chatBaseUrl(): string {
  return dgxChatEnabled()
    ? process.env.DGX_CHAT_BASE_URL || DEFAULT_DGX_CHAT_BASE_URL
    : gatewayBaseUrl()
}

export function chatApiKey(): string {
  return dgxChatEnabled()
    ? process.env.DGX_CHAT_API_KEY || 'not-needed'
    : process.env.OPENCLAW_GATEWAY_TOKEN || ''
}

export function chatModel(defaultModel?: string | null): string {
  return dgxChatEnabled()
    ? process.env.DGX_CHAT_MODEL || DEFAULT_DGX_CHAT_MODEL
    : defaultModel || 'claude-sonnet-4-6'
}

export function dgxChatMaxTokens(): number {
  const raw = parseInt(process.env.DGX_CHAT_MAX_TOKENS || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DGX_CHAT_MAX_TOKENS
}

export function buildChatSystemPrompt(basePrompt: string): string {
  if (!dgxChatEnabled()) return basePrompt
  return `${basePrompt}\n\n${EVIDENCE_FIRST_POLICY}`
}

export function extractChatDeltaText(delta: { content?: string | null; reasoning_content?: string | null }): string {
  const content = delta.content || ''
  if (!dgxChatEnabled()) return content

  const showReasoning = (process.env.DGX_SHOW_REASONING || '').trim().toLowerCase()
  if (showReasoning === '1' || showReasoning === 'true' || showReasoning === 'yes') {
    return `${delta.reasoning_content || ''}${content}`
  }

  return content
}

export function dgxUnavailableMessage(): string {
  return 'Local DGX model is reloading after a runtime restart. Try again in a few minutes.'
}

export function isDgxTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '')
  return [
    'ServiceUnavailableError',
    'EngineDeadError',
    'Internal server error',
    'service is unhealthy',
    'Connection refused',
    'ECONNREFUSED',
    '503',
  ].some(fragment => message.includes(fragment))
}
