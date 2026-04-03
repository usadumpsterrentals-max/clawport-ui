import { NextResponse } from 'next/server'
import { getStephanyTrainingData } from '@/lib/stephany-training'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(getStephanyTrainingData())
  } catch {
    return NextResponse.json(
      {
        exists: false,
        path: null,
        context: '',
        updatedAt: null,
      },
      { status: 200 },
    )
  }
}
