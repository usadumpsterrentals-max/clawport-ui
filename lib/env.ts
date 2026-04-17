/**
 * Safely retrieve a required environment variable at runtime.
 * Call inside functions (not at module top level) so imports don't crash during build/test.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for configuration.`
    )
  }
  return value
}

/** OpenClaw gateway port — reads OPENCLAW_GATEWAY_PORT, defaults to 18789. */
export function gatewayPort(): number {
  return parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)
}

/**
 * OpenClaw gateway base URL for the OpenAI-compatible API (e.g. http://localhost:18789/v1).
 * Set OPENCLAW_GATEWAY_BASE_URL for non-localhost gateways (rare); must end with /v1 or be the origin only.
 */
export function gatewayBaseUrl(): string {
  const override = process.env.OPENCLAW_GATEWAY_BASE_URL?.trim()
  if (override) {
    const base = override.replace(/\/$/, '')
    return base.endsWith('/v1') ? base : `${base}/v1`
  }
  return `http://127.0.0.1:${gatewayPort()}/v1`
}
