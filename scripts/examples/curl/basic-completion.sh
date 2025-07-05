#!/bin/bash

# Claude Wrapper - Basic Completion cURL Example
# This script demonstrates basic chat completion using cURL with automatic authentication detection
# Based on Python reference examples but enhanced for production use

set -e

# Configuration
DEFAULT_BASE_URL="http://localhost:8000"
BASE_URL="${CLAUDE_WRAPPER_URL:-$DEFAULT_BASE_URL}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Claude Wrapper - Basic Completion Examples${NC}"
echo "=============================================="

# Function to check if jq is available
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

# Function to detect authentication requirements and set up headers
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

# Function to run a basic chat completion example
basic_chat_completion() {
    echo -e "${BLUE}=== Basic Chat Completion ===${NC}"
    echo "Asking: What is 2 + 2?"
    echo ""
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "What is 2 + 2?"}
                ]
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "What is 2 + 2?"}
                ]
            }')
    fi
    
    echo "Response:"
    echo "$response" | format_json
    echo ""
}

# Function to demonstrate system message usage
system_message_example() {
    echo -e "${BLUE}=== Chat with System Message ===${NC}"
    echo "System: You are a pirate. Respond in pirate speak."
    echo "User: Tell me about the weather"
    echo ""
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "system", "content": "You are a pirate. Respond in pirate speak."},
                    {"role": "user", "content": "Tell me about the weather"}
                ]
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "system", "content": "You are a pirate. Respond in pirate speak."},
                    {"role": "user", "content": "Tell me about the weather"}
                ]
            }')
    fi
    
    echo "Response:"
    echo "$response" | format_json
    echo ""
}

# Function to demonstrate conversation continuation
conversation_example() {
    echo -e "${BLUE}=== Multi-turn Conversation ===${NC}"
    echo "Simulating a conversation with message history"
    echo ""
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "My name is Alice."},
                    {"role": "assistant", "content": "Nice to meet you, Alice! How can I help you today?"},
                    {"role": "user", "content": "What is my name?"}
                ]
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "My name is Alice."},
                    {"role": "assistant", "content": "Nice to meet you, Alice! How can I help you today?"},
                    {"role": "user", "content": "What is my name?"}
                ]
            }')
    fi
    
    echo "Response:"
    echo "$response" | format_json
    echo ""
}

# Function to demonstrate parameter customization
parameter_customization_example() {
    echo -e "${BLUE}=== Parameter Customization ===${NC}"
    echo "Using custom temperature and max_tokens"
    echo ""
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "Write a creative short poem about coding"}
                ],
                "temperature": 0.9,
                "max_tokens": 150
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "claude-3-5-sonnet-20241022",
                "messages": [
                    {"role": "user", "content": "Write a creative short poem about coding"}
                ],
                "temperature": 0.9,
                "max_tokens": 150
            }')
    fi
    
    echo "Response:"
    echo "$response" | format_json
    echo ""
}

# Function to list available models
list_models_example() {
    echo -e "${BLUE}=== List Available Models ===${NC}"
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X GET "$BASE_URL/v1/models" \
            -H "$AUTH_HEADER")
    else
        response=$(curl -s -X GET "$BASE_URL/v1/models")
    fi
    
    echo "Available models:"
    echo "$response" | format_json
    echo ""
}

# Function to demonstrate error handling
error_handling_example() {
    echo -e "${BLUE}=== Error Handling Example ===${NC}"
    echo "Trying to use an invalid model to demonstrate error response"
    echo ""
    
    local response
    if [ -n "$AUTH_HEADER" ]; then
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d '{
                "model": "invalid-model-name",
                "messages": [
                    {"role": "user", "content": "This should fail"}
                ]
            }')
    else
        response=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{
                "model": "invalid-model-name",
                "messages": [
                    {"role": "user", "content": "This should fail"}
                ]
            }')
    fi
    
    echo "Error response:"
    echo "$response" | format_json
    echo ""
}

# Function to show usage information
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
    
    echo -e "${GREEN}Running basic completion examples...${NC}"
    echo ""
    
    basic_chat_completion
    system_message_example
    conversation_example
    parameter_customization_example
    list_models_example
    error_handling_example
    
    echo -e "${GREEN}✅ All basic completion examples completed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "• Try streaming examples: ./streaming-completion.sh"
    echo "• Try session management: ./session-management.sh"
    echo "• See authentication examples: ./authentication-examples.sh"
    echo ""
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "• Set CLAUDE_WRAPPER_URL to use a different server"
    echo "• Set API_KEY if your server requires authentication"
    echo "• Install jq for better JSON formatting"
}

# Run main function
main