#!/bin/bash

# Claude Wrapper - Session Management cURL Example
# This script demonstrates session continuity and management features
# Based on Python session_continuity.py example with comprehensive session operations

set -e

# Configuration
DEFAULT_BASE_URL="http://localhost:8000"
BASE_URL="${CLAUDE_WRAPPER_URL:-$DEFAULT_BASE_URL}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}Claude Wrapper - Session Management Examples${NC}"
echo "=============================================="

# Function to check dependencies
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq is not installed. Install it for better JSON formatting:${NC}"
        echo "   Ubuntu/Debian: sudo apt-get install jq"
        echo "   macOS: brew install jq"
        echo "   Continuing without JSON formatting..."
        echo ""
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
    fi
}

# Function to format JSON output
format_json() {
    if [ "$JQ_AVAILABLE" = true ]; then
        jq .
    else
        cat
    fi
}

# Function to extract content from response
extract_content() {
    if [ "$JQ_AVAILABLE" = true ]; then
        jq -r '.choices[0].message.content // "No content found"'
    else
        # Fallback parsing without jq
        grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "Response received (install jq for better parsing)"
    fi
}

# Function to check server health
check_server_health() {
    echo -e "${BLUE}Checking server health...${NC}"
    
    if ! curl -s --max-time 5 "$BASE_URL/health" > /dev/null; then
        echo -e "${RED}❌ Server is not responding at $BASE_URL${NC}"
        echo "   Make sure the claude-wrapper server is running:"
        echo "   cd /mnt/c/projects/claude-wrapper && npm run dev"
        echo "   or: claude-wrapper --port 8000"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Server is healthy${NC}"
}

# Function to setup authentication
setup_authentication() {
    echo -e "${BLUE}Detecting authentication requirements...${NC}"
    
    AUTH_STATUS=$(curl -s "$BASE_URL/v1/auth/status" 2>/dev/null || echo '{"server_info":{"api_key_required":false}}')
    API_KEY_REQUIRED=$(echo "$AUTH_STATUS" | jq -r '.server_info.api_key_required // false' 2>/dev/null || echo "false")
    
    if [ "$API_KEY_REQUIRED" = "true" ]; then
        if [ -z "$API_KEY" ]; then
            echo -e "${RED}❌ Server requires API key but API_KEY environment variable not set${NC}"
            echo "   Set API_KEY environment variable with your server's generated key:"
            echo "   export API_KEY=your-generated-key"
            echo "   Then run: $0"
            exit 1
        fi
        AUTH_HEADER="-H \"Authorization: Bearer $API_KEY\""
        echo -e "${GREEN}🔑 Using API key authentication${NC}"
    else
        AUTH_HEADER=""
        echo -e "${GREEN}🔓 No authentication required${NC}"
    fi
    echo ""
}

# Function to make authenticated request
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    if [ -n "$AUTH_HEADER" ]; then
        if [ -n "$data" ]; then
            eval "curl -s -X $method \"$BASE_URL$endpoint\" $AUTH_HEADER -H \"Content-Type: application/json\" -d '$data'"
        else
            eval "curl -s -X $method \"$BASE_URL$endpoint\" $AUTH_HEADER"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data"
        else
            curl -s -X "$method" "$BASE_URL$endpoint"
        fi
    fi
}

# Function to demonstrate basic session continuity
demo_session_continuity() {
    echo -e "${BLUE}=== Session Continuity Demo ===${NC}"
    echo ""
    
    # Generate unique session ID
    local session_id="demo-conversation-$(date +%s)"
    echo -e "${CYAN}Session ID: $session_id${NC}"
    echo ""
    
    # First interaction - introduce context
    echo -e "${YELLOW}📝 Message 1: Introducing context${NC}"
    echo "User: Hello! I'm working on a Python web API project using FastAPI. My name is Alex."
    
    local response1=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "Hello! I am working on a Python web API project using FastAPI. My name is Alex."}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$response1" | extract_content)"
    echo ""
    
    # Second interaction - test memory
    echo -e "${YELLOW}📝 Message 2: Testing memory${NC}"
    echo "User: What's my name and what type of project am I working on?"
    
    local response2=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "What is my name and what type of project am I working on?"}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$response2" | extract_content)"
    echo ""
    
    # Third interaction - continue conversation
    echo -e "${YELLOW}📝 Message 3: Building on context${NC}"
    echo "User: Can you help me add authentication to my FastAPI project?"
    
    local response3=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "Can you help me add authentication to my FastAPI project?"}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$response3" | extract_content)"
    echo ""
    
    echo -e "${GREEN}✅ Session continuity demonstration complete!${NC}"
    echo -e "${CYAN}   Session ID: $session_id${NC}"
    echo -e "${CYAN}   All messages were connected through session context${NC}"
    echo ""
    
    # Store session ID for later use
    DEMO_SESSION_ID="$session_id"
}

# Function to compare stateless vs session-based conversations
demo_stateless_vs_session() {
    echo -e "${BLUE}=== Stateless vs Session Comparison ===${NC}"
    echo ""
    
    # Stateless mode (traditional OpenAI behavior)
    echo -e "${RED}❌ Stateless Mode (no session_id):${NC}"
    echo ""
    
    echo -e "${YELLOW}Message 1 (stateless):${NC}"
    echo "User: My favorite programming language is Python."
    
    local stateless1=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "My favorite programming language is Python."}
        ]
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$stateless1" | extract_content)"
    echo ""
    
    echo -e "${YELLOW}Message 2 (separate stateless request):${NC}"
    echo "User: What's my favorite programming language?"
    
    local stateless2=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "What is my favorite programming language?"}
        ]
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$stateless2" | extract_content)"
    echo -e "${RED}   ↑ Claude has no memory of the previous message${NC}"
    echo ""
    
    # Session mode (with continuity)
    echo -e "${GREEN}✅ Session Mode (with session_id):${NC}"
    echo ""
    
    local session_id="comparison-demo-$(date +%s)"
    
    echo -e "${YELLOW}Message 1 (with session):${NC}"
    echo "User: My favorite programming language is JavaScript."
    
    local session1=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "My favorite programming language is JavaScript."}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$session1" | extract_content)"
    echo ""
    
    echo -e "${YELLOW}Message 2 (same session):${NC}"
    echo "User: What's my favorite programming language?"
    
    local session2=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "What is my favorite programming language?"}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo -e "${GREEN}Claude:${NC} $(echo "$session2" | extract_content)"
    echo -e "${GREEN}   ↑ Claude remembers the previous conversation!${NC}"
    echo ""
}

# Function to demonstrate session management endpoints
demo_session_management() {
    echo -e "${BLUE}=== Session Management Endpoints ===${NC}"
    echo ""
    
    # Create multiple demo sessions
    local session_ids=("demo-session-1-$(date +%s)" "demo-session-2-$(date +%s)")
    
    echo -e "${CYAN}Creating demo sessions...${NC}"
    for session_id in "${session_ids[@]}"; do
        local response=$(make_request "POST" "/v1/chat/completions" '{
            "model": "claude-3-5-sonnet-20241022",
            "messages": [
                {"role": "user", "content": "Hello from '$session_id'! This is a demo session."}
            ],
            "session_id": "'$session_id'"
        }')
        echo "✓ Created session: $session_id"
    done
    echo ""
    
    # List all sessions
    echo -e "${YELLOW}📋 Listing all active sessions:${NC}"
    local sessions_response=$(make_request "GET" "/v1/sessions")
    
    if [ "$JQ_AVAILABLE" = true ]; then
        local total=$(echo "$sessions_response" | jq -r '.total // 0')
        echo "   Total active sessions: $total"
        echo ""
        
        echo "$sessions_response" | jq -r '.sessions[]? | "   • \(.session_id): \(.message_count) messages (created: \(.created_at))"' 2>/dev/null || {
            echo "   Sessions:"
            echo "$sessions_response" | format_json
        }
    else
        echo "   Sessions response:"
        echo "$sessions_response" | format_json
    fi
    echo ""
    
    # Get specific session info
    if [ -n "$DEMO_SESSION_ID" ]; then
        echo -e "${YELLOW}🔍 Session details for: $DEMO_SESSION_ID${NC}"
        local session_response=$(make_request "GET" "/v1/sessions/$DEMO_SESSION_ID")
        
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "   Created: $(echo "$session_response" | jq -r '.created_at // "Unknown"')"
            echo "   Messages: $(echo "$session_response" | jq -r '.message_count // 0')"
            echo "   Expires: $(echo "$session_response" | jq -r '.expires_at // "Unknown"')"
        else
            echo "   Session details:"
            echo "$session_response" | format_json
        fi
        echo ""
    fi
    
    # Session statistics
    echo -e "${YELLOW}📊 Session statistics:${NC}"
    local stats_response=$(make_request "GET" "/v1/sessions/stats")
    
    if [ "$JQ_AVAILABLE" = true ]; then
        echo "   Active sessions: $(echo "$stats_response" | jq -r '.session_stats.active_sessions // 0')"
        echo "   Total messages: $(echo "$stats_response" | jq -r '.session_stats.total_messages // 0')"
        echo "   Cleanup interval: $(echo "$stats_response" | jq -r '.cleanup_interval_minutes // "Unknown"') minutes"
    else
        echo "   Statistics:"
        echo "$stats_response" | format_json
    fi
    echo ""
    
    # Clean up demo sessions
    echo -e "${CYAN}🧹 Cleaning up demo sessions:${NC}"
    for session_id in "${session_ids[@]}"; do
        local delete_response=$(make_request "DELETE" "/v1/sessions/$session_id")
        
        if [[ "$delete_response" =~ "success" ]] || [[ "$delete_response" =~ "deleted" ]]; then
            echo "   ✅ Deleted $session_id"
        else
            echo "   ⚠️  Delete response for $session_id:"
            echo "      $delete_response"
        fi
    done
    echo ""
}

# Function to demonstrate session persistence across requests
demo_session_persistence() {
    echo -e "${BLUE}=== Session Persistence Demo ===${NC}"
    echo ""
    
    local session_id="persistence-demo-$(date +%s)"
    echo -e "${CYAN}Testing session: $session_id${NC}"
    echo ""
    
    # Build conversation step by step
    local messages=(
        "I'm planning a vacation to Japan."
        "What cities should I visit?"
        "How many days would you recommend for Tokyo?"
        "What about food recommendations in Tokyo?"
        "Remind me what vacation we were discussing and which city I asked about food for."
    )
    
    for i in "${!messages[@]}"; do
        local msg_num=$((i + 1))
        echo -e "${YELLOW}Message $msg_num:${NC} ${messages[$i]}"
        
        local response=$(make_request "POST" "/v1/chat/completions" '{
            "model": "claude-3-5-sonnet-20241022",
            "messages": [
                {"role": "user", "content": "'"${messages[$i]}"'"}
            ],
            "session_id": "'$session_id'"
        }')
        
        echo -e "${GREEN}Claude:${NC} $(echo "$response" | extract_content)"
        echo ""
        
        # Small delay between requests
        sleep 1
    done
    
    echo -e "${GREEN}✅ Session persistence test complete!${NC}"
    echo -e "${CYAN}   Notice how Claude maintains context throughout the conversation${NC}"
    echo ""
}

# Function to demonstrate session expiration and cleanup
demo_session_lifecycle() {
    echo -e "${BLUE}=== Session Lifecycle Demo ===${NC}"
    echo ""
    
    local session_id="lifecycle-demo-$(date +%s)"
    echo -e "${CYAN}Creating session: $session_id${NC}"
    
    # Create session
    local response=$(make_request "POST" "/v1/chat/completions" '{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {"role": "user", "content": "This is a lifecycle test session."}
        ],
        "session_id": "'$session_id'"
    }')
    
    echo "✓ Session created"
    echo ""
    
    # Check session exists
    echo -e "${YELLOW}Verifying session exists:${NC}"
    local session_info=$(make_request "GET" "/v1/sessions/$session_id")
    
    if [[ "$session_info" =~ "session_id" ]]; then
        echo "✅ Session confirmed to exist"
        
        if [ "$JQ_AVAILABLE" = true ]; then
            echo "   Created: $(echo "$session_info" | jq -r '.created_at')"
            echo "   Expires: $(echo "$session_info" | jq -r '.expires_at')"
        fi
    else
        echo "❌ Session not found"
        echo "$session_info"
    fi
    echo ""
    
    # Manually delete session
    echo -e "${YELLOW}Manually deleting session:${NC}"
    local delete_response=$(make_request "DELETE" "/v1/sessions/$session_id")
    echo "Delete response: $delete_response"
    echo ""
    
    # Try to access deleted session
    echo -e "${YELLOW}Verifying session deletion:${NC}"
    local deleted_check=$(make_request "GET" "/v1/sessions/$session_id")
    
    if [[ "$deleted_check" =~ "not found" ]] || [[ "$deleted_check" =~ "error" ]]; then
        echo "✅ Session successfully deleted"
    else
        echo "⚠️  Session may still exist:"
        echo "$deleted_check"
    fi
    echo ""
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -u, --url URL  Set custom base URL (default: $DEFAULT_BASE_URL)"
    echo ""
    echo "Environment variables:"
    echo "  API_KEY              API key for authentication (if required)"
    echo "  CLAUDE_WRAPPER_URL   Base URL for the server (default: $DEFAULT_BASE_URL)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run with default settings"
    echo "  $0 -u http://localhost:3000  # Use custom URL"
    echo "  API_KEY=abc123 $0            # Use with API key"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    check_dependencies
    check_server_health
    setup_authentication
    
    echo -e "${GREEN}Running session management examples...${NC}"
    echo ""
    
    demo_session_continuity
    demo_stateless_vs_session
    demo_session_persistence
    demo_session_management
    demo_session_lifecycle
    
    echo -e "${GREEN}✅ All session management examples completed!${NC}"
    echo ""
    echo -e "${BLUE}Key takeaways:${NC}"
    echo "• Use session_id parameter for conversation continuity"
    echo "• Sessions automatically expire after inactivity"
    echo "• Session endpoints provide full lifecycle management"
    echo "• Stateless mode works like traditional OpenAI API"
    echo "• Session context improves conversation quality"
    echo ""
    echo -e "${BLUE}Session API endpoints:${NC}"
    echo "• GET /v1/sessions           - List all sessions"
    echo "• GET /v1/sessions/{id}      - Get session details"
    echo "• DELETE /v1/sessions/{id}   - Delete session"
    echo "• GET /v1/sessions/stats     - Session statistics"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "• Try basic completion: ./basic-completion.sh"
    echo "• Try streaming: ./streaming-completion.sh"
    echo "• See authentication examples: ./authentication-examples.sh"
}

# Run main function
main