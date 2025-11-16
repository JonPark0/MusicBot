#!/bin/bash

# Docker entrypoint script for Saori Discord Music Bot
# Handles graceful shutdown with proper signal forwarding

set -e

# Function to handle shutdown signals
cleanup() {
    echo "Received shutdown signal, stopping bot gracefully..."
    
    # Send SIGTERM to the Python process
    if [[ -n "$BOT_PID" ]]; then
        kill -TERM "$BOT_PID" 2>/dev/null || true
        echo "Sent SIGTERM to bot process (PID: $BOT_PID)"
        
        # Wait for graceful shutdown with timeout
        local count=0
        local max_wait=30
        
        while kill -0 "$BOT_PID" 2>/dev/null && [[ $count -lt $max_wait ]]; do
            echo "Waiting for bot to shutdown... ($count/$max_wait)"
            sleep 1
            ((count++))
        done
        
        # Force kill if still running
        if kill -0 "$BOT_PID" 2>/dev/null; then
            echo "Bot didn't shutdown gracefully, force killing..."
            kill -KILL "$BOT_PID" 2>/dev/null || true
        else
            echo "Bot shutdown gracefully"
        fi
    fi
    
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT SIGHUP

echo "Starting Saori Discord Music Bot..."
    
# Check if requirements.txt exists and install dependencies
if [ -f requirements.txt ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
else
    echo "No requirements.txt found. Skipping dependency installation."
fi

# Start the bot in background and capture PID
python main.py &
BOT_PID=$!

echo "Bot started with PID: $BOT_PID"

# Wait for the bot process
wait "$BOT_PID"
BOT_EXIT_CODE=$?

echo "Bot process exited with code: $BOT_EXIT_CODE"
exit $BOT_EXIT_CODE