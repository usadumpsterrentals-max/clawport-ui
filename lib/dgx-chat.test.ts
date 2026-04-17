import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChatSystemPrompt,
  chatApiKey,
  chatBaseUrl,
  chatModel,
  dgxChatEnabled,
  dgxChatMaxTokens,
  extractChatDeltaText,
  isDgxTransientError,
  openclawCompletionModel,
} from '@/lib/dgx-chat'

describe('dgx-chat helpers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.DGX_CHAT_ENABLED
    delete process.env.DGX_CHAT_BASE_URL
    delete process.env.DGX_CHAT_MODEL
    delete process.env.DGX_CHAT_API_KEY
    delete process.env.DGX_CHAT_MAX_TOKENS
    delete process.env.DGX_SHOW_REASONING
    delete process.env.OPENCLAW_GATEWAY_PORT
    delete process.env.OPENCLAW_GATEWAY_TOKEN
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses gateway values when DGX mode is disabled', () => {
    vi.stubEnv('OPENCLAW_GATEWAY_PORT', '19999')
    vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', 'gateway-token')

    expect(dgxChatEnabled()).toBe(false)
    expect(chatBaseUrl()).toBe('http://127.0.0.1:19999/v1')
    expect(chatApiKey()).toBe('gateway-token')
    expect(chatModel('anthropic/claude-opus-4-6')).toBe('anthropic/claude-opus-4-6')
    expect(openclawCompletionModel('master-agent', 'anthropic/claude-opus-4-6')).toBe(
      'openclaw/master-agent'
    )
  })

  it('uses DGX values when DGX mode is enabled', () => {
    vi.stubEnv('DGX_CHAT_ENABLED', 'true')
    vi.stubEnv('DGX_CHAT_BASE_URL', 'http://192.168.5.73:8000/v1')
    vi.stubEnv('DGX_CHAT_MODEL', 'nvidia/nemotron-3-super-120b-a12b')
    vi.stubEnv('DGX_CHAT_API_KEY', 'not-needed')
    vi.stubEnv('DGX_CHAT_MAX_TOKENS', '2048')

    expect(dgxChatEnabled()).toBe(true)
    expect(chatBaseUrl()).toBe('http://192.168.5.73:8000/v1')
    expect(chatApiKey()).toBe('not-needed')
    expect(chatModel('anthropic/claude-opus-4-6')).toBe('nvidia/nemotron-3-super-120b-a12b')
    expect(openclawCompletionModel('any-agent', 'anthropic/claude-opus-4-6')).toBe(
      'nvidia/nemotron-3-super-120b-a12b'
    )
    expect(dgxChatMaxTokens()).toBe(2048)
  })

  it('appends evidence-first policy only in DGX mode', () => {
    const base = 'You are Jarvis.'

    expect(buildChatSystemPrompt(base)).toBe(base)

    vi.stubEnv('DGX_CHAT_ENABLED', '1')
    expect(buildChatSystemPrompt(base)).toContain(base)
    expect(buildChatSystemPrompt(base)).toContain('Evidence-first policy:')
  })

  it('can optionally surface reasoning chunks', () => {
    vi.stubEnv('DGX_CHAT_ENABLED', '1')

    expect(
      extractChatDeltaText({ content: 'Answer', reasoning_content: 'Thinking' })
    ).toBe('Answer')

    vi.stubEnv('DGX_SHOW_REASONING', 'true')
    expect(
      extractChatDeltaText({ content: 'Answer', reasoning_content: 'Thinking' })
    ).toBe('ThinkingAnswer')
  })

  it('detects transient DGX errors', () => {
    expect(isDgxTransientError(new Error('ServiceUnavailableError: 503'))).toBe(true)
    expect(isDgxTransientError(new Error('Connection refused'))).toBe(true)
    expect(isDgxTransientError(new Error('completely different error'))).toBe(false)
  })
})
