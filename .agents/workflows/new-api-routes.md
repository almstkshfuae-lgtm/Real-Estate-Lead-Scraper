---
description: new-api-routes
---

1 File location
app/api/<resource>/route.ts           # GET list, POST create
app/api/<resource>/[id]/route.ts      # GET one, PATCH, DELETE
app/api/<resource>/<action>/route.ts  # specific action
8.2 Standard template
typescriptimport { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role.toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const param = searchParams.get('param') || '';

    const data = await prisma.model.findMany({ where: {} });
    return NextResponse.json({ data }, { status: 200 });

  } catch (error: any) {
    console.error('[RouteName Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: error?.message },
      { status: 500 }
    );
  }
}
8.3 Auth rules

Every route reading/writing user data must check session.
Role comparison: always .toUpperCase() — DB stores mixed case.
Agents see only their own records: add agentId: session.id to where unless role is ADMIN.

8.4 Streaming route (AI / SSE)
typescriptexport async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: 'text' })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
Never use NextResponse.json() on a streaming endpoint.
8.5 AI model strings — exact values currently in codebase
typescript// Pitch generation (/api/ai/pitch) and chat (/api/ai/chat):
model: "claude-sonnet-4-5"

// Score refinement (/api/ai/score) and signal extraction (/api/ai/signals):
model: "claude-haiku-4-5"
Do not change these without explicit instruction.
8.6 Test the route
bash# Must return 401 without auth:
curl -X GET http://localhost:3000/api/<route> -v

# Must return data with auth:
curl -X GET http://localhost:3000/api/<route> -H "Cookie: auth_token=<token>" -v

# POST:
curl -X POST http://localhost:3000/api/<route> \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<token>" \
  -d '{"field": "value"}' -v
Verify: correct status codes, correct shape, auth works, malformed input returns 400 not 500.