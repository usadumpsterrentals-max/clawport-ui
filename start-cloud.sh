#!/bin/sh

# Log environment check
echo "=== Environment Check ==="
echo "ANTHROPIC_API_KEY set: $([ -n "$ANTHROPIC_API_KEY" ] && echo 'YES' || echo 'NO')"
echo "OPENAI_API_KEY set: $([ -n "$OPENAI_API_KEY" ] && echo 'YES' || echo 'NO')"
echo ""

echo "Starting OpenClaw Gateway Engine in the background..."
openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait a few seconds and check if it's still alive
sleep 5
if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo "Gateway started successfully (PID $GATEWAY_PID)"
  tail -5 /tmp/openclaw-gateway.log
else
  echo "WARNING: Gateway crashed on startup! Logs:"
  cat /tmp/openclaw-gateway.log
fi

echo ""
echo "Starting Clawport UI Next.js Dashboard..."
npx next start -p 3000 -H 0.0.0.0
