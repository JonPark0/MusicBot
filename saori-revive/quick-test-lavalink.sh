#!/bin/bash

# Quick Lavalink Server Test
# Fast connectivity and basic functionality check

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

# Parse config (simple method)
HOST=$(grep -o '"host": *"[^"]*"' "$CONFIG_FILE" | sed 's/"host": *"\([^"]*\)"/\1/')
PORT=$(grep -o '"port": *[0-9]*' "$CONFIG_FILE" | sed 's/"port": *//')
PASSWORD=$(grep -o '"password": *"[^"]*"' "$CONFIG_FILE" | sed 's/"password": *"\([^"]*\)"/\1/')

BASE_URL="http://${HOST}:${PORT}"

echo "🔍 Quick Lavalink Test: $HOST:$PORT"
echo "=================================="

# Test 1: Basic connectivity (2 second timeout)
printf "Connectivity... "
if curl -s --connect-timeout 2 --max-time 3 "$BASE_URL" > /dev/null 2>&1; then
    print_status $GREEN "✅ Online"
else
    print_status $RED "❌ Offline"
    exit 1
fi

# Test 2: Version check (3 second timeout)
printf "Version check... "
VERSION_RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 2 --max-time 3 \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/version" 2>/dev/null || echo "000")

HTTP_CODE="${VERSION_RESPONSE: -3}"
if [ "$HTTP_CODE" = "200" ]; then
    VERSION="${VERSION_RESPONSE%???}"
    print_status $GREEN "✅ $VERSION"
else
    print_status $YELLOW "⚠️  HTTP $HTTP_CODE"
fi

# Test 3: Quick search test (5 second timeout)
printf "Search test... "
SEARCH_RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 2 --max-time 5 \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/v4/loadtracks?identifier=https://youtu.be/dQw4w9WgXcQ" 2>/dev/null || echo "000")

SEARCH_HTTP_CODE="${SEARCH_RESPONSE: -3}"
if [ "$SEARCH_HTTP_CODE" = "200" ]; then
    # Simple check for successful response
    if echo "${SEARCH_RESPONSE%???}" | grep -q '"loadType"'; then
        print_status $GREEN "✅ Working"
    else
        print_status $YELLOW "⚠️  Unexpected response"
    fi
else
    print_status $YELLOW "⚠️  HTTP $SEARCH_HTTP_CODE"
fi

# Test 4: Stats check (3 second timeout)
printf "Stats check... "
STATS_RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 2 --max-time 3 \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/v4/stats" 2>/dev/null || echo "000")

STATS_HTTP_CODE="${STATS_RESPONSE: -3}"
if [ "$STATS_HTTP_CODE" = "200" ]; then
    print_status $GREEN "✅ Available"
else
    print_status $YELLOW "⚠️  HTTP $STATS_HTTP_CODE"
fi

echo "=================================="
if [ "$HTTP_CODE" = "200" ] && [ "$SEARCH_HTTP_CODE" = "200" ]; then
    print_status $GREEN "🎉 Lavalink server is ready!"
elif [ "$HTTP_CODE" = "200" ]; then
    print_status $YELLOW "⚠️  Server online but some features may have issues"
else
    print_status $RED "❌ Server has connectivity issues"
fi

echo
echo "💡 Run './test-lavalink.sh' for detailed testing"