#!/bin/bash

# Session Management cURL Example
# Demonstrates session creation, management, and continuity features
# Based on Python session management with TypeScript server enhancements

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${CLAUDE_WRAPPER_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"
VERBOSE="${VERBOSE:-false}"
SESSION_ID="${SESSION_ID:-demo-session-$(date +%s)}"
CLEANUP="${CLEANUP:-true}"

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

print_session() {
    echo -e "${PURPLE}[SESSION]${NC} $1"
}

print_response() {
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

# List current sessions
list_sessions() {
    print_session "Listing all active sessions..."
    
    RESPONSE=$(eval "curl -s -X GET \"$BASE_URL/v1/sessions\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER")
    
    if [ $? -eq 0 ]; then
        local session_count=$(echo "$RESPONSE" | jq -r '.sessions | length' 2>/dev/null || echo "0")
        print_success "Found $session_count active sessions"
        
        if [ "$session_count" -gt 0 ]; then
            echo "$RESPONSE" | jq -r '.sessions[] | "  • \(.session_id) (created: \(.created_at), messages: \(.message_count))"' 2>/dev/null || {
                print_warning "Could not parse session details"
                if [ "$VERBOSE" = "true" ]; then
                    echo "$RESPONSE"
                fi
            }
        fi
    else
        print_error "Failed to list sessions"
        return 1
    fi
}

# Get session statistics
get_session_stats() {
    print_session "Getting session statistics..."
    
    RESPONSE=$(eval "curl -s -X GET \"$BASE_URL/v1/sessions/stats\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER")
    
    if [ $? -eq 0 ]; then
        print_success "Session statistics retrieved"
        
        local total_sessions=$(echo "$RESPONSE" | jq -r '.total_sessions // 0' 2>/dev/null)
        local active_sessions=$(echo "$RESPONSE" | jq -r '.active_sessions // 0' 2>/dev/null)
        
        echo "  📊 Total sessions: $total_sessions"
        echo "  🔄 Active sessions: $active_sessions"
        
        if [ "$VERBOSE" = "true" ]; then
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
    else
        print_error "Failed to get session statistics"
        return 1
    fi
}

# Create a session by sending a message
create_session() {
    print_session "Creating session: $SESSION_ID"
    
    REQUEST_PAYLOAD='{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {
                "role": "user",
                "content": "Hello! I am starting a new conversation session. Please introduce yourself and explain what we can discuss together."
            }
        ],
        "max_tokens": 150,
        "temperature": 0.7,
        "session_id": "'$SESSION_ID'"
    }'
    
    if [ "$VERBOSE" = "true" ]; then
        print_info "Request payload:"
        echo "$REQUEST_PAYLOAD" | jq .
    fi
    
    print_info "Sending initial message to create session..."
    
    RESPONSE=$(eval "curl -s -X POST \"$BASE_URL/v1/chat/completions\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER \\
        -d '$REQUEST_PAYLOAD'")
    
    if [ $? -eq 0 ]; then
        # Check for errors
        ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MESSAGE" ]; then
            print_error "Session creation failed: $ERROR_MESSAGE"
            return 1
        fi
        
        print_success "Session created successfully"
        
        # Display response
        CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
        if [ -n "$CONTENT" ]; then
            print_response "Claude's Introduction:"
            echo "----------------------------------------"
            echo "$CONTENT"
            echo "----------------------------------------"
        fi
        
        return 0
    else
        print_error "Failed to create session"
        return 1
    fi
}

# Continue conversation in existing session
continue_conversation() {
    print_session "Continuing conversation in session: $SESSION_ID"
    
    REQUEST_PAYLOAD='{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {
                "role": "user",
                "content": "Great! Now can you remember what we were just talking about and suggest three interesting topics we could explore together?"
            }
        ],
        "max_tokens": 200,
        "temperature": 0.8,
        "session_id": "'$SESSION_ID'"
    }'
    
    print_info "Sending follow-up message..."
    
    RESPONSE=$(eval "curl -s -X POST \"$BASE_URL/v1/chat/completions\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER \\
        -d '$REQUEST_PAYLOAD'")
    
    if [ $? -eq 0 ]; then
        # Check for errors
        ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MESSAGE" ]; then
            print_error "Conversation continuation failed: $ERROR_MESSAGE"
            return 1
        fi
        
        print_success "Conversation continued successfully"
        
        # Display response
        CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
        if [ -n "$CONTENT" ]; then
            print_response "Claude's Follow-up:"
            echo "----------------------------------------"
            echo "$CONTENT"
            echo "----------------------------------------"
        fi
        
        return 0
    else
        print_error "Failed to continue conversation"
        return 1
    fi
}

# Get session details
get_session_details() {
    print_session "Getting details for session: $SESSION_ID"
    
    RESPONSE=$(eval "curl -s -X GET \"$BASE_URL/v1/sessions/$SESSION_ID\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER")
    
    if [ $? -eq 0 ]; then
        # Check if session exists
        ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MESSAGE" ]; then
            print_warning "Session not found or error: $ERROR_MESSAGE"
            return 1
        fi
        
        print_success "Session details retrieved"
        
        # Extract and display session information
        local created_at=$(echo "$RESPONSE" | jq -r '.session.created_at // "unknown"' 2>/dev/null)
        local last_accessed=$(echo "$RESPONSE" | jq -r '.session.last_accessed // "unknown"' 2>/dev/null)
        local message_count=$(echo "$RESPONSE" | jq -r '.session.message_count // 0' 2>/dev/null)
        local expires_at=$(echo "$RESPONSE" | jq -r '.session.expires_at // "unknown"' 2>/dev/null)
        
        echo "  🆔 Session ID: $SESSION_ID"
        echo "  📅 Created: $created_at"
        echo "  🔄 Last accessed: $last_accessed"
        echo "  💬 Messages: $message_count"
        echo "  ⏰ Expires: $expires_at"
        
        if [ "$VERBOSE" = "true" ]; then
            echo "Full session details:"
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
        
        return 0
    else
        print_error "Failed to get session details"
        return 1
    fi
}

# Delete session
delete_session() {
    if [ "$CLEANUP" != "true" ]; then
        print_info "Skipping session cleanup (CLEANUP=false)"
        return 0
    fi
    
    print_session "Deleting session: $SESSION_ID"
    
    RESPONSE=$(eval "curl -s -X DELETE \"$BASE_URL/v1/sessions/$SESSION_ID\" \\
        -H \"Content-Type: application/json\" \\
        $AUTH_HEADER")
    
    if [ $? -eq 0 ]; then
        # Check for errors
        ERROR_MESSAGE=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        if [ -n "$ERROR_MESSAGE" ]; then
            print_warning "Session deletion failed: $ERROR_MESSAGE"
            return 1
        fi
        
        print_success "Session deleted successfully"
        return 0
    else
        print_error "Failed to delete session"
        return 1
    fi
}

# Display example information
show_example_info() {
    echo
    print_info "🎯 Session Management Example"
    echo "This example demonstrates:"
    echo "  • Session creation with persistent conversation"
    echo "  • Session listing and statistics"
    echo "  • Session details retrieval"
    echo "  • Conversation continuity across requests"
    echo "  • Session cleanup and management"
    echo
    print_info "Server: $BASE_URL"
    print_info "Session ID: $SESSION_ID"
    print_info "Authentication: $([ "$API_KEY_REQUIRED" = "true" ] && echo "Required" || echo "Not required")"
    print_info "Cleanup enabled: $CLEANUP"
    echo
}

# Main execution
main() {
    show_example_info
    check_server
    detect_auth
    
    echo "=== Session Management Demo ==="
    echo
    
    # Step 1: List existing sessions
    list_sessions
    echo
    
    # Step 2: Get session statistics
    get_session_stats
    echo
    
    # Step 3: Create a new session
    if create_session; then
        echo
        
        # Step 4: Get session details
        get_session_details
        echo
        
        # Step 5: Continue the conversation
        continue_conversation
        echo
        
        # Step 6: Get updated session details
        print_session "Getting updated session details..."
        get_session_details
        echo
        
        # Step 7: List sessions again to show the new one
        print_session "Listing sessions after creation..."
        list_sessions
        echo
        
        # Step 8: Clean up
        delete_session
    fi
    
    echo
    print_success "✅ Session management example completed successfully!"
    echo
    print_info "Key features demonstrated:"
    print_info "  • Session creation through chat completions"
    print_info "  • Conversation context preservation"
    print_info "  • Session metadata and statistics"
    print_info "  • Session lifecycle management"
    echo
    print_info "Next steps:"
    print_info "  • Try authentication examples: ./scripts/examples/curl/authentication-examples.sh"
    print_info "  • Explore TypeScript SDK: ./scripts/examples/typescript/"
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
        echo "  --no-cleanup   Skip session deletion at end"
        echo
        echo "Environment variables:"
        echo "  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000)"
        echo "  API_KEY            API key for authentication (if required)"
        echo "  SESSION_ID         Custom session ID (default: demo-session-timestamp)"
        echo "  VERBOSE           Enable verbose output (true/false)"
        echo "  CLEANUP           Enable session cleanup (true/false)"
        echo
        echo "Examples:"
        echo "  $0                                    # Basic session demo"
        echo "  $0 --verbose                          # Verbose output"
        echo "  $0 --no-cleanup                       # Keep session after demo"
        echo "  SESSION_ID=my-session $0              # Custom session ID"
        echo "  CLEANUP=false $0                      # Skip cleanup via env"
        exit 0
        ;;
    -v|--verbose)
        VERBOSE=true
        ;;
    --no-cleanup)
        CLEANUP=false
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