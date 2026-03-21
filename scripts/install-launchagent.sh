#!/bin/bash
# Install ClawCommand LaunchAgent for auto-start on Mac Mini

echo "🚀 Installing ClawCommand LaunchAgent..."

# Create LaunchAgent plist
PLIST_PATH="$HOME/Library/LaunchAgents/com.hexalabs.clawcommand.plist"

sudo tee "$PLIST_PATH" > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.hexalabs.clawcommand</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Volumes/disco1tb/projects/clawcommand/scripts/resume-and-start.sh</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Volumes/disco1tb/projects/clawcommand</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/var/log/clawcommand.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/clawcommand-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>CLAWCOMMAND_HOME</key>
        <string>/Volumes/disco1tb/projects/clawcommand</string>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>30</integer>
</dict>
</plist>
EOF

# Create resume script
RESUME_SCRIPT="/Volumes/disco1tb/projects/clawcommand/scripts/resume-and-start.sh"

sudo tee "$RESUME_SCRIPT" > /dev/null << 'EOF'
#!/bin/bash
# Resume ClawCommand after reboot

echo "🔄 ClawCommand Resume Script"
echo "Timestamp: $(date)"
echo "Hostname: $(hostname)"
echo ""

cd /Volumes/disco1tb/projects/clawcommand

# Check if there's state to recover
if [ -f "state/latest.json" ]; then
    echo "📂 Found previous state, will perform auto-recovery"
fi

# Start ClawCommand
echo "🚀 Starting ClawCommand..."
npm start
EOF

chmod +x "$RESUME_SCRIPT"

# Load the LaunchAgent
launchctl load "$PLIST_PATH"

echo "✅ LaunchAgent installed successfully!"
echo ""
echo "Details:"
echo "  Plist: $PLIST_PATH"
echo "  Logs:  /var/log/clawcommand.log"
echo "  Start: launchctl start com.hexalabs.clawcommand"
echo "  Stop:  launchctl stop com.hexalabs.clawcommand"
echo ""
echo "ClawCommand will now auto-start on boot! 🎉"