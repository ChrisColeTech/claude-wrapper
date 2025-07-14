#!/bin/bash

# Performance Test Script for Claude Wrapper
# Tests both mock and regular modes with comprehensive metrics

set -e

# Configuration
MOCK_PORT=8000
REGULAR_PORT=8001
TEST_ITERATIONS=5
RESULTS_FILE="performance_results_$(date +%Y%m%d_%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if server is running
check_server() {
    local port=$1
    local timeout=30
    local count=0
    
    while ! curl -s "http://localhost:$port/health" > /dev/null 2>&1; do
        if [ $count -ge $timeout ]; then
            return 1
        fi
        sleep 1
        count=$((count + 1))
    done
    return 0
}

# Function to measure response time
measure_response_time() {
    local url=$1
    local data=$2
    local start_time=$(date +%s%N)
    
    local response=$(curl -s -w "%{http_code}|%{time_total}" -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null)
    
    local end_time=$(date +%s%N)
    local total_time=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
    
    local http_code=$(echo "$response" | tail -1 | cut -d'|' -f1)
    local curl_time=$(echo "$response" | tail -1 | cut -d'|' -f2)
    local body=$(echo "$response" | head -n -1)
    
    echo "$http_code|$total_time|$curl_time|$body"
}

# Function to run performance test
run_performance_test() {
    local mode=$1
    local port=$2
    local results=()
    
    log "Running performance test for $mode mode on port $port"
    
    # Test scenarios
    local scenarios=(
        '{"name": "simple_request", "data": "{\"model\": \"sonnet\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}]}"}'
        '{"name": "tool_request", "data": "{\"model\": \"sonnet\", \"messages\": [{\"role\": \"user\", \"content\": \"What is the current time?\"}], \"tools\": [{\"type\": \"function\", \"function\": {\"name\": \"get_current_time\", \"description\": \"Get the current time\"}}]}"}'
        '{"name": "long_request", "data": "{\"model\": \"sonnet\", \"messages\": [{\"role\": \"user\", \"content\": \"Please write a detailed explanation of how HTTP works, including request/response cycles, headers, status codes, and common methods like GET, POST, PUT, DELETE. Make it comprehensive but easy to understand.\"}]}"}'
    )
    
    for scenario in "${scenarios[@]}"; do
        local scenario_name=$(echo "$scenario" | jq -r '.name')
        local scenario_data=$(echo "$scenario" | jq -r '.data')
        
        log "Testing scenario: $scenario_name"
        
        local scenario_results=()
        local success_count=0
        local total_time=0
        
        for i in $(seq 1 $TEST_ITERATIONS); do
            log "  Iteration $i/$TEST_ITERATIONS"
            
            local result=$(measure_response_time "http://localhost:$port/v1/chat/completions" "$scenario_data")
            local http_code=$(echo "$result" | cut -d'|' -f1)
            local response_time=$(echo "$result" | cut -d'|' -f2)
            local curl_time=$(echo "$result" | cut -d'|' -f3)
            local body=$(echo "$result" | cut -d'|' -f4)
            
            if [ "$http_code" = "200" ]; then
                success_count=$((success_count + 1))
                total_time=$((total_time + response_time))
                
                # Parse response for additional metrics
                local has_content=$(echo "$body" | jq -r '.choices[0].message.content // empty' | wc -c)
                local has_tool_calls=$(echo "$body" | jq -r '.choices[0].message.tool_calls // empty' | wc -c)
                local token_usage=$(echo "$body" | jq -c '.usage // {}')
                
                scenario_results+=("{\"iteration\": $i, \"success\": true, \"http_code\": $http_code, \"response_time_ms\": $response_time, \"curl_time_s\": \"$curl_time\", \"has_content\": $has_content, \"has_tool_calls\": $has_tool_calls, \"token_usage\": $token_usage}")
            else
                error "  Request failed with HTTP $http_code"
                scenario_results+=("{\"iteration\": $i, \"success\": false, \"http_code\": $http_code, \"response_time_ms\": $response_time, \"error\": \"HTTP $http_code\"}")
            fi
        done
        
        # Calculate statistics
        local success_rate=$((success_count * 100 / TEST_ITERATIONS))
        local avg_time=0
        if [ $success_count -gt 0 ]; then
            avg_time=$((total_time / success_count))
        fi
        
        # Create scenario summary
        local scenario_summary=$(cat <<EOF
{
  "scenario": "$scenario_name",
  "mode": "$mode",
  "port": $port,
  "iterations": $TEST_ITERATIONS,
  "success_count": $success_count,
  "success_rate_percent": $success_rate,
  "average_response_time_ms": $avg_time,
  "results": [$(IFS=','; echo "${scenario_results[*]}")]
}
EOF
)
        
        results+=("$scenario_summary")
        
        success "  $scenario_name: $success_count/$TEST_ITERATIONS successful (${success_rate}%), avg ${avg_time}ms"
    done
    
    # Return results as JSON array
    echo "[$(IFS=','; echo "${results[*]}")]"
}

# Function to start server
start_server() {
    local mode=$1
    local port=$2
    
    log "Starting server in $mode mode on port $port"
    
    if [ "$mode" = "mock" ]; then
        node dist/cli.js -n -m -p $port > /dev/null 2>&1 &
    else
        node dist/cli.js -n -p $port > /dev/null 2>&1 &
    fi
    
    local server_pid=$!
    
    if check_server $port; then
        success "Server started successfully on port $port (PID: $server_pid)"
        echo $server_pid
    else
        error "Failed to start server on port $port"
        return 1
    fi
}

# Function to stop server
stop_server() {
    local port=$1
    
    log "Stopping server on port $port"
    
    # Try graceful shutdown first
    if node dist/cli.js -s > /dev/null 2>&1; then
        success "Server stopped gracefully"
    else
        # Force kill if graceful shutdown fails
        warning "Graceful shutdown failed, force killing processes"
        pkill -f "cli.js.*$port" || true
    fi
    
    # Wait for port to be free
    local count=0
    while ss -tuln | grep ":$port " > /dev/null 2>&1; do
        if [ $count -ge 10 ]; then
            warning "Port $port still in use after 10 seconds"
            break
        fi
        sleep 1
        count=$((count + 1))
    done
}

# Main execution
main() {
    log "Starting Claude Wrapper Performance Test"
    log "Mock Mode Port: $MOCK_PORT"
    log "Regular Mode Port: $REGULAR_PORT"
    log "Test Iterations: $TEST_ITERATIONS"
    log "Results File: $RESULTS_FILE"
    
    # Ensure we're in the right directory
    if [ ! -f "dist/cli.js" ]; then
        error "dist/cli.js not found. Please run 'npm run build' first."
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq to run this test."
        exit 1
    fi
    
    # Initialize results
    local all_results=()
    
    # Test Mock Mode
    log "=== TESTING MOCK MODE ==="
    local mock_pid=$(start_server "mock" $MOCK_PORT)
    if [ $? -eq 0 ]; then
        sleep 2 # Give server time to fully start
        local mock_results=$(run_performance_test "mock" $MOCK_PORT)
        all_results+=("$mock_results")
        stop_server $MOCK_PORT
    else
        error "Failed to start mock mode server"
        exit 1
    fi
    
    # Wait between tests
    sleep 3
    
    # Test Regular Mode
    log "=== TESTING REGULAR MODE ==="
    local regular_pid=$(start_server "regular" $REGULAR_PORT)
    if [ $? -eq 0 ]; then
        sleep 2 # Give server time to fully start
        local regular_results=$(run_performance_test "regular" $REGULAR_PORT)
        all_results+=("$regular_results")
        stop_server $REGULAR_PORT
    else
        error "Failed to start regular mode server"
        exit 1
    fi
    
    # Combine and save results
    local final_results=$(cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "test_configuration": {
    "mock_port": $MOCK_PORT,
    "regular_port": $REGULAR_PORT,
    "iterations_per_scenario": $TEST_ITERATIONS,
    "hostname": "$(hostname)",
    "os": "$(uname -s)",
    "architecture": "$(uname -m)"
  },
  "results": [$(IFS=','; echo "${all_results[*]}")]
}
EOF
)
    
    # Save results to file
    echo "$final_results" | jq '.' > "$RESULTS_FILE"
    success "Results saved to $RESULTS_FILE"
    
    # Display summary
    log "=== PERFORMANCE SUMMARY ==="
    echo "$final_results" | jq -r '
        .results[] | 
        .[] | 
        select(.success_count > 0) | 
        "\(.mode) mode - \(.scenario): \(.success_rate_percent)% success rate, \(.average_response_time_ms)ms avg response time"
    '
    
    log "Performance test completed successfully!"
}

# Cleanup on exit
cleanup() {
    log "Cleaning up..."
    stop_server $MOCK_PORT 2>/dev/null || true
    stop_server $REGULAR_PORT 2>/dev/null || true
}

trap cleanup EXIT

# Run main function
main "$@"