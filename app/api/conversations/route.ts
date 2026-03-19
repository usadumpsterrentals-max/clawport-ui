import { listAgentIds } from '@/lib/conversation-store'
import { apiErrorResponse } from '@/lib/api-error'
export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const ids = listAgentIds()
    return Response.json(ids)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to list conversations')
  }
}
