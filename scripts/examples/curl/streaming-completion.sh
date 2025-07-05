#!/bin/bash

# Streaming Completion cURL Example
# Demonstrates Server-Sent Events (SSE) streaming chat completion
# Based on Python streaming examples with TypeScript server enhancements

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${CLAUDE_WRAPPER_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"
VERBOSE="${VERBOSE:-false}"
SHOW_RAW="${SHOW_RAW:-false}"

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_stream() {
    echo -e "${CYAN}$1${NC}"
}

# Check if server is running
check_server() {
    print_info "Checking server status at $BASE_URL..."
    
    if ! curl -s --max-time 5 "$BASE_URL/health" > /dev/null 2>&1; then
        print_error "Server is not running at $BASE_URL"
        print_info "Please start the claude-wrapper server first:"
        print_info "  cd claude-wrapper && npm start"
        exit 1
    fi
    
    print_success "Server is running"
}

# Detect authentication requirements
detect_auth() {
    print_info "Detecting authentication requirements..."
    
    AUTH_STATUS=$(curl -s "$BASE_URL/v1/auth/status" 2>/dev/null || echo '{}')
    API_KEY_REQUIRED=$(echo "$AUTH_STATUS" | jq -r '.server_info.api_key_required // false' 2>/dev/null || echo 'false')
    
    if [ "$VERBOSE" = "true" ]; then
        print_info "Authentication status: $AUTH_STATUS"
    fi
    
    if [ "$API_KEY_REQUIRED" = "true" ]; then
        if [ -z "$API_KEY" ]; then
            print_error "API key is required but not provided"
            print_info "Set the API_KEY environment variable:"
            print_info "  export API_KEY=your-api-key-here"
            print_info "  $0"
            exit 1
        fi
        AUTH_HEADER="-H \"Authorization: Bearer $API_KEY\""
        print_success "Using API key authentication"
    else
        AUTH_HEADER=""
        print_success "No authentication required"
    fi
}

# Process streaming response
process_stream() {
    local line="$1"
    
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*$ ]]; then
        return
    fi
    
    # Handle SSE format
    if [[ "$line" == data:* ]]; then
        local data="${line#data: }"
        
        # Handle end of stream
        if [[ "$data" == "[DONE]" ]]; then
            echo
            print_success "Stream completed"
            return
        fi
        
        # Show raw data if requested
        if [ "$SHOW_RAW" = "true" ]; then
            print_info "Raw: $data"
        fi
        
        # Parse JSON and extract content
        local content=$(echo "$data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
        if [[ -n "$content" && "$content" != "null" ]]; then
            # Print content without newline to create streaming effect
            print_stream "$content"
        fi
        
        # Check for errors in the stream
        local error_msg=$(echo "$data" | jq -r '.error.message // empty' 2>/dev/null)
        if [[ -n "$error_msg" && "$error_msg" != "null" ]]; then
            echo
            print_error "Stream error: $error_msg"
            exit 1
        fi
    fi
}

# Make streaming completion request
make_streaming_request() {
    print_info "Making streaming completion request..."
    
    REQUEST_PAYLOAD='{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {
                "role": "user",
                "content": "Write a short story about a TypeScript developer who discovers their code can communicate with AI. Keep it under 200 words and make it engaging."
            }
        ],
        "max_tokens": 250,
        "temperature": 0.8,
        "stream": true
    }'
    
    if [ "$VERBOSE" = "true" ]; then
        print_info "Request payload:"
        echo "$REQUEST_PAYLOAD" | jq .
    fi
    
    print_info "Streaming from $BASE_URL/v1/chat/completions..."
    echo
    print_success "📖 Claude's Story (streaming):"
    echo "----------------------------------------"
    
    # Create a temporary file for the response
    TEMP_FILE=$(mktemp)
    trap "rm -f $TEMP_FILE" EXIT
    
    # Make the streaming request
    eval "curl -s --no-buffer -X POST \"$BASE_URL/v1/chat/completions\" \\
        -H \"Content-Type: application/json\" \\
        -H \"Accept: text/event-stream\" \\
        $AUTH_HEADER \\
        -d '$REQUEST_PAYLOAD'" > "$TEMP_FILE" &
    
    CURL_PID=$!
    
    # Process the stream in real-time
    tail -f "$TEMP_FILE" 2>/dev/null | while IFS= read -r line; do
        process_stream "$line"
        
        # Check if curl process is still running
        if ! kill -0 $CURL_PID 2>/dev/null; then
            break
        fi
    done
    
    # Wait for curl to complete
    wait $CURL_PID
    CURL_EXIT_CODE=$?
    
    echo
    echo "----------------------------------------"
    
    if [ $CURL_EXIT_CODE -eq 0 ]; then
        print_success "Streaming request completed successfully"
    else
        print_error "Streaming request failed with exit code $CURL_EXIT_CODE"
        
        # Show error response if available
        if [ -s "$TEMP_FILE" ]; then
            print_info "Error response:"
            cat "$TEMP_FILE"
        fi
        exit 1
    fi
}

# Display example information
show_example_info() {
    echo
    print_info "🎯 Streaming Completion Example"
    echo "This example demonstrates:"
    echo "  • Server-Sent Events (SSE) streaming"
    echo "  • Real-time response processing"
    echo "  • Stream parsing and content extraction"
    echo "  • Error handling in streaming context"
    echo
    print_info "Server: $BASE_URL"
    print_info "Authentication: $([ "$API_KEY_REQUIRED" = "true" ] && echo "Required" || echo "Not required")"
    print_info "Show raw data: $SHOW_RAW"
    echo
}

# Main execution
main() {
    show_example_info
    check_server
    detect_auth
    make_streaming_request
    
    echo
    print_success "✅ Streaming completion example completed successfully!"
    echo
    print_info "Next steps:"
    print_info "  • Try session management: ./scripts/examples/curl/session-management.sh"
    print_info "  • Explore authentication: ./scripts/examples/curl/authentication-examples.sh"
    print_info "  • View TypeScript examples: ./scripts/examples/typescript/"
    print_info "  • View all examples: ./scripts/examples/README.md"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  -h, --help     Show this help message"
        echo "  -v, --verbose  Enable verbose output"
        echo "  -r, --raw      Show raw stream data"
        echo
        echo "Environment variables:"
        echo "  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000)"
        echo "  API_KEY            API key for authentication (if required)"
        echo "  VERBOSE           Enable verbose output (true/false)"
        echo "  SHOW_RAW          Show raw stream data (true/false)"
        echo
        echo "Examples:"
        echo "  $0                                    # Basic streaming"
        echo "  $0 --verbose                          # Verbose output"
        echo "  $0 --raw                              # Show raw data"
        echo "  SHOW_RAW=true $0                      # Show raw via env"
        echo "  API_KEY=your-key $0                   # With API key"
        exit 0
        ;;
    -v|--verbose)
        VERBOSE=true
        ;;
    -r|--raw)
        SHOW_RAW=true
        ;;
esac

# Ensure required tools are available
for tool in curl jq mktemp tail; do
    if ! command -v "$tool" &> /dev/null; then
        print_error "$tool is required but not installed"
        case "$tool" in
            jq)
                print_info "Install jq: https://stedolan.github.io/jq/download/"
                ;;
            *)
                print_info "Please install $tool"
                ;;
        esac
        exit 1
    fi
done

# Run main function
main