#!/bin/sh
# Run inside the production container when WhatsApp/agents look offline.
# Does not restart the container; prints state and next steps.
set +e
echo "=== channels status (add --probe for deeper checks if supported) ==="
openclaw channels status 2>&1
echo ""
echo "=== gateway status ==="
openclaw gateway status 2>&1
echo ""
echo "If WhatsApp shows 401 / disconnected / not linked:"
echo "  1. Ensure ONLY this app uses the phone (scale duplicate Coolify apps to 0; no local Mac gateway on same number)."
echo "  2. openclaw channels logout --channel whatsapp"
echo "  3. Restart this container from Coolify (not 'openclaw gateway restart' — it fails without systemd)."
echo "  4. openclaw channels login --channel whatsapp  && scan QR"
echo "  5. If linked but still stopped: Coolify → Restart container again."
