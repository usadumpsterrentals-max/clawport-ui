import { gatewayBaseUrl } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Health check for Coolify / load balancers.
 * - Default: liveness only (Next.js running).
 * - ?probe=gateway: also verify OpenClaw gateway HTTP (returns 503 if unreachable).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('probe') === 'gateway') {
    const base = gatewayBaseUrl().replace(/\/v1\/?$/, '')
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || ''
    try {
      const res = await fetch(`${base}/v1/models`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        return Response.json(
          { ok: false, gateway: 'error', status: res.status },
          { status: 503 }
        )
      }
      return Response.json({
        ok: true,
        service: 'clawport-ui',
        gateway: 'reachable',
        timestamp: new Date().toISOString(),
      })
    } catch {
      return Response.json(
        { ok: false, gateway: 'unreachable', hint: 'Is openclaw gateway running on 127.0.0.1:18789?' },
        { status: 503 }
      )
    }
  }

  return Response.json({
    ok: true,
    service: 'clawport-ui',
    timestamp: new Date().toISOString(),
  })
}
