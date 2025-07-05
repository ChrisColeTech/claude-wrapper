#!/bin/bash

# Claude Wrapper - Streaming Completion cURL Example
# This script demonstrates real-time streaming responses using Server-Sent Events (SSE)
# Based on Python reference examples with enhanced error handling and visualization

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

echo -e "${BLUE}Claude Wrapper - Streaming Completion Examples${NC}"
echo "==============================================="

# Function to check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Missing dependencies: ${missing_deps[*]}${NC}"
        echo "Install them using:"
        echo "   Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
        echo "   macOS: brew install ${missing_deps[*]}"
        if [[ " ${missing_deps[*]} " =~ " jq " ]]; then
            echo "   (jq is optional but recommended for better formatting)"
            JQ_AVAILABLE=false
        else
            exit 1
        fi
    else
        JQ_AVAILABLE=true
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
        AUTH_HEADER="Authorization: Bearer $API_KEY"
        echo -e "${GREEN}🔑 Using API key authentication${NC}"
    else
        AUTH_HEADER=""
        echo -e "${GREEN}🔓 No authentication required${NC}"
    fi
    echo ""
}

# Function to parse and display streaming response
parse_streaming_response() {
    local line_counter=0
    local response_started=false
    local full_content=""
    
    echo -e "${CYAN}📡 Streaming response:${NC}"
    echo -e "${MAGENTA}╭─────────────────────────────────────────────────────────╮${NC}"
    echo -e "${MAGENTA}│${NC}"
    
    while IFS= read -r line; do
        # Skip empty lines and connection info
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*$ ]]; then
            continue
        fi
        
        # Look for data lines
        if [[ "$line" =~ ^data:\ (.*)$ ]]; then
            local data="${BASH_REMATCH[1]}"
            
            # Check for end of stream
            if [[ "$data" == "[DONE]" ]]; then
                echo -e "${MAGENTA}│${NC}"
                echo -e "${MAGENTA}╰─────────────────────────────────────────────────────────╯${NC}"
                echo -e "${GREEN}✅ Stream completed${NC}"
                break
            fi
            
            # Parse JSON data
            if [ "$JQ_AVAILABLE" = true ] && [[ "$data" =~ ^\{.*\}$ ]]; then
                local content
                content=$(echo "$data" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
                
                if [[ -n "$content" && "$content" != "null" ]]; then
                    response_started=true
                    full_content+="$content"
                    echo -n "$content"
                fi
            else
                # Fallback parsing without jq
                if [[ "$data" =~ \"content\":\"([^\"]*) ]]; then
                    local content="${BASH_REMATCH[1]}"
                    if [[ -n "$content" ]]; then
                        response_started=true
                        full_content+="$content"
                        echo -n "$content"
                    fi
                fi
            fi
        fi
        
        ((line_counter++))
        # Safety check to prevent infinite loops
        if [ $line_counter -gt 1000 ]; then
            echo -e "\n${YELLOW}⚠️  Response truncated after 1000 lines${NC}"
            break
        fi
    done
    
    if [ "$response_started" = false ]; then
        echo -e "${YELLOW}⚠️  No streaming content received${NC}"
        echo -e "${MAGENTA}│${NC} (This might be a server configuration issue)"
        echo -e "${MAGENTA}╰─────────────────────────────────────────────────────────╯${NC}"
    fi
    
    echo ""
    echo ""
}

# Function to run basic streaming example
basic_streaming_example() {
    echo -e "${BLUE}=== Basic Streaming Example ===${NC}"
    echo "Asking: Count from 1 to 5 slowly"
    echo ""
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Count from 1 to 5 slowly, putting each number on a new line\"}
                ],
                \"stream\": true
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Count from 1 to 5 slowly, putting each number on a new line\"}
                ],
                \"stream\": true
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
}

# Function to demonstrate creative writing streaming
creative_streaming_example() {
    echo -e "${BLUE}=== Creative Writing Stream ===${NC}"
    echo "Asking: Write a short haiku about programming"
    echo ""
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a beautiful haiku about programming and debugging\"}
                ],
                \"stream\": true,
                \"temperature\": 0.8
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a beautiful haiku about programming and debugging\"}
                ],
                \"stream\": true,
                \"temperature\": 0.8
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
}

# Function to demonstrate code generation streaming
code_streaming_example() {
    echo -e "${BLUE}=== Code Generation Stream ===${NC}"
    echo "Asking: Write a Python function to calculate fibonacci"
    echo ""
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a Python function that calculates fibonacci numbers with comments explaining each step\"}
                ],
                \"stream\": true,
                \"temperature\": 0.3
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a Python function that calculates fibonacci numbers with comments explaining each step\"}
                ],
                \"stream\": true,
                \"temperature\": 0.3
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
}

# Function to demonstrate conversation streaming
conversation_streaming_example() {
    echo -e "${BLUE}=== Conversation Stream ===${NC}"
    echo "Multi-turn conversation with streaming"
    echo ""
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Hello! I am working on a web application.\"},
                    {\"role\": \"assistant\", \"content\": \"Hello! That sounds exciting. What kind of web application are you building?\"},
                    {\"role\": \"user\", \"content\": \"A task management app. Can you suggest some key features?\"}
                ],
                \"stream\": true
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Hello! I am working on a web application.\"},
                    {\"role\": \"assistant\", \"content\": \"Hello! That sounds exciting. What kind of web application are you building?\"},
                    {\"role\": \"user\", \"content\": \"A task management app. Can you suggest some key features?\"}
                ],
                \"stream\": true
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
}

# Function to demonstrate streaming with custom parameters
custom_parameters_streaming() {
    echo -e "${BLUE}=== Custom Parameters Stream ===${NC}"
    echo "Using custom max_tokens and temperature"
    echo ""
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Explain quantum computing in simple terms\"}
                ],
                \"stream\": true,
                \"max_tokens\": 200,
                \"temperature\": 0.5
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Explain quantum computing in simple terms\"}
                ],
                \"stream\": true,
                \"max_tokens\": 200,
                \"temperature\": 0.5
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
}

# Function to show streaming comparison
streaming_vs_non_streaming() {
    echo -e "${BLUE}=== Streaming vs Non-Streaming Comparison ===${NC}"
    echo ""
    
    # Non-streaming request
    echo -e "${YELLOW}🔄 Non-streaming request (traditional):${NC}"
    echo "Making request..."
    
    local start_time=$(date +%s%N)
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "Write a short joke about programmers"}
                ]
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "Write a short joke about programmers"}
                ]
            }')
    fi
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    echo "Response received after ${duration}ms:"
    if [ "$JQ_AVAILABLE" = true ]; then
        echo "$response" | jq -r '.choices[0].message.content'
    else
        echo "$response"
    fi
    echo ""
    
    # Streaming request
    echo -e "${CYAN}📡 Streaming request (real-time):${NC}"
    echo "Making streaming request..."
    
    local curl_cmd
    if [ -n "$AUTH_HEADER" ]; then
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"$AUTH_HEADER\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a short joke about programmers\"}
                ],
                \"stream\": true
            }'"
    else
        curl_cmd="curl -s -X POST \"$BASE_URL/v1/chat/completions\" \
            -H \"Content-Type: application/json\" \
            -H \"Accept: text/event-stream\" \
            -d '{
                \"model\": \"claude-3-5-sonnet-20241022\",
                \"messages\": [
                    {\"role\": \"user\", \"content\": \"Write a short joke about programmers\"}
                ],
                \"stream\": true
            }'"
    fi
    
    eval "$curl_cmd" | parse_streaming_response
    
    echo -e "${GREEN}💡 Notice how streaming provides immediate feedback!${NC}"
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
    
    echo -e "${GREEN}Running streaming completion examples...${NC}"
    echo ""
    
    basic_streaming_example
    creative_streaming_example
    code_streaming_example
    conversation_streaming_example
    custom_parameters_streaming
    streaming_vs_non_streaming
    
    echo -e "${GREEN}✅ All streaming examples completed!${NC}"
    echo ""
    echo -e "${BLUE}Key takeaways:${NC}"
    echo "• Streaming provides real-time response delivery"
    echo "• Use Accept: text/event-stream header for SSE"
    echo "• Set stream: true in the request body"
    echo "• Parse SSE data events for response chunks"
    echo "• [DONE] indicates end of stream"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "• Try session management: ./session-management.sh"
    echo "• See authentication examples: ./authentication-examples.sh"
    echo "• Try basic completion: ./basic-completion.sh"
}

# Run main function
main