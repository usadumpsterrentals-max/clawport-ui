#!/bin/sh
echo "Starting OpenClaw Gateway Engine in the background..."
openclaw gateway &

echo "Starting Clawport UI Next.js Dashboard..."
npx next start -p 3000 -H 0.0.0.0
