#!/bin/sh
echo "Starting OpenClaw Gateway Engine in the background..."
openclaw gateway &

echo "Starting Clawport UI Next.js Dashboard..."
npm start
