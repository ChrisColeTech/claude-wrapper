#!/bin/bash

# Authentication Examples cURL Script
# Demonstrates authentication setup and configuration testing
# Based on Python authentication patterns with TypeScript server enhancements

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
TEST_AUTH="${TEST_AUTH:-true}"

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

print_auth() {
    echo -e "${PURPLE}[AUTH]${NC} $1"
}

print_config() {
    echo -e "${CYAN}[CONFIG]${NC} $1"
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

# Get authentication status
get_auth_status() {
    print_auth "Getting authentication status..."
    
    RESPONSE=$(curl -s "$BASE_URL/v1/auth/status" 2>/dev/null || echo '{}')
    
    if [ $? -eq 0 ]; then
        print_success "Authentication status retrieved"
        
        if [ "$VERBOSE" = "true" ]; then
            print_info "Full authentication status:"
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
        
        # Parse key information
        local api_key_required=$(echo "$RESPONSE" | jq -r '.server_info.api_key_required // false' 2>/dev/null)
        local auth_method=$(echo "$RESPONSE" | jq -r '.server_info.auth_method // "unknown"' 2>/dev/null)
        local provider=$(echo "$RESPONSE" | jq -r '.server_info.provider // "unknown"' 2>/dev/null)
        local claude_configured=$(echo "$RESPONSE" | jq -r '.claude_auth.configured // false' 2>/dev/null)
        
        echo "  🔐 API Key Required: $api_key_required"
        echo "  🛡️  Authentication Method: $auth_method"
        echo "  🏢 Provider: $provider"
        echo "  ⚙️  Claude Configured: $claude_configured"
        
        # Check for specific provider configurations
        local has_anthropic=$(echo "$RESPONSE" | jq -r '.claude_auth.anthropic_api_key_configured // false' 2>/dev/null)
        local has_bedrock=$(echo "$RESPONSE" | jq -r '.claude_auth.bedrock_configured // false' 2>/dev/null)
        local has_vertex=$(echo "$RESPONSE" | jq -r '.claude_auth.vertex_configured // false' 2>/dev/null)
        local has_claude_cli=$(echo "$RESPONSE" | jq -r '.claude_auth.claude_cli_available // false' 2>/dev/null)
        
        echo
        print_config "Provider-specific configurations:"
        echo "  🎭 Anthropic API Key: $has_anthropic"
        echo "  ☁️  AWS Bedrock: $has_bedrock"
        echo "  🌐 Google Vertex: $has_vertex"
        echo "  💻 Claude CLI: $has_claude_cli"
        
        return 0
    else
        print_error "Failed to get authentication status"
        return 1
    fi
}

# Test authentication with current settings
test_current_auth() {
    if [ "$TEST_AUTH" != "true" ]; then
        print_info "Skipping authentication test (TEST_AUTH=false)"
        return 0
    fi
    
    print_auth "Testing current authentication..."
    
    # Simple test request
    REQUEST_PAYLOAD='{
        "model": "claude-3-5-sonnet-20241022",
        "messages": [
            {
                "role": "user",
                "content": "Hello! This is an authentication test. Please respond with just the word 'SUCCESS' if you receive this message."
            }
        ],
        "max_tokens": 10
    }'
    
    # Determine if we need an API key
    local auth_status=$(curl -s "$BASE_URL/v1/auth/status" 2>/dev/null || echo '{}')
    local api_key_required=$(echo "$auth_status" | jq -r '.server_info.api_key_required // false' 2>/dev/null)
    
    local auth_header=""
    if [ "$api_key_required" = "true" ]; then
        if [ -z "$API_KEY" ]; then
            print_warning "API key required but not provided - test will likely fail"
            print_info "Set API_KEY environment variable to test with authentication"
        else
            auth_header="-H \"Authorization: Bearer $API_KEY\""
            print_info "Using provided API key for test"
        fi
    else
        print_info "No API key required - testing without authentication"
    fi
    
    print_info "Sending test request..."
    
    RESPONSE=$(eval "curl -s -X POST \"$BASE_URL/v1/chat/completions\" \\
        -H \"Content-Type: application/json\" \\
        $auth_header \\
        -d '$REQUEST_PAYLOAD'")
    
    if [ $? -eq 0 ]; then
        # Check for authentication errors
        local error_type=$(echo "$RESPONSE" | jq -r '.error.type // empty' 2>/dev/null)
        local error_message=$(echo "$RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
        
        if [[ "$error_type" =~ (authentication|authorization|invalid_api_key) ]]; then
            print_error "Authentication failed: $error_message"
            print_info "Check your authentication configuration and API key"
            return 1
        elif [ -n "$error_message" ]; then
            print_warning "Request failed (non-auth error): $error_message"
            return 1
        else
            # Check for successful response
            local content=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
            if [ -n "$content" ]; then
                print_success "Authentication test successful!"
                print_info "Response: $content"
                return 0
            else
                print_warning "Unexpected response format"
                if [ "$VERBOSE" = "true" ]; then
                    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
                fi
                return 1
            fi
        fi
    else
        print_error "Authentication test request failed"
        return 1
    fi
}

# Show authentication configuration examples
show_auth_examples() {
    print_config "Authentication Configuration Examples"
    echo
    echo "🎭 Anthropic API Key Method:"
    echo "   export ANTHROPIC_API_KEY=your-anthropic-api-key"
    echo "   # Server will auto-detect and use Anthropic provider"
    echo
    echo "☁️  AWS Bedrock Method:"
    echo "   export CLAUDE_CODE_USE_BEDROCK=1"
    echo "   export AWS_ACCESS_KEY_ID=your-aws-access-key"
    echo "   export AWS_SECRET_ACCESS_KEY=your-aws-secret-key"
    echo "   export AWS_REGION=us-east-1  # or your preferred region"
    echo
    echo "🌐 Google Vertex AI Method:"
    echo "   export CLAUDE_CODE_USE_VERTEX=1"
    echo "   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json"
    echo "   # Or use gcloud auth application-default login"
    echo
    echo "💻 Claude CLI Method (fallback):"
    echo "   # Install Claude CLI: https://github.com/anthropics/claude-cli"
    echo "   # Run: claude auth login"
    echo "   # Server will use Claude CLI authentication automatically"
    echo
    echo "🔐 API Key Protection (when using wrapper authentication):"
    echo "   export API_KEY=your-generated-api-key"
    echo "   # Or set API_KEY when starting the server for protection"
    echo
}

# Show server startup examples
show_startup_examples() {
    print_config "Server Startup Examples"
    echo
    echo "🚀 Start with Anthropic API Key:"
    echo "   ANTHROPIC_API_KEY=your-key npm start"
    echo
    echo "🚀 Start with AWS Bedrock:"
    echo "   CLAUDE_CODE_USE_BEDROCK=1 AWS_ACCESS_KEY_ID=key AWS_SECRET_ACCESS_KEY=secret npm start"
    echo
    echo "🚀 Start with Google Vertex AI:"
    echo "   CLAUDE_CODE_USE_VERTEX=1 GOOGLE_APPLICATION_CREDENTIALS=creds.json npm start"
    echo
    echo "🚀 Start with API key protection:"
    echo "   API_KEY=your-generated-key npm start"
    echo
    echo "🚀 Interactive API key setup:"
    echo "   npm start  # Will prompt for API key if none configured"
    echo
}

# Test API key protection
test_api_key_protection() {
    print_auth "Testing API key protection..."
    
    # Get current auth status
    local auth_status=$(curl -s "$BASE_URL/v1/auth/status" 2>/dev/null || echo '{}')
    local api_key_required=$(echo "$auth_status" | jq -r '.server_info.api_key_required // false' 2>/dev/null)
    
    if [ "$api_key_required" = "false" ]; then
        print_info "API key protection is not enabled on this server"
        print_info "To enable, restart server with API_KEY environment variable"
        return 0
    fi
    
    print_info "API key protection is enabled - testing protection"
    
    # Test without API key
    print_info "Testing request without API key..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d '{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "test"}]}')
    
    local error_type=$(echo "$RESPONSE" | jq -r '.error.type // empty' 2>/dev/null)
    if [[ "$error_type" =~ (authentication|authorization) ]]; then
        print_success "✅ API key protection working - unauthorized request blocked"
    else
        print_warning "⚠️  API key protection may not be working correctly"
        if [ "$VERBOSE" = "true" ]; then
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
    fi
    
    # Test with invalid API key
    print_info "Testing request with invalid API key..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid-key" \
        -d '{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "test"}]}')
    
    error_type=$(echo "$RESPONSE" | jq -r '.error.type // empty' 2>/dev/null)
    if [[ "$error_type" =~ (authentication|authorization) ]]; then
        print_success "✅ API key validation working - invalid key rejected"
    else
        print_warning "⚠️  API key validation may not be working correctly"
        if [ "$VERBOSE" = "true" ]; then
            echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
        fi
    fi
}

# Display example information
show_example_info() {
    echo
    print_info "🎯 Authentication Configuration Example"
    echo "This example demonstrates:"
    echo "  • Authentication status detection"
    echo "  • Provider configuration checking"
    echo "  • Authentication testing and validation"
    echo "  • API key protection verification"
    echo "  • Configuration examples and setup guides"
    echo
    print_info "Server: $BASE_URL"
    print_info "Test authentication: $TEST_AUTH"
    print_info "API Key provided: $([ -n "$API_KEY" ] && echo "Yes" || echo "No")"
    echo
}

# Main execution
main() {
    show_example_info
    check_server
    
    echo "=== Authentication Configuration Demo ==="
    echo
    
    # Step 1: Get current authentication status
    get_auth_status
    echo
    
    # Step 2: Test current authentication
    test_current_auth
    echo
    
    # Step 3: Test API key protection
    test_api_key_protection
    echo
    
    # Step 4: Show configuration examples
    show_auth_examples
    echo
    
    # Step 5: Show startup examples
    show_startup_examples
    echo
    
    print_success "✅ Authentication examples completed successfully!"
    echo
    print_info "Key concepts demonstrated:"
    print_info "  • Multi-provider authentication (Anthropic, Bedrock, Vertex, Claude CLI)"
    print_info "  • API key protection and validation"
    print_info "  • Authentication status and configuration detection"
    print_info "  • Server startup with different authentication methods"
    echo
    print_info "Next steps:"
    print_info "  • Explore TypeScript SDK: ./scripts/examples/typescript/"
    print_info "  • Try JavaScript examples: ./scripts/examples/javascript/"
    print_info "  • View all examples: ./scripts/examples/README.md"
    print_info "  • Read setup guide: ./docs/examples/SETUP_GUIDE.md"
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  -h, --help       Show this help message"
        echo "  -v, --verbose    Enable verbose output"
        echo "  --no-test        Skip authentication testing"
        echo
        echo "Environment variables:"
        echo "  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000)"
        echo "  API_KEY            API key for authentication testing"
        echo "  VERBOSE           Enable verbose output (true/false)"
        echo "  TEST_AUTH         Enable authentication testing (true/false)"
        echo
        echo "Examples:"
        echo "  $0                                    # Basic auth demo"
        echo "  $0 --verbose                          # Verbose output"
        echo "  $0 --no-test                          # Skip auth tests"
        echo "  API_KEY=your-key $0                   # Test with API key"
        echo "  TEST_AUTH=false $0                    # Skip tests via env"
        exit 0
        ;;
    -v|--verbose)
        VERBOSE=true
        ;;
    --no-test)
        TEST_AUTH=false
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