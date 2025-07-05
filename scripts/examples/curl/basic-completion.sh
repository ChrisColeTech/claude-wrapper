#!/bin/bash

# Basic Completion cURL Example
# Demonstrates basic chat completion with authentication auto-detection
# Based on Python curl_example.sh with TypeScript server enhancements

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${CLAUDE_WRAPPER_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"
VERBOSE="${VERBOSE:-false}"

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

# Make basic completion request
make_completion_request() {
    print_info "Making basic completion request..."
    
    REQUEST_PAYLOAD='{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {
                "role": "user",
                "content": "Hello! Can you explain what a TypeScript wrapper is in simple terms?"
            }
        ],
        "max_tokens": 150,
        "temperature": 0.7
    }'
    
    if [ "$VERBOSE" = "true" ]; then
        print_info "Request payload:"
        echo "$REQUEST_PAYLOAD" | jq .
    fi
    
    print_info "Sending request to $BASE_URL/v1/chat/completions..."
    
    # Use eval to properly handle the auth header
    RESPONSE=$(eval "curl -s -X POST \"$BASE_URL/v1/chat/completions\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER \\
        -d '$REQUEST_PAYLOAD'")
    
    if [ $? -eq 0 ]; then
        print_success "Request completed successfully"
        
        # Check if response contains an error
        ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MESSAGE" ]; then
            print_error "API Error: $ERROR_MESSAGE"
            if [ "$VERBOSE" = "true" ]; then
                echo "$RESPONSE" | jq .
            fi
            exit 1
        fi
        
        # Extract and display the response
        CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
        if [ -n "$CONTENT" ]; then
            print_success "Response received:"
            echo
            echo "📝 Claude's Response:"
            echo "----------------------------------------"
            echo "$CONTENT"
            echo "----------------------------------------"
            echo
            
            # Display usage information if available
            USAGE=$(echo "$RESPONSE" | jq -r '.usage // empty' 2>/dev/null)
            if [ -n "$USAGE" ] && [ "$USAGE" != "null" ]; then
                print_info "Token usage:"
                echo "$USAGE" | jq .
            fi
        else
            print_warning "No content found in response"
            if [ "$VERBOSE" = "true" ]; then
                echo "$RESPONSE" | jq .
            fi
        fi
    else
        print_error "Request failed"
        exit 1
    fi
}

# Display example information
show_example_info() {
    echo
    print_info "🎯 Basic Completion Example"
    echo "This example demonstrates:"
    echo "  • Basic chat completion requests"
    echo "  • Automatic authentication detection"
    echo "  • Error handling and validation"
    echo "  • Response parsing and display"
    echo
    print_info "Server: $BASE_URL"
    print_info "Authentication: $([ "$API_KEY_REQUIRED" = "true" ] && echo "Required" || echo "Not required")"
    echo
}

# Main execution
main() {
    show_example_info
    check_server
    detect_auth
    make_completion_request
    
    print_success "✅ Basic completion example completed successfully!"
    echo
    print_info "Next steps:"
    print_info "  • Try the streaming example: ./scripts/examples/curl/streaming-completion.sh"
    print_info "  • Explore session management: ./scripts/examples/curl/session-management.sh"
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
        echo
        echo "Environment variables:"
        echo "  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000)"
        echo "  API_KEY            API key for authentication (if required)"
        echo "  VERBOSE           Enable verbose output (true/false)"
        echo
        echo "Examples:"
        echo "  $0                                    # Basic usage"
        echo "  VERBOSE=true $0                       # Verbose output"
        echo "  API_KEY=your-key $0                   # With API key"
        echo "  CLAUDE_WRAPPER_URL=http://localhost:3000 $0  # Custom URL"
        exit 0
        ;;
    -v|--verbose)
        VERBOSE=true
        ;;
esac

# Ensure jq is available
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed"
    print_info "Install jq: https://stedolan.github.io/jq/download/"
    exit 1
fi

# Run main function
main