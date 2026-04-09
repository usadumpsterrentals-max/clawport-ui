#!/bin/sh

SEED_DIR="/opt/openclaw-seed"
OPENCLAW_HOME="/root/.openclaw"

# -----------------------------------------------------------------------
# Seed the persistent volume from the build-time snapshot.
#   - First run (empty volume): copy everything from the seed.
#   - Subsequent runs: only refresh openclaw.json so config changes
#     from the repo propagate, but never overwrite runtime data
#     (sessions, memory, cron runs, conversations, etc.).
# -----------------------------------------------------------------------
echo "=== OpenClaw Data Seeding ==="

if [ ! -f "$OPENCLAW_HOME/openclaw.json" ]; then
  echo "First run detected -- seeding full config into persistent volume..."
  cp -a "$SEED_DIR/." "$OPENCLAW_HOME/"
  echo "Seed complete."
else
  echo "Existing data found -- refreshing openclaw.json from image..."
  cp -f "$SEED_DIR/openclaw.json" "$OPENCLAW_HOME/openclaw.json"

  # Seed any new agent directories that don't exist yet in the volume
  if [ -d "$SEED_DIR/agents" ]; then
    for agent_dir in "$SEED_DIR/agents"/*/; do
      agent_name=$(basename "$agent_dir")
      if [ ! -d "$OPENCLAW_HOME/agents/$agent_name" ]; then
        echo "  Seeding new agent: $agent_name"
        cp -a "$agent_dir" "$OPENCLAW_HOME/agents/$agent_name"
      fi
    done
  fi

  # Seed any new workspace directories
  for ws_dir in "$SEED_DIR"/*_workspace/; do
    [ -d "$ws_dir" ] || continue
    ws_name=$(basename "$ws_dir")
    if [ ! -d "$OPENCLAW_HOME/$ws_name" ]; then
      echo "  Seeding new workspace: $ws_name"
      cp -a "$ws_dir" "$OPENCLAW_HOME/$ws_name"
    fi
  done

  echo "Config refresh complete."
fi

# -----------------------------------------------------------------------
# WhatsApp session reset: if the seed has no creds.json, clear the old
# session from the volume so the gateway generates a fresh QR code.
# -----------------------------------------------------------------------
WA_CREDS="$OPENCLAW_HOME/credentials/whatsapp/default/creds.json"
WA_SEED_CREDS="$SEED_DIR/credentials/whatsapp/default/creds.json"
if [ ! -f "$WA_SEED_CREDS" ] && [ -f "$WA_CREDS" ]; then
  echo "=== WhatsApp Reset ==="
  echo "No WhatsApp credentials in image seed -- clearing old session for new QR pairing..."
  rm -rf "$OPENCLAW_HOME/credentials/whatsapp/default"
  mkdir -p "$OPENCLAW_HOME/credentials/whatsapp/default"
  echo "Old WhatsApp session cleared. A new QR code will be generated on gateway startup."
fi

echo ""

# Log environment check
echo "=== Environment Check ==="
echo "ANTHROPIC_API_KEY set: $([ -n "$ANTHROPIC_API_KEY" ] && echo 'YES' || echo 'NO')"
echo "OPENAI_API_KEY set: $([ -n "$OPENAI_API_KEY" ] && echo 'YES' || echo 'NO')"
echo ""

echo "Starting OpenClaw Gateway Engine in the background..."
openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait longer on first WhatsApp pairing so the QR code has time to appear
if [ ! -f "$WA_CREDS" ]; then
  echo "Waiting for WhatsApp QR code (check container logs in Coolify)..."
  sleep 15
else
  sleep 5
fi

if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo "Gateway started successfully (PID $GATEWAY_PID)"
  echo "=== Gateway Startup Log ==="
  cat /tmp/openclaw-gateway.log
  echo "=== End Gateway Log ==="
else
  echo "WARNING: Gateway crashed on startup! Logs:"
  cat /tmp/openclaw-gateway.log
fi

echo ""
echo "Starting Clawport UI Next.js Dashboard..."
npx next start -p 4330 -H 0.0.0.0
