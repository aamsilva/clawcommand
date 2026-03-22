#!/bin/bash
# ClawCommand Auto-Resume Script
# Executed by LaunchAgent on boot

echo "🔄 ClawCommand Auto-Resume"
echo "Timestamp: $(date)"
echo "Host: $(hostname)"
echo ""

cd /Volumes/disco1tb/projects/clawcommand

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi

# Check if dependencies installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check for previous state
if [ -f "state/latest.json" ]; then
    echo "📂 Previous state found, will perform auto-recovery"
fi

# Start ClawCommand
echo "🚀 Starting ClawCommand..."
exec node index.js

# Keep running (LaunchAgent will restart if it crashes)
while true; do
    sleep 60
    # Health check could go here
    if ! pgrep -f "clawcommand" > /dev/null; then
        echo "⚠️  Process not found, restarting..."
        exec node index.js
    fi
done