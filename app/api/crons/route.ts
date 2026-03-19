import { getCrons } from '@/lib/crons'
import { loadPipelines } from '@/lib/cron-pipelines.server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const crons = await getCrons()
    const pipelines = loadPipelines()
    return NextResponse.json({ crons, pipelines })
  } catch {
    // OpenClaw CLI not ready yet (e.g. fresh container, gateway starting).
    // Return empty data so the UI loads gracefully rather than showing 500.
    return NextResponse.json({ crons: [], pipelines: [] })
  }
}
