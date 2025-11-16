#!/bin/bash

# Lavalink Debug Script
# Provides detailed debugging information for connection issues

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${1}${2}${NC}"
}

# Read config
CONFIG_FILE="config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    print_status $RED "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

HOST=$(grep -o '"host": *"[^"]*"' "$CONFIG_FILE" | sed 's/"host": *"\([^"]*\)"/\1/')
PORT=$(grep -o '"port": *[0-9]*' "$CONFIG_FILE" | sed 's/"port": *//')
PASSWORD=$(grep -o '"password": *"[^"]*"' "$CONFIG_FILE" | sed 's/"password": *"\([^"]*\)"/\1/')

BASE_URL="http://${HOST}:${PORT}"

echo "🐛 Lavalink Debug Information"
echo "============================="
echo "Server: $HOST:$PORT"
echo "Base URL: $BASE_URL"
echo "Password: ${PASSWORD:0:10}..."
echo

# Test 1: Basic HTTP response
print_status $BLUE "📡 Testing basic HTTP response:"
echo "Command: curl -v --connect-timeout 5 --max-time 10 \"$BASE_URL\""
echo "Response:"
curl -v --connect-timeout 5 --max-time 10 "$BASE_URL" 2>&1 || echo "Failed"
echo

# Test 2: Test with headers
print_status $BLUE "🔐 Testing with authorization header:"
echo "Command: curl -v --connect-timeout 5 --max-time 10 -H \"Authorization: $PASSWORD\" \"$BASE_URL/version\""
echo "Response:"
curl -v --connect-timeout 5 --max-time 10 -H "Authorization: $PASSWORD" "$BASE_URL/version" 2>&1 || echo "Failed"
echo

# Test 3: Test different endpoints
print_status $BLUE "🎯 Testing various endpoints:"

ENDPOINTS=(
    ""
    "version"
    "info" 
    "v3/info"
    "v4/info"
    "stats"
    "v3/stats"
    "v4/stats"
)

for endpoint in "${ENDPOINTS[@]}"; do
    url="$BASE_URL"
    if [ -n "$endpoint" ]; then
        url="$BASE_URL/$endpoint"
    fi
    
    echo "Testing: $url"
    response=$(curl -s -w "HTTP_CODE:%{http_code}" --connect-timeout 3 --max-time 5 \
        -H "Authorization: $PASSWORD" \
        "$url" 2>/dev/null || echo "FAILED")
    
    if [[ "$response" == *"HTTP_CODE:"* ]]; then
        http_code="${response##*HTTP_CODE:}"
        body="${response%HTTP_CODE:*}"
        echo "  HTTP Code: $http_code"
        if [ ${#body} -gt 0 ]; then
            echo "  Body (first 100 chars): ${body:0:100}"
        fi
    else
        echo "  Failed: $response"
    fi
    echo
done

# Test 4: DNS resolution
print_status $BLUE "🌐 DNS Resolution:"
echo "Command: nslookup $HOST"
nslookup "$HOST" 2>&1 || echo "DNS lookup failed"
echo

# Test 5: Port connectivity
print_status $BLUE "🔌 Port Connectivity:"
echo "Command: nc -zv $HOST $PORT"
if command -v nc >/dev/null 2>&1; then
    timeout 5 nc -zv "$HOST" "$PORT" 2>&1 || echo "Port test failed"
else
    echo "netcat not available, using telnet test"
    echo "Command: timeout 5 telnet $HOST $PORT"
    (echo | timeout 5 telnet "$HOST" "$PORT" 2>&1) || echo "Telnet test failed"
fi
echo

# Test 6: Ping test
print_status $BLUE "🏓 Ping Test:"
echo "Command: ping -c 3 $HOST"
ping -c 3 "$HOST" 2>&1 || echo "Ping failed"
echo

# Test 7: Trace route (first 5 hops only)
print_status $BLUE "🗺️  Network Route (first 5 hops):"
echo "Command: traceroute -m 5 $HOST"
if command -v traceroute >/dev/null 2>&1; then
    timeout 15 traceroute -m 5 "$HOST" 2>&1 || echo "Traceroute failed"
else
    echo "traceroute not available"
fi
echo

echo "🔍 Debug Information Complete"
echo "=============================="
print_status $YELLOW "💡 Common Issues:"
echo "  1. Server may be down or restarting"
echo "  2. Firewall blocking connections"
echo "  3. Wrong password/authentication"
echo "  4. Server overloaded (504 errors)"
echo "  5. Network connectivity issues"
echo
print_status $BLUE "🛠️  Troubleshooting Steps:"
echo "  1. Check if server is online at provider"
echo "  2. Verify password is correct"
echo "  3. Try different endpoints (/info vs /v4/info)"
echo "  4. Check firewall settings"
echo "  5. Contact server administrator"