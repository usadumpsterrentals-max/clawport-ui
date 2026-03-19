import { getAgents } from '@/lib/agents'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const agents = await getAgents()
    return NextResponse.json(agents)
  } catch {
    // Gracefully return empty list if workspace/registry is not ready
    return NextResponse.json([])
  }
}
