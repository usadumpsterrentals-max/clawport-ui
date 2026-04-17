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
# WhatsApp session reset: ONLY triggered by a flag file.
# To force re-pairing, create /opt/openclaw-seed/.whatsapp-reset in the
# repo and redeploy. The flag is consumed (deleted) after reset.
# Normal redeploys preserve the existing WhatsApp session.
# -----------------------------------------------------------------------
WA_CREDS="$OPENCLAW_HOME/credentials/whatsapp/default/creds.json"
RESET_FLAG="$SEED_DIR/.whatsapp-reset"
if [ -f "$RESET_FLAG" ] && [ -f "$WA_CREDS" ]; then
  echo "=== WhatsApp Reset ==="
  echo "Reset flag detected -- clearing WhatsApp session for new QR pairing..."
  rm -rf "$OPENCLAW_HOME/credentials/whatsapp/default"
  mkdir -p "$OPENCLAW_HOME/credentials/whatsapp/default"
  echo "Old WhatsApp session cleared."
fi

echo ""

# -----------------------------------------------------------------------
# Gateway token for Next.js API routes (chat, TTS, transcribe).
# Coolify can set OPENCLAW_GATEWAY_TOKEN; if missing, read from seeded openclaw.json
# so production never runs with an empty Bearer token.
# -----------------------------------------------------------------------
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ] && [ -f "$OPENCLAW_HOME/openclaw.json" ]; then
  OPENCLAW_GATEWAY_TOKEN="$(node -e "
    try {
      const c = JSON.parse(require('fs').readFileSync('$OPENCLAW_HOME/openclaw.json', 'utf8'));
      const t = c.gateway && c.gateway.auth && c.gateway.auth.token;
      process.stdout.write(t ? String(t) : '');
    } catch (e) { process.stdout.write(''); }
  ")"
  export OPENCLAW_GATEWAY_TOKEN
  if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
    echo "=== OPENCLAW_GATEWAY_TOKEN set from openclaw.json (override with Coolify env if needed) ==="
  else
    echo "=== WARNING: No gateway token in openclaw.json — set OPENCLAW_GATEWAY_TOKEN in Coolify ==="
  fi
else
  echo "=== OPENCLAW_GATEWAY_TOKEN from environment ($( [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ] && echo 'set' || echo 'MISSING' )) ==="
fi

# Log environment check
echo "=== Environment Check ==="
echo "ANTHROPIC_API_KEY set: $([ -n "$ANTHROPIC_API_KEY" ] && echo 'YES' || echo 'NO')"
echo "OPENAI_API_KEY set: $([ -n "$OPENAI_API_KEY" ] && echo 'YES' || echo 'NO')"
echo ""

echo "Starting OpenClaw Gateway Engine in the background..."
openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait until gateway accepts HTTP so Next.js rewrites (/canvas, /__openclaw__) do not return 502.
GW_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
export GW_WAIT_PORT="$GW_PORT"
export GW_WAIT_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
echo "=== Waiting for gateway HTTP on 127.0.0.1:${GW_PORT} (up to 90s) ==="
node <<'WAIT_GATEWAY'
const http = require('http');
const port = parseInt(process.env.GW_WAIT_PORT || '18789', 10);
const token = process.env.GW_WAIT_TOKEN || '';
const maxAttempts = 90;
function probe() {
  return new Promise((resolve) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: '/v1/models',
      method: 'GET',
      timeout: 4000,
    };
    if (token) opts.headers = { Authorization: 'Bearer ' + token };
    const req = http.request(opts, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}
(async () => {
  for (let i = 0; i < maxAttempts; i++) {
    if (await probe()) {
      console.log('=== Gateway HTTP ready after ~' + (i + 1) + 's ===');
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error('=== WARNING: Gateway HTTP not ready after 90s — UI will start; check /tmp/openclaw-gateway.log ===');
  process.exit(0);
})();
WAIT_GATEWAY

sleep 5
if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo "Gateway started successfully (PID $GATEWAY_PID)"
  echo "=== Gateway Startup Log ==="
  cat /tmp/openclaw-gateway.log
  echo "=== End Gateway Log ==="
  echo ""
  echo "=== openclaw channels status ==="
  openclaw channels status 2>&1 || true
  echo ""
  echo "=== openclaw health (head) ==="
  openclaw health --verbose 2>&1 | head -80 || true
else
  echo "WARNING: Gateway crashed on startup! Logs:"
  cat /tmp/openclaw-gateway.log
fi

if [ -f "$WA_CREDS" ]; then
  echo ""
  echo "=== WhatsApp: Already paired (session exists) ==="
else
  echo ""
  echo "=== WhatsApp: NOT paired ==="
  echo "To pair: openclaw channels login --channel whatsapp"
fi

# ---------------------------------------------------------------------------
# Background watchdog: re-checks WhatsApp every 2 minutes.
# If disconnected but creds exist, nudges the gateway to reconnect.
# ---------------------------------------------------------------------------
(
  WA_CHECK_INTERVAL=120
  WA_CREDS_PATH="$OPENCLAW_HOME/credentials/whatsapp/default/creds.json"
  CONSECUTIVE_FAILURES=0
  MIN_FAILURES_BEFORE_KILL=4

  while true; do
    sleep "$WA_CHECK_INTERVAL"

    if ! kill -0 $GATEWAY_PID 2>/dev/null; then
      echo "[watchdog] Gateway process died — restarting..."
      openclaw gateway > /tmp/openclaw-gateway.log 2>&1 &
      GATEWAY_PID=$!
      sleep 20
      continue
    fi

    STATUS_OUT=$(openclaw channels status 2>&1 || true)

    if echo "$STATUS_OUT" | grep -q "connected"; then
      if [ "$CONSECUTIVE_FAILURES" -gt 0 ]; then
        echo "[watchdog] WhatsApp recovered (was down for $CONSECUTIVE_FAILURES checks)"
      fi
      CONSECUTIVE_FAILURES=0
      continue
    fi

    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    echo "[watchdog] WhatsApp NOT connected (attempt $CONSECUTIVE_FAILURES) — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "[watchdog] Status: $STATUS_OUT"

    if [ ! -f "$WA_CREDS_PATH" ]; then
      echo "[watchdog] No creds — pair manually: openclaw channels login --channel whatsapp"
      continue
    fi

    if [ "$CONSECUTIVE_FAILURES" -ge "$MIN_FAILURES_BEFORE_KILL" ]; then
      echo "[watchdog] Creds exist — $CONSECUTIVE_FAILURES consecutive failed checks — restarting gateway process..."
      kill -TERM $GATEWAY_PID 2>/dev/null || true
      sleep 5
    else
      echo "[watchdog] Waiting for sustained failure ($CONSECUTIVE_FAILURES/$MIN_FAILURES_BEFORE_KILL before gateway restart)."
    fi
  done
) &

echo ""
echo "Starting Clawport UI Next.js Dashboard..."
npx next start -p 4330 -H 0.0.0.0
