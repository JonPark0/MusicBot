#!/bin/bash

# Lavalink Server Manual Test Script
# Tests connectivity, version, and track search functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo
    echo "=================================================="
    print_status $BLUE "$1"
    echo "=================================================="
}

print_success() {
    print_status $GREEN "✅ $1"
}

print_error() {
    print_status $RED "❌ $1"
}

print_warning() {
    print_status $YELLOW "⚠️  $1"
}

print_info() {
    print_status $BLUE "ℹ️  $1"
}

# Read configuration from config.json
CONFIG_FILE="config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Config file not found: $CONFIG_FILE"
    exit 1
fi

# Extract values using jq if available, otherwise use grep/sed
if command -v jq &> /dev/null; then
    HOST=$(jq -r '.lavalink.host' "$CONFIG_FILE")
    PORT=$(jq -r '.lavalink.port' "$CONFIG_FILE")
    PASSWORD=$(jq -r '.lavalink.password' "$CONFIG_FILE")
    NAME=$(jq -r '.lavalink.name' "$CONFIG_FILE")
else
    print_warning "jq not found, using fallback parsing method"
    HOST=$(grep -o '"host": *"[^"]*"' "$CONFIG_FILE" | sed 's/"host": *"\([^"]*\)"/\1/')
    PORT=$(grep -o '"port": *[0-9]*' "$CONFIG_FILE" | sed 's/"port": *//')
    PASSWORD=$(grep -o '"password": *"[^"]*"' "$CONFIG_FILE" | sed 's/"password": *"\([^"]*\)"/\1/')
    NAME=$(grep -o '"name": *"[^"]*"' "$CONFIG_FILE" | sed 's/"name": *"\([^"]*\)"/\1/')
fi

# Validate extracted values
if [ -z "$HOST" ] || [ -z "$PORT" ] || [ -z "$PASSWORD" ]; then
    print_error "Failed to parse configuration from $CONFIG_FILE"
    exit 1
fi

BASE_URL="http://${HOST}:${PORT}"

print_header "Lavalink Server Test Script"
print_info "Server: $HOST:$PORT"
print_info "Node Name: $NAME"
print_info "Authorization: ${PASSWORD:0:10}..."
echo

# Test 1: Basic connectivity
print_header "Test 1: Server Connectivity"
print_info "Testing basic HTTP connectivity..."

if curl -s --connect-timeout 5 --max-time 10 "$BASE_URL" > /dev/null 2>&1; then
    print_success "Server is reachable"
else
    print_error "Server is not reachable"
    print_info "Possible issues:"
    print_info "  - Server is down"
    print_info "  - Network connectivity issues"
    print_info "  - Firewall blocking connection"
    exit 1
fi

# Test 2: Version information
print_header "Test 2: Server Version"
print_info "Fetching server version information..."

VERSION_RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 5 --max-time 10 \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/version" 2>/dev/null || echo "000")

HTTP_CODE="${VERSION_RESPONSE: -3}"
VERSION_DATA="${VERSION_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Version endpoint accessible"
    print_info "Server Version: $VERSION_DATA"
else
    print_error "Version endpoint failed (HTTP $HTTP_CODE)"
    if [ "$HTTP_CODE" = "401" ]; then
        print_info "Authentication failed - check password"
    elif [ "$HTTP_CODE" = "404" ]; then
        print_info "Endpoint not found - may be older Lavalink version"
    fi
fi

# Test 3: Node info
print_header "Test 3: Node Information"
print_info "Fetching node information..."

INFO_RESPONSE=$(curl -s -w "%{http_code}" --connect-timeout 5 --max-time 10 \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/v4/info" 2>/dev/null || echo "000")

HTTP_CODE="${INFO_RESPONSE: -3}"
INFO_DATA="${INFO_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Node info endpoint accessible"
    
    # Try to parse some info if jq is available
    if command -v jq &> /dev/null && echo "$INFO_DATA" | jq . > /dev/null 2>&1; then
        print_info "Node Information:"
        echo "$INFO_DATA" | jq -r '
        "  Version: " + (.version // "Unknown"),
        "  Build Time: " + (.buildTime // "Unknown"),
        "  JVM Version: " + (.jvm // "Unknown"),
        "  Lavaplayer Version: " + (.lavaplayer // "Unknown"),
        "  Enabled Sources: " + ((.sourceManagers // []) | join(", "))
        ' 2>/dev/null || print_info "Raw response: $INFO_DATA"
    else
        print_info "Raw node info: $INFO_DATA"
    fi
else
    print_warning "Node info endpoint failed (HTTP $HTTP_CODE)"
    print_info "Trying legacy endpoint..."
    
    # Try legacy endpoint
    LEGACY_RESPONSE=$(curl -s -w "%{http_code}" \
        -H "Authorization: $PASSWORD" \
        "$BASE_URL/info" 2>/dev/null || echo "000")
    
    LEGACY_HTTP_CODE="${LEGACY_RESPONSE: -3}"
    LEGACY_DATA="${LEGACY_RESPONSE%???}"
    
    if [ "$LEGACY_HTTP_CODE" = "200" ]; then
        print_success "Legacy info endpoint accessible"
        print_info "Legacy node info: $LEGACY_DATA"
    else
        print_error "Both info endpoints failed"
    fi
fi

# Test 4: Track search
print_header "Test 4: Track Search Test"
print_info "Testing track search functionality..."

# Test different search queries
TEST_QUERIES=(
    "https://youtu.be/dQw4w9WgXcQ"
    "ytsearch:Never Gonna Give You Up"
    "Never Gonna Give You Up"
)

for query in "${TEST_QUERIES[@]}"; do
    print_info "Testing query: $query"
    
    # URL encode the query
    ENCODED_QUERY=$(printf '%s' "$query" | od -An -tx1 | tr ' ' % | tr -d '\n' | sed 's/%/%25/g; s/ /%20/g; s/:/%3A/g; s/\//%2F/g; s/?/%3F/g; s/=/%3D/g; s/&/%26/g')
    
    SEARCH_RESPONSE=$(curl -s -w "%{http_code}" \
        -H "Authorization: $PASSWORD" \
        "$BASE_URL/v4/loadtracks?identifier=$ENCODED_QUERY" 2>/dev/null || echo "000")
    
    HTTP_CODE="${SEARCH_RESPONSE: -3}"
    SEARCH_DATA="${SEARCH_RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Search successful (HTTP 200)"
        
        # Parse response if jq is available
        if command -v jq &> /dev/null && echo "$SEARCH_DATA" | jq . > /dev/null 2>&1; then
            LOAD_TYPE=$(echo "$SEARCH_DATA" | jq -r '.loadType // "unknown"')
            
            case "$LOAD_TYPE" in
                "track")
                    TITLE=$(echo "$SEARCH_DATA" | jq -r '.data.info.title // "Unknown"')
                    print_success "Found single track: $TITLE"
                    ;;
                "search")
                    TRACK_COUNT=$(echo "$SEARCH_DATA" | jq -r '.data | length')
                    print_success "Found $TRACK_COUNT search results"
                    ;;
                "playlist")
                    PLAYLIST_NAME=$(echo "$SEARCH_DATA" | jq -r '.data.info.name // "Unknown"')
                    TRACK_COUNT=$(echo "$SEARCH_DATA" | jq -r '.data.tracks | length')
                    print_success "Found playlist: $PLAYLIST_NAME ($TRACK_COUNT tracks)"
                    ;;
                "empty")
                    print_warning "No results found for query"
                    ;;
                "error")
                    ERROR_MSG=$(echo "$SEARCH_DATA" | jq -r '.data.message // "Unknown error"')
                    print_error "Search error: $ERROR_MSG"
                    ;;
                *)
                    print_warning "Unknown load type: $LOAD_TYPE"
                    ;;
            esac
        else
            print_info "Raw search response (first 100 chars): ${SEARCH_DATA:0:100}..."
        fi
        
        # Found working query, break the loop
        print_success "Track search is working!"
        break
    else
        print_error "Search failed (HTTP $HTTP_CODE)"
        if [ "$HTTP_CODE" = "400" ]; then
            print_info "Bad request - query format may be invalid"
        elif [ "$HTTP_CODE" = "500" ]; then
            print_info "Server error - Lavalink may have issues with this source"
        fi
    fi
done

# Test 5: WebSocket info (if available)
print_header "Test 5: Statistics"
print_info "Fetching server statistics..."

STATS_RESPONSE=$(curl -s -w "%{http_code}" \
    -H "Authorization: $PASSWORD" \
    "$BASE_URL/v4/stats" 2>/dev/null || echo "000")

HTTP_CODE="${STATS_RESPONSE: -3}"
STATS_DATA="${STATS_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Statistics endpoint accessible"
    
    if command -v jq &> /dev/null && echo "$STATS_DATA" | jq . > /dev/null 2>&1; then
        print_info "Server Statistics:"
        echo "$STATS_DATA" | jq -r '
        "  Players: " + (.players // 0 | tostring),
        "  Playing Players: " + (.playingPlayers // 0 | tostring),
        "  Uptime: " + ((.uptime // 0) / 1000 | floor | tostring) + " seconds",
        "  Memory Used: " + ((.memory.used // 0) / 1024 / 1024 | floor | tostring) + " MB",
        "  Memory Allocated: " + ((.memory.allocated // 0) / 1024 / 1024 | floor | tostring) + " MB",
        "  CPU Cores: " + (.cpu.cores // 0 | tostring),
        "  System Load: " + ((.cpu.systemLoad // 0) * 100 | floor | tostring) + "%"
        ' 2>/dev/null || print_info "Raw stats: $STATS_DATA"
    else
        print_info "Raw statistics: $STATS_DATA"
    fi
else
    print_warning "Statistics endpoint failed (HTTP $HTTP_CODE)"
fi

# Summary
print_header "Test Summary"

if [ "$VERSION_RESPONSE" ] && [[ "$VERSION_RESPONSE" == *"200" ]]; then
    print_success "Server is online and responding"
else
    print_error "Server connectivity issues detected"
fi

print_info "Test completed at $(date)"
print_info "Use this script to quickly verify Lavalink server status"

echo
print_info "💡 Tips:"
print_info "  - Run this script before starting the bot"
print_info "  - Use it for troubleshooting connection issues"
print_info "  - Check server status during maintenance"
print_info "  - Install 'jq' for better JSON parsing: sudo apt install jq"

echo