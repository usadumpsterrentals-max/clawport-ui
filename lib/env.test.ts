import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gatewayBaseUrl, gatewayPort, requireEnv } from '@/lib/env'

describe('requireEnv', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the value when the environment variable is set', () => {
    vi.stubEnv('TEST_VAR', '/some/path')
    expect(requireEnv('TEST_VAR')).toBe('/some/path')
  })

  it('throws when the environment variable is missing', () => {
    delete process.env.TEST_MISSING_VAR
    expect(() => requireEnv('TEST_MISSING_VAR')).toThrow()
  })

  it('throws when the environment variable is an empty string', () => {
    vi.stubEnv('TEST_EMPTY_VAR', '')
    expect(() => requireEnv('TEST_EMPTY_VAR')).toThrow()
  })

  it('error message includes the variable name', () => {
    delete process.env.MY_SPECIAL_VAR
    expect(() => requireEnv('MY_SPECIAL_VAR')).toThrow('MY_SPECIAL_VAR')
  })

  it('error message mentions .env.example', () => {
    delete process.env.SOME_VAR
    expect(() => requireEnv('SOME_VAR')).toThrow('.env.example')
  })

  it('error message includes "Missing required environment variable"', () => {
    delete process.env.ANOTHER_VAR
    expect(() => requireEnv('ANOTHER_VAR')).toThrow(
      'Missing required environment variable: ANOTHER_VAR'
    )
  })
})

describe('gatewayBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.OPENCLAW_GATEWAY_PORT
    delete process.env.OPENCLAW_GATEWAY_BASE_URL
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to 127.0.0.1:18789/v1', () => {
    expect(gatewayPort()).toBe(18789)
    expect(gatewayBaseUrl()).toBe('http://127.0.0.1:18789/v1')
  })

  it('respects OPENCLAW_GATEWAY_PORT', () => {
    vi.stubEnv('OPENCLAW_GATEWAY_PORT', '19999')
    expect(gatewayBaseUrl()).toBe('http://127.0.0.1:19999/v1')
  })

  it('respects OPENCLAW_GATEWAY_BASE_URL with or without /v1', () => {
    vi.stubEnv('OPENCLAW_GATEWAY_BASE_URL', 'http://10.0.0.5:18789')
    expect(gatewayBaseUrl()).toBe('http://10.0.0.5:18789/v1')
    vi.stubEnv('OPENCLAW_GATEWAY_BASE_URL', 'http://10.0.0.5:18789/v1')
    expect(gatewayBaseUrl()).toBe('http://10.0.0.5:18789/v1')
  })
})
