# Claude Wrapper Production Operations Guide

## Overview

This comprehensive operations guide provides detailed procedures for managing the Claude Wrapper production server infrastructure on a day-to-day basis. It covers all operational aspects from startup to monitoring, troubleshooting, and maintenance.

## Table of Contents

1. [Day-to-Day Operations](#day-to-day-operations)
2. [Production Server Management](#production-server-management)
3. [Health Monitoring and Alerting](#health-monitoring-and-alerting)
4. [Incident Response Procedures](#incident-response-procedures)
5. [Performance Monitoring and Optimization](#performance-monitoring-and-optimization)
6. [Log Management and Analysis](#log-management-and-analysis)
7. [Backup and Recovery Procedures](#backup-and-recovery-procedures)
8. [Security Operations](#security-operations)
9. [Scaling and Capacity Planning](#scaling-and-capacity-planning)
10. [Maintenance and Update Procedures](#maintenance-and-update-procedures)
11. [Command Reference](#command-reference)
12. [Best Practices and Recommendations](#best-practices-and-recommendations)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Emergency Procedures](#emergency-procedures)

---

## Day-to-Day Operations

### Daily Operations Checklist

**Morning Operations (Start of Day)**
- [ ] Check overall system health status
- [ ] Review overnight logs for any issues
- [ ] Verify all monitoring systems are operational
- [ ] Check resource utilization (CPU, memory, disk)
- [ ] Confirm backup completion status
- [ ] Review security alerts
- [ ] Validate API key authentication status

**Ongoing Monitoring (Throughout Day)**
- [ ] Monitor response times and performance metrics
- [ ] Check health check endpoints regularly
- [ ] Monitor error rates and response codes
- [ ] Review session management and cleanup
- [ ] Check port management status
- [ ] Monitor memory usage and garbage collection

**End of Day Operations**
- [ ] Review daily performance summary
- [ ] Check log rotation and archival
- [ ] Verify backup schedules
- [ ] Document any incidents or issues
- [ ] Plan any required maintenance windows

### Quick Health Status Check

```bash
#!/bin/bash
# daily-health-check.sh - Quick daily health verification

echo "=== Claude Wrapper Daily Health Check ==="
echo "Date: $(date)"
echo

# Basic connectivity test
echo "🌐 Connectivity Test:"
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ Server responding"
else
    echo "❌ Server not responding"
fi

# Detailed health check
echo -e "\n🏥 Detailed Health Status:"
HEALTH=$(curl -s http://localhost:3000/health/detailed)
if [ $? -eq 0 ]; then
    echo "$HEALTH" | jq -r '.overall // "unavailable"'
    echo "Memory: $(echo "$HEALTH" | jq -r '.checks[] | select(.name=="memory") | .message // "unavailable"')"
    echo "Port: $(echo "$HEALTH" | jq -r '.checks[] | select(.name=="server-port") | .message // "unavailable"')"
    echo "Uptime: $(echo "$HEALTH" | jq -r '.checks[] | select(.name=="uptime") | .message // "unavailable"')"
else
    echo "❌ Health check endpoint unavailable"
fi

# Process status
echo -e "\n🔄 Process Status:"
if pgrep -f "claude-wrapper" > /dev/null; then
    echo "✅ Process running (PID: $(pgrep -f claude-wrapper))"
    echo "Memory usage: $(ps -p $(pgrep -f claude-wrapper) -o %mem --no-headers)%"
    echo "CPU usage: $(ps -p $(pgrep -f claude-wrapper) -o %cpu --no-headers)%"
else
    echo "❌ Process not running"
fi

# Recent errors
echo -e "\n📝 Recent Errors (last 10 lines):"
if [ -f /var/log/claude-wrapper.log ]; then
    grep -i error /var/log/claude-wrapper.log | tail -10 | while read line; do
        echo "  $line"
    done
else
    echo "  No error log file found"
fi
```

---

## Production Server Management

### Server Startup Procedures

#### Standard Production Startup

```bash
# 1. Start with production features enabled
claude-wrapper --production --health-monitoring --port 3000

# 2. Or with environment configuration
NODE_ENV=production claude-wrapper --production --health-monitoring

# 3. With custom configuration
claude-wrapper --production --health-monitoring \
  --port 3000 \
  --health-check-interval 30000 \
  --graceful-shutdown-timeout 15000
```

#### Daemon Mode Startup

```bash
# Start as daemon
claude-wrapper --start --production --health-monitoring

# Check daemon status
claude-wrapper --status

# View daemon logs
claude-wrapper --logs

# Stop daemon
claude-wrapper --stop
```

#### PM2 Cluster Startup

```bash
# Start with PM2 for production clustering
pm2 start ecosystem.config.js --env production

# Monitor PM2 processes
pm2 status
pm2 monit

# View logs
pm2 logs claude-wrapper

# Restart all instances
pm2 reload all
```

### Server Shutdown Procedures

#### Graceful Shutdown

```bash
# Send SIGTERM for graceful shutdown
kill -TERM $(pgrep -f claude-wrapper)

# Or use PM2
pm2 stop claude-wrapper

# Verify shutdown completion
ps aux | grep claude-wrapper
```

#### Emergency Shutdown

```bash
# Force shutdown if graceful fails
kill -KILL $(pgrep -f claude-wrapper)

# Cleanup any remaining resources
claude-wrapper --cleanup

# Check for orphaned processes
ps aux | grep -E "(claude|node)" | grep -v grep
```

### Port Management

#### Port Conflict Resolution

The production server automatically handles port conflicts:

```bash
# Check port availability
netstat -tulpn | grep :3000

# Manual port management
node -e "
const { portManager } = require('./dist/utils/port-manager');
portManager.findAvailablePort(3000).then(result => {
  console.log('Available port:', result.port);
  console.log('Status:', result.available ? 'Available' : 'In use');
});
"

# View port reservations
curl http://localhost:3000/v1/debug/system/ports
```

#### Port Management Commands

```bash
# Reserve a port manually
curl -X POST http://localhost:3000/v1/debug/system/ports/reserve \
  -H "Content-Type: application/json" \
  -d '{"port": 3001, "service": "backup-server", "owner": "operations"}'

# Release a port reservation
curl -X DELETE http://localhost:3000/v1/debug/system/ports/3001/release

# List all port reservations
curl http://localhost:3000/v1/debug/system/ports/reservations
```

---

## Health Monitoring and Alerting

### Health Check Endpoints

#### Available Health Endpoints

```bash
# Simple health check
curl http://localhost:3000/health

# Detailed health report
curl http://localhost:3000/health/detailed

# System health (production mode only)
curl http://localhost:3000/health/system

# Kubernetes probes
curl http://localhost:3000/health/ready   # Readiness probe
curl http://localhost:3000/health/live    # Liveness probe
```

#### Health Check Response Examples

**Healthy System Response:**
```json
{
  "overall": "healthy",
  "uptime": 7200000,
  "timestamp": "2025-07-05T10:00:00.000Z",
  "checks": [
    {
      "name": "memory",
      "status": "healthy",
      "message": "Memory usage: 45.2MB / 64.0MB (70.6%)",
      "duration": 2,
      "timestamp": "2025-07-05T10:00:00.000Z"
    },
    {
      "name": "server-port",
      "status": "healthy",
      "message": "Server port 3000 is active",
      "duration": 1,
      "timestamp": "2025-07-05T10:00:00.000Z"
    }
  ],
  "summary": {
    "healthy": 2,
    "warning": 0,
    "unhealthy": 0,
    "total": 2
  }
}
```

### Monitoring Setup

#### Automated Health Monitoring

```bash
#!/bin/bash
# health-monitor.sh - Continuous health monitoring

HEALTH_URL="http://localhost:3000/health/detailed"
ALERT_WEBHOOK="https://your-webhook-url.com/alert"
CHECK_INTERVAL=30

while true; do
    TIMESTAMP=$(date)
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
    OVERALL_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.overall // "unknown"')
    
    case "$OVERALL_STATUS" in
        "healthy")
            echo "[$TIMESTAMP] ✅ System healthy"
            ;;
        "warning")
            echo "[$TIMESTAMP] ⚠️ System warning"
            echo "$HEALTH_RESPONSE" | jq '.checks[] | select(.status != "healthy")'
            ;;
        "unhealthy")
            echo "[$TIMESTAMP] ❌ System unhealthy"
            echo "$HEALTH_RESPONSE" | jq '.checks[] | select(.status == "unhealthy")'
            # Send alert
            curl -X POST "$ALERT_WEBHOOK" \
                 -H "Content-Type: application/json" \
                 -d "{\"text\": \"🚨 Claude Wrapper unhealthy: $OVERALL_STATUS\", \"details\": $HEALTH_RESPONSE}"
            ;;
        *)
            echo "[$TIMESTAMP] ❓ Health check failed or unknown status: $OVERALL_STATUS"
            ;;
    esac
    
    sleep $CHECK_INTERVAL
done
```

#### Custom Health Checks

Register custom health checks for specific monitoring needs:

```typescript
// Custom database health check example
healthMonitor.registerHealthCheck('database', async () => {
  try {
    // Your database connectivity check
    const result = await checkDatabaseConnection();
    return {
      name: 'database',
      status: result.connected ? 'healthy' : 'unhealthy',
      message: result.connected ? 'Database connected' : 'Database connection failed',
      duration: result.responseTime,
      timestamp: new Date(),
      details: { host: result.host, latency: result.latency }
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      message: `Database check failed: ${error.message}`,
      duration: 0,
      timestamp: new Date()
    };
  }
});
```

### Alerting Configuration

#### Slack/Teams Integration

```bash
#!/bin/bash
# slack-alerts.sh - Send alerts to Slack

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

send_alert() {
    local severity=$1
    local message=$2
    local details=$3
    
    local emoji
    case "$severity" in
        "critical") emoji="🚨" ;;
        "warning") emoji="⚠️" ;;
        "info") emoji="ℹ️" ;;
        *) emoji="📢" ;;
    esac
    
    curl -X POST "$SLACK_WEBHOOK" \
         -H "Content-Type: application/json" \
         -d "{
             \"text\": \"$emoji Claude Wrapper Alert\",
             \"attachments\": [{
                 \"color\": \"$([ "$severity" = "critical" ] && echo "danger" || echo "warning")\",
                 \"fields\": [{
                     \"title\": \"Severity\",
                     \"value\": \"$severity\",
                     \"short\": true
                 }, {
                     \"title\": \"Message\",
                     \"value\": \"$message\",
                     \"short\": false
                 }, {
                     \"title\": \"Details\",
                     \"value\": \"$details\",
                     \"short\": false
                 }, {
                     \"title\": \"Timestamp\",
                     \"value\": \"$(date)\",
                     \"short\": true
                 }]
             }]
         }"
}

# Usage examples
send_alert "critical" "Server unreachable" "Health check endpoint returning 500"
send_alert "warning" "High memory usage" "Memory usage at 85%"
send_alert "info" "Server restarted" "Planned maintenance completed"
```

---

## Incident Response Procedures

### Incident Classification

**Severity Levels:**
- **P0 (Critical)**: Service completely unavailable
- **P1 (High)**: Major functionality impaired
- **P2 (Medium)**: Minor functionality affected
- **P3 (Low)**: Minor issues, no user impact

### P0 Critical Incident Response

**Immediate Actions (Within 5 minutes):**

1. **Verify Incident**
   ```bash
   # Quick verification
   curl -f http://localhost:3000/health || echo "Server down"
   ps aux | grep claude-wrapper || echo "Process not running"
   ```

2. **Check System Resources**
   ```bash
   # System resources
   free -h                    # Memory usage
   df -h                      # Disk space
   top -p $(pgrep claude-wrapper)  # Process stats
   ```

3. **Attempt Quick Recovery**
   ```bash
   # Restart service
   pm2 restart claude-wrapper
   
   # Or manual restart
   claude-wrapper --production --health-monitoring &
   ```

4. **Escalate if Not Resolved**
   ```bash
   # Send critical alert
   send_alert "critical" "Service down - manual restart failed" "Escalating to on-call engineer"
   ```

### P1 High Priority Response

**Response Actions (Within 15 minutes):**

1. **Identify Impact**
   ```bash
   # Check error rates
   curl http://localhost:3000/health/detailed | jq '.checks[] | select(.status != "healthy")'
   
   # Check recent errors
   tail -50 /var/log/claude-wrapper.log | grep -i error
   ```

2. **Implement Workaround**
   ```bash
   # Scale up if performance issue
   pm2 scale claude-wrapper +2
   
   # Or restart problematic components
   pm2 restart claude-wrapper --update-env
   ```

3. **Monitor Recovery**
   ```bash
   # Continuous monitoring
   watch -n 5 'curl -s http://localhost:3000/health/detailed | jq .overall'
   ```

### Incident Communication Template

```
INCIDENT ALERT - Claude Wrapper Production

Severity: [P0/P1/P2/P3]
Status: [Investigating/Identified/Monitoring/Resolved]
Start Time: [YYYY-MM-DD HH:MM UTC]
Duration: [X minutes]

Impact:
- [Description of user impact]
- [Affected functionality]

Root Cause:
- [Initial findings]
- [Suspected cause]

Actions Taken:
- [List of actions performed]
- [Current status]

Next Steps:
- [Planned actions]
- [ETA for resolution]

Point of Contact: [Name, contact info]
```

---

## Performance Monitoring and Optimization

### Performance Metrics Collection

#### Key Performance Indicators (KPIs)

```bash
# Response time monitoring
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3000/health
# curl-format.txt contains: time_total:%{time_total}s\ntime_connect:%{time_connect}s\ntime_starttransfer:%{time_starttransfer}s

# Memory usage tracking
ps -p $(pgrep claude-wrapper) -o %mem,vsz,rss --no-headers

# CPU usage monitoring
ps -p $(pgrep claude-wrapper) -o %cpu --no-headers

# Connection counts
netstat -an | grep :3000 | wc -l
```

#### Performance Monitoring Script

```bash
#!/bin/bash
# performance-monitor.sh - Continuous performance monitoring

LOG_FILE="/var/log/claude-wrapper-performance.log"
METRICS_FILE="/var/log/claude-wrapper-metrics.csv"

# Initialize CSV headers
echo "timestamp,response_time_ms,memory_percent,cpu_percent,connections,status" > "$METRICS_FILE"

while true; do
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Response time check
    RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health)
    RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
    
    # Memory and CPU usage
    PROCESS_STATS=$(ps -p $(pgrep claude-wrapper) -o %mem,%cpu --no-headers 2>/dev/null)
    if [ -n "$PROCESS_STATS" ]; then
        MEMORY_PERCENT=$(echo "$PROCESS_STATS" | awk '{print $1}')
        CPU_PERCENT=$(echo "$PROCESS_STATS" | awk '{print $2}')
    else
        MEMORY_PERCENT="0"
        CPU_PERCENT="0"
    fi
    
    # Connection count
    CONNECTIONS=$(netstat -an | grep :3000 | grep ESTABLISHED | wc -l)
    
    # Health status
    STATUS=$(curl -s http://localhost:3000/health/detailed | jq -r '.overall // "unknown"')
    
    # Log metrics
    echo "$TIMESTAMP,$RESPONSE_TIME_MS,$MEMORY_PERCENT,$CPU_PERCENT,$CONNECTIONS,$STATUS" >> "$METRICS_FILE"
    
    # Alert on performance thresholds
    if (( $(echo "$RESPONSE_TIME_MS > 2000" | bc -l) )); then
        echo "[$TIMESTAMP] ⚠️ High response time: ${RESPONSE_TIME_MS}ms" | tee -a "$LOG_FILE"
    fi
    
    if (( $(echo "$MEMORY_PERCENT > 80" | bc -l) )); then
        echo "[$TIMESTAMP] ⚠️ High memory usage: ${MEMORY_PERCENT}%" | tee -a "$LOG_FILE"
    fi
    
    if (( CONNECTIONS > 100 )); then
        echo "[$TIMESTAMP] ⚠️ High connection count: $CONNECTIONS" | tee -a "$LOG_FILE"
    fi
    
    sleep 60  # Check every minute
done
```

### Performance Optimization

#### Memory Optimization

```bash
# Node.js memory optimization
export NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"

# Enable garbage collection logging
export NODE_OPTIONS="$NODE_OPTIONS --trace-gc"

# Force garbage collection (emergency)
kill -SIGUSR1 $(pgrep claude-wrapper)
```

#### Connection Optimization

```bash
# Check connection pool status
curl http://localhost:3000/v1/debug/system/connections

# Optimize keep-alive settings
export KEEP_ALIVE_TIMEOUT=5000
export HEADERS_TIMEOUT=10000
export SERVER_TIMEOUT=30000
```

#### Performance Tuning Configuration

```bash
# /etc/sysctl.conf optimizations for high-traffic scenarios
# Increase max connections
net.core.somaxconn = 65535

# Optimize TCP settings
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_syn_backlog = 8192

# Apply changes
sysctl -p
```

---

## Log Management and Analysis

### Log Configuration

#### Production Logging Setup

```bash
# Environment variables for logging
export LOG_LEVEL=info
export LOG_FORMAT=json
export LOG_FILE=true
export LOG_MAX_SIZE=20m
export LOG_MAX_FILES=5
export LOG_DIRECTORY=/var/log/claude-wrapper
```

#### Log Rotation Configuration

```bash
# /etc/logrotate.d/claude-wrapper
/var/log/claude-wrapper/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 claude-wrapper claude-wrapper
    postrotate
        /bin/kill -SIGUSR1 $(pgrep claude-wrapper) 2>/dev/null || true
    endrotate
}
```

### Log Analysis

#### Log Parsing and Monitoring

```bash
#!/bin/bash
# log-analyzer.sh - Real-time log analysis

LOG_FILE="/var/log/claude-wrapper/application.log"

# Monitor error patterns
tail -f "$LOG_FILE" | while read line; do
    echo "$line" | jq -r '. | select(.level == "error") | "\(.timestamp) ERROR: \(.message)"'
done

# Error rate calculation
error_rate() {
    local minutes=${1:-5}
    local total_lines=$(tail -n 1000 "$LOG_FILE" | wc -l)
    local error_lines=$(tail -n 1000 "$LOG_FILE" | jq -r 'select(.level == "error")' | wc -l)
    
    if [ "$total_lines" -gt 0 ]; then
        local rate=$(echo "scale=2; $error_lines * 100 / $total_lines" | bc)
        echo "Error rate (last 1000 entries): ${rate}%"
    fi
}

# Performance metrics from logs
performance_summary() {
    echo "=== Performance Summary (Last Hour) ==="
    
    # Average response times
    echo "Average response times:"
    tail -n 1000 "$LOG_FILE" | \
    jq -r 'select(.responseTime) | .responseTime' | \
    awk '{sum+=$1; count++} END {if(count>0) print "  API calls: " sum/count "ms"}'
    
    # Request counts by endpoint
    echo -e "\nTop endpoints (request count):"
    tail -n 1000 "$LOG_FILE" | \
    jq -r 'select(.path) | .path' | \
    sort | uniq -c | sort -nr | head -5
    
    # Status code distribution
    echo -e "\nStatus code distribution:"
    tail -n 1000 "$LOG_FILE" | \
    jq -r 'select(.statusCode) | .statusCode' | \
    sort | uniq -c | sort -nr
}
```

#### Log Search and Filtering

```bash
# Search for specific errors
search_errors() {
    local pattern=$1
    local hours=${2:-1}
    
    find /var/log/claude-wrapper -name "*.log" -mtime -1 | \
    xargs grep -i "$pattern" | \
    tail -20
}

# Search for authentication failures
search_errors "authentication.*failed" 2

# Search for timeout errors
search_errors "timeout" 1

# Search for memory issues
search_errors "memory\|heap" 4
```

#### Structured Log Query Examples

```bash
# Query JSON logs with jq
recent_errors() {
    local count=${1:-10}
    
    tail -n 1000 /var/log/claude-wrapper/application.log | \
    jq -r "select(.level == \"error\") | \"\(.timestamp) [\(.level)] \(.message)\"" | \
    tail -n "$count"
}

# Query by time range
logs_by_time() {
    local start_time=$1  # Format: "2025-07-05T10:00:00"
    local end_time=$2    # Format: "2025-07-05T11:00:00"
    
    tail -n 5000 /var/log/claude-wrapper/application.log | \
    jq -r "select(.timestamp >= \"$start_time\" and .timestamp <= \"$end_time\") | \"\(.timestamp) [\(.level)] \(.message)\""
}

# Query performance metrics
slow_requests() {
    local threshold=${1:-1000}  # milliseconds
    
    tail -n 1000 /var/log/claude-wrapper/application.log | \
    jq -r "select(.responseTime and (.responseTime | tonumber) > $threshold) | \"\(.timestamp) \(.path) \(.responseTime)ms\""
}
```

---

## Backup and Recovery Procedures

### Configuration Backup

#### Automated Backup Script

```bash
#!/bin/bash
# backup-config.sh - Automated configuration backup

BACKUP_DIR="/backup/claude-wrapper"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/config-$DATE"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup configuration files
cp /opt/claude-wrapper/.env.production "$BACKUP_PATH/"
cp /opt/claude-wrapper/ecosystem.config.js "$BACKUP_PATH/"
cp -r /opt/claude-wrapper/config/ "$BACKUP_PATH/"

# Backup process configuration
pm2 save --force > "$BACKUP_PATH/pm2-config.json"

# Backup system configuration
cp /etc/systemd/system/claude-wrapper.service "$BACKUP_PATH/" 2>/dev/null || true
cp /etc/logrotate.d/claude-wrapper "$BACKUP_PATH/" 2>/dev/null || true

# Create backup manifest
cat > "$BACKUP_PATH/manifest.txt" << EOF
Claude Wrapper Configuration Backup
Date: $(date)
Server: $(hostname)
Version: $(claude-wrapper --version 2>/dev/null || echo "unknown")

Contents:
- Application configuration (.env.production)
- PM2 configuration (ecosystem.config.js)
- Runtime configuration (config/)
- Process state (pm2-config.json)
- System service files
EOF

# Compress backup
tar -czf "$BACKUP_DIR/claude-wrapper-config-$DATE.tar.gz" -C "$BACKUP_DIR" "config-$DATE"
rm -rf "$BACKUP_PATH"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "claude-wrapper-config-*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/claude-wrapper-config-$DATE.tar.gz"
```

### Session Data Backup

```bash
#!/bin/bash
# backup-sessions.sh - Session data backup

SESSION_BACKUP_DIR="/backup/claude-wrapper/sessions"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p "$SESSION_BACKUP_DIR"

# Backup active sessions (if using file-based storage)
if [ -d "/opt/claude-wrapper/data/sessions" ]; then
    tar -czf "$SESSION_BACKUP_DIR/sessions-$DATE.tar.gz" \
        -C "/opt/claude-wrapper/data" sessions/
    echo "Session backup completed: $SESSION_BACKUP_DIR/sessions-$DATE.tar.gz"
fi

# Get session statistics
curl -s http://localhost:3000/v1/debug/system/sessions | \
    jq . > "$SESSION_BACKUP_DIR/session-stats-$DATE.json"

# Cleanup old session backups (keep 7 days)
find "$SESSION_BACKUP_DIR" -name "sessions-*.tar.gz" -mtime +7 -delete
find "$SESSION_BACKUP_DIR" -name "session-stats-*.json" -mtime +7 -delete
```

### Disaster Recovery

#### Complete System Recovery

```bash
#!/bin/bash
# disaster-recovery.sh - Complete system recovery procedure

BACKUP_FILE=$1
RECOVERY_DIR="/opt/claude-wrapper-recovery"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

echo "=== Claude Wrapper Disaster Recovery ==="
echo "Backup file: $BACKUP_FILE"
echo "Recovery directory: $RECOVERY_DIR"
echo

# Stop current service
echo "1. Stopping current service..."
pm2 stop claude-wrapper 2>/dev/null || true
systemctl stop claude-wrapper 2>/dev/null || true

# Create recovery directory
echo "2. Creating recovery environment..."
mkdir -p "$RECOVERY_DIR"
cd "$RECOVERY_DIR"

# Extract backup
echo "3. Extracting backup..."
tar -xzf "$BACKUP_FILE"

# Restore configuration
echo "4. Restoring configuration..."
CONFIG_DIR=$(find . -name "config-*" -type d | head -1)
if [ -n "$CONFIG_DIR" ]; then
    cp "$CONFIG_DIR/.env.production" /opt/claude-wrapper/
    cp "$CONFIG_DIR/ecosystem.config.js" /opt/claude-wrapper/
    cp -r "$CONFIG_DIR/config"/* /opt/claude-wrapper/config/ 2>/dev/null || true
fi

# Verify installation
echo "5. Verifying installation..."
cd /opt/claude-wrapper
npm install --production

# Test configuration
echo "6. Testing configuration..."
node -e "
const config = require('./dist/utils/env').config;
console.log('Configuration validated successfully');
console.log('Port:', config.port);
console.log('Environment:', config.nodeEnv);
" || {
    echo "❌ Configuration validation failed"
    exit 1
}

# Start service
echo "7. Starting service..."
pm2 start ecosystem.config.js --env production

# Verify startup
echo "8. Verifying startup..."
sleep 10
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Recovery completed successfully"
    echo "Service is running at: http://localhost:3000"
else
    echo "❌ Recovery verification failed"
    echo "Check logs: pm2 logs claude-wrapper"
    exit 1
fi

# Cleanup
rm -rf "$RECOVERY_DIR"
echo "Recovery cleanup completed"
```

#### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh - Rollback to previous version

ROLLBACK_VERSION=$1

if [ -z "$ROLLBACK_VERSION" ]; then
    echo "Available backups:"
    ls -la /backup/claude-wrapper/config-*.tar.gz | tail -5
    echo
    echo "Usage: $0 <backup-date> (e.g., 20250705-143022)"
    exit 1
fi

BACKUP_FILE="/backup/claude-wrapper/claude-wrapper-config-$ROLLBACK_VERSION.tar.gz"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Rolling back to version: $ROLLBACK_VERSION"

# Backup current state
echo "Creating pre-rollback backup..."
./backup-config.sh

# Perform rollback
echo "Performing rollback..."
./disaster-recovery.sh "$BACKUP_FILE"

echo "✅ Rollback completed"
```

---

## Security Operations

### Authentication Management

#### API Key Management

```bash
# Generate new API key
generate_api_key() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

# Rotate API key
rotate_api_key() {
    local new_key=$(generate_api_key)
    
    # Update configuration
    sed -i "s/API_KEY=.*/API_KEY=$new_key/" /opt/claude-wrapper/.env.production
    
    # Restart service to pick up new key
    pm2 restart claude-wrapper --update-env
    
    echo "API key rotated successfully"
    echo "New key: $new_key"
    echo "Update your clients with the new key"
}

# Validate API key configuration
validate_api_key() {
    if [ -z "$API_KEY" ]; then
        echo "❌ API_KEY not configured"
        return 1
    fi
    
    # Test with the configured key
    curl -H "Authorization: Bearer $API_KEY" \
         http://localhost:3000/v1/auth/status
}
```

#### Security Monitoring

```bash
#!/bin/bash
# security-monitor.sh - Monitor for security events

LOG_FILE="/var/log/claude-wrapper/security.log"
ALERT_THRESHOLD=5  # Failed attempts per minute

# Monitor authentication failures
monitor_auth_failures() {
    tail -f /var/log/claude-wrapper/application.log | \
    grep -i "authentication.*failed\|unauthorized\|forbidden" | \
    while read line; do
        echo "$(date): $line" >> "$LOG_FILE"
        
        # Count recent failures
        recent_failures=$(grep "authentication.*failed" "$LOG_FILE" | \
                         grep "$(date +%Y-%m-%d\ %H:%M)" | wc -l)
        
        if [ "$recent_failures" -ge "$ALERT_THRESHOLD" ]; then
            echo "🚨 SECURITY ALERT: $recent_failures authentication failures in the last minute"
            # Send alert notification
            send_alert "critical" "Multiple authentication failures" "Detected $recent_failures failures"
        fi
    done
}

# Monitor suspicious access patterns
monitor_access_patterns() {
    # Check for unusual request patterns
    tail -n 1000 /var/log/claude-wrapper/application.log | \
    jq -r 'select(.ip) | .ip' | \
    sort | uniq -c | sort -nr | \
    while read count ip; do
        if [ "$count" -gt 100 ]; then
            echo "⚠️ High request volume from IP: $ip ($count requests)"
        fi
    done
}

# SSL certificate monitoring
monitor_ssl_certificate() {
    local cert_file="/etc/ssl/certs/claude-wrapper.crt"
    
    if [ -f "$cert_file" ]; then
        local expiry=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        local expiry_date=$(date -d "$expiry" +%s)
        local current_date=$(date +%s)
        local days_left=$(( (expiry_date - current_date) / 86400 ))
        
        if [ "$days_left" -lt 30 ]; then
            echo "⚠️ SSL certificate expires in $days_left days"
            send_alert "warning" "SSL certificate expiring soon" "Certificate expires in $days_left days"
        fi
    fi
}
```

### Security Hardening

#### Firewall Configuration

```bash
#!/bin/bash
# configure-firewall.sh - Configure firewall for Claude Wrapper

# Allow SSH (adjust port as needed)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct access to application port
ufw deny 3000/tcp

# Allow specific IPs to access management ports (adjust as needed)
# ufw allow from 192.168.1.0/24 to any port 3000

# Enable firewall
ufw --force enable

echo "Firewall configured successfully"
ufw status verbose
```

#### Security Audit Script

```bash
#!/bin/bash
# security-audit.sh - Security configuration audit

echo "=== Claude Wrapper Security Audit ==="
echo "Date: $(date)"
echo

# Check file permissions
echo "1. File Permissions:"
find /opt/claude-wrapper -name "*.env*" -exec ls -la {} \;
find /opt/claude-wrapper -name "*.key" -exec ls -la {} \; 2>/dev/null || echo "No key files found"

# Check for default passwords
echo -e "\n2. Configuration Security:"
if grep -q "password.*123456\|password.*admin\|password.*default" /opt/claude-wrapper/.env* 2>/dev/null; then
    echo "❌ Default passwords detected"
else
    echo "✅ No default passwords found"
fi

# Check SSL configuration
echo -e "\n3. SSL Configuration:"
if [ -f "/etc/ssl/certs/claude-wrapper.crt" ]; then
    echo "✅ SSL certificate found"
    openssl x509 -enddate -noout -in /etc/ssl/certs/claude-wrapper.crt
else
    echo "⚠️ No SSL certificate configured"
fi

# Check firewall status
echo -e "\n4. Firewall Status:"
ufw status | head -5

# Check service exposure
echo -e "\n5. Service Exposure:"
netstat -tlnp | grep :3000 || echo "Service not directly exposed"

# Check authentication configuration
echo -e "\n6. Authentication:"
if [ -n "$API_KEY" ]; then
    echo "✅ API key protection enabled"
else
    echo "⚠️ No API key protection configured"
fi

# Check rate limiting
echo -e "\n7. Rate Limiting:"
if grep -q "RATE_LIMIT_ENABLED=true" /opt/claude-wrapper/.env.production 2>/dev/null; then
    echo "✅ Rate limiting enabled"
else
    echo "⚠️ Rate limiting not configured"
fi
```

---

## Scaling and Capacity Planning

### Horizontal Scaling

#### PM2 Cluster Scaling

```bash
# Scale up instances
pm2 scale claude-wrapper +2    # Add 2 more instances
pm2 scale claude-wrapper 5     # Scale to exactly 5 instances

# Scale based on CPU cores
pm2 scale claude-wrapper max   # Scale to number of CPU cores

# Monitor scaling
pm2 monit

# Auto-scaling based on CPU usage
pm2 install pm2-auto-pull  # Auto-restart on high CPU
```

#### Load Balancer Configuration

**Nginx Load Balancer:**
```nginx
upstream claude-wrapper-cluster {
    least_conn;  # Use least connections algorithm
    
    server localhost:3001 max_fails=3 fail_timeout=30s;
    server localhost:3002 max_fails=3 fail_timeout=30s;
    server localhost:3003 max_fails=3 fail_timeout=30s;
    
    # Health check (requires nginx-plus or lua module)
    # health_check interval=10s fails=3 passes=2;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://claude-wrapper-cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Health check endpoint bypass
        location /health {
            proxy_pass http://claude-wrapper-cluster;
            access_log off;
        }
    }
}
```

### Capacity Planning

#### Performance Baseline Script

```bash
#!/bin/bash
# capacity-baseline.sh - Establish performance baseline

DURATION=${1:-300}  # Test duration in seconds (default 5 minutes)
CONCURRENCY=${2:-10}  # Concurrent requests

echo "=== Claude Wrapper Capacity Baseline Test ==="
echo "Duration: ${DURATION}s"
echo "Concurrency: $CONCURRENCY"
echo "Start time: $(date)"
echo

# Create test payload
TEST_PAYLOAD='{
  "model": "claude-3-sonnet-20240229",
  "messages": [
    {
      "role": "user",
      "content": "Hello, this is a capacity test message."
    }
  ],
  "max_tokens": 100
}'

# Run baseline test with ab (Apache Bench)
echo "Running baseline test..."
ab -t "$DURATION" -c "$CONCURRENCY" \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer $API_KEY" \
   -p <(echo "$TEST_PAYLOAD") \
   http://localhost:3000/v1/chat/completions > baseline-results.txt

# Extract key metrics
echo "=== Baseline Results ==="
grep -E "Requests per second|Time per request|Transfer rate" baseline-results.txt

# Monitor system resources during test
echo -e "\n=== System Resources During Test ==="
ps -p $(pgrep claude-wrapper) -o %cpu,%mem,vsz,rss --no-headers
echo "Memory usage: $(free -h | grep Mem | awk '{print $3"/"$2}')"
echo "Load average: $(uptime | awk -F'load average:' '{print $2}')"

# Save baseline for comparison
echo "$(date): Baseline - RPS: $(grep 'Requests per second' baseline-results.txt | awk '{print $4}'), Memory: $(ps -p $(pgrep claude-wrapper) -o %mem --no-headers)%" >> capacity-history.log
```

#### Auto-scaling Script

```bash
#!/bin/bash
# auto-scale.sh - Automatic scaling based on metrics

CPU_THRESHOLD=70     # Scale up if CPU > 70%
MEMORY_THRESHOLD=80  # Scale up if memory > 80%
RESPONSE_THRESHOLD=2000  # Scale up if response time > 2s
MIN_INSTANCES=2
MAX_INSTANCES=8

scale_decision() {
    local current_instances=$(pm2 list | grep "claude-wrapper" | grep "online" | wc -l)
    local cpu_usage=$(ps -p $(pgrep claude-wrapper) -o %cpu --no-headers | awk '{sum+=$1} END {print sum/NR}')
    local memory_usage=$(ps -p $(pgrep claude-wrapper) -o %mem --no-headers | awk '{sum+=$1} END {print sum/NR}')
    local response_time=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health)
    local response_time_ms=$(echo "$response_time * 1000" | bc)
    
    echo "Current metrics: Instances=$current_instances, CPU=${cpu_usage}%, Memory=${memory_usage}%, ResponseTime=${response_time_ms}ms"
    
    # Scale up conditions
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l) )) || \
       (( $(echo "$memory_usage > $MEMORY_THRESHOLD" | bc -l) )) || \
       (( $(echo "$response_time_ms > $RESPONSE_THRESHOLD" | bc -l) )); then
        
        if [ "$current_instances" -lt "$MAX_INSTANCES" ]; then
            echo "Scaling up: Adding 1 instance"
            pm2 scale claude-wrapper +1
            send_alert "info" "Auto-scaled up" "Current instances: $((current_instances + 1))"
        else
            echo "At maximum instances, consider adding more servers"
            send_alert "warning" "Maximum instances reached" "Consider horizontal scaling"
        fi
    
    # Scale down conditions (conservative)
    elif (( $(echo "$cpu_usage < 30" | bc -l) )) && \
         (( $(echo "$memory_usage < 40" | bc -l) )) && \
         (( $(echo "$response_time_ms < 500" | bc -l) )); then
        
        if [ "$current_instances" -gt "$MIN_INSTANCES" ]; then
            echo "Scaling down: Removing 1 instance"
            pm2 scale claude-wrapper -1
            send_alert "info" "Auto-scaled down" "Current instances: $((current_instances - 1))"
        fi
    else
        echo "No scaling action needed"
    fi
}

# Run scaling decision every 5 minutes
while true; do
    scale_decision
    sleep 300
done
```

### Resource Monitoring

#### Capacity Monitoring Dashboard

```bash
#!/bin/bash
# capacity-dashboard.sh - Real-time capacity monitoring

while true; do
    clear
    echo "=== Claude Wrapper Capacity Dashboard ==="
    echo "Timestamp: $(date)"
    echo

    # Service status
    echo "🔄 Service Status:"
    if pm2 list | grep -q "claude-wrapper.*online"; then
        echo "  ✅ Service running"
        echo "  Instances: $(pm2 list | grep "claude-wrapper" | grep "online" | wc -l)"
    else
        echo "  ❌ Service not running"
    fi
    echo

    # Performance metrics
    echo "📊 Performance Metrics:"
    HEALTH=$(curl -s http://localhost:3000/health/detailed 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "  Overall health: $(echo "$HEALTH" | jq -r '.overall // "unknown"')"
        echo "  Response time: $(echo "$HEALTH" | jq -r '.performance.avgResponseTime // "unknown"')ms"
        echo "  Memory usage: $(echo "$HEALTH" | jq -r '.checks[] | select(.name=="memory") | .message // "unknown"')"
    else
        echo "  ❌ Unable to fetch health metrics"
    fi
    echo

    # System resources
    echo "🖥️ System Resources:"
    echo "  CPU Load: $(uptime | awk -F'load average:' '{print $2}' | xargs)"
    echo "  Memory: $(free -h | grep Mem | awk '{print "Used: "$3" / Total: "$2" ("$3/$2*100"%)"}')"
    echo "  Disk: $(df -h / | tail -1 | awk '{print "Used: "$3" / Total: "$2" ("$5")"}')"
    echo

    # Network connections
    echo "🌐 Network Status:"
    echo "  Active connections: $(netstat -an | grep :3000 | grep ESTABLISHED | wc -l)"
    echo "  Listening ports: $(netstat -tlnp | grep claude-wrapper | wc -l)"
    echo

    # Recent alerts
    echo "🚨 Recent Alerts (last 5):"
    if [ -f "/var/log/claude-wrapper-alerts.log" ]; then
        tail -5 /var/log/claude-wrapper-alerts.log | while read line; do
            echo "  $line"
        done
    else
        echo "  No recent alerts"
    fi

    echo
    echo "Press Ctrl+C to exit | Refreshing in 10 seconds..."
    sleep 10
done
```

---

## Maintenance and Update Procedures

### Planned Maintenance

#### Maintenance Window Planning

```bash
#!/bin/bash
# maintenance-window.sh - Planned maintenance execution

MAINTENANCE_TYPE=$1  # update, patch, config, restart
MAINTENANCE_DURATION=${2:-30}  # Duration in minutes

if [ -z "$MAINTENANCE_TYPE" ]; then
    echo "Usage: $0 <type> [duration_minutes]"
    echo "Types: update, patch, config, restart"
    exit 1
fi

echo "=== Planned Maintenance Window ==="
echo "Type: $MAINTENANCE_TYPE"
echo "Duration: $MAINTENANCE_DURATION minutes"
echo "Start time: $(date)"
echo

# Pre-maintenance checks
echo "1. Pre-maintenance checks..."
./daily-health-check.sh > pre-maintenance-check.log
echo "   Health check completed"

# Backup current state
echo "2. Creating pre-maintenance backup..."
./backup-config.sh
echo "   Backup completed"

# Notify monitoring systems
echo "3. Notifying monitoring systems..."
send_alert "info" "Maintenance window started" "Type: $MAINTENANCE_TYPE, Duration: ${MAINTENANCE_DURATION}min"

# Execute maintenance based on type
case "$MAINTENANCE_TYPE" in
    "update")
        perform_update
        ;;
    "patch")
        perform_patch
        ;;
    "config")
        perform_config_update
        ;;
    "restart")
        perform_restart
        ;;
    *)
        echo "Unknown maintenance type: $MAINTENANCE_TYPE"
        exit 1
        ;;
esac

# Post-maintenance verification
echo "4. Post-maintenance verification..."
sleep 30  # Allow service to stabilize
./daily-health-check.sh > post-maintenance-check.log

# Compare pre and post maintenance
if diff pre-maintenance-check.log post-maintenance-check.log > /dev/null; then
    echo "   ✅ Service status unchanged (expected)"
else
    echo "   ⚠️ Service status changed, reviewing..."
    diff pre-maintenance-check.log post-maintenance-check.log
fi

# Verify service is healthy
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Service responding normally"
    send_alert "info" "Maintenance completed successfully" "Service verified healthy"
else
    echo "   ❌ Service health check failed"
    send_alert "critical" "Maintenance completed with issues" "Service health check failed"
fi

echo "=== Maintenance Window Completed ==="
echo "End time: $(date)"
```

#### Update Procedures

```bash
#!/bin/bash
# perform_update.sh - Application update procedure

perform_update() {
    echo "   Performing application update..."
    
    # Stop traffic (if using load balancer)
    # nginx -s reload  # Remove from load balancer
    
    # Create rollback point
    git tag "pre-update-$(date +%Y%m%d-%H%M%S)"
    
    # Pull latest code
    git fetch origin
    git pull origin main
    
    # Install dependencies
    npm ci --production
    
    # Build application
    npm run build
    
    # Database migrations (if applicable)
    # npm run migrate
    
    # Rolling restart (zero downtime)
    pm2 reload claude-wrapper --update-env
    
    # Verify update
    sleep 10
    if curl -f http://localhost:3000/health > /dev/null; then
        echo "   ✅ Update completed successfully"
    else
        echo "   ❌ Update verification failed, rolling back..."
        git reset --hard HEAD~1
        npm ci --production
        npm run build
        pm2 reload claude-wrapper --update-env
    fi
}

perform_patch() {
    echo "   Performing security patch..."
    
    # Update system packages
    apt update && apt upgrade -y
    
    # Update Node.js dependencies
    npm audit fix
    
    # Restart service
    pm2 restart claude-wrapper
}

perform_config_update() {
    echo "   Performing configuration update..."
    
    # Validate new configuration
    node -e "
    const config = require('./dist/utils/env').config;
    console.log('Configuration validated');
    " || {
        echo "   ❌ Configuration validation failed"
        return 1
    }
    
    # Apply configuration
    pm2 restart claude-wrapper --update-env
}

perform_restart() {
    echo "   Performing service restart..."
    
    # Graceful restart
    pm2 gracefulReload claude-wrapper
}
```

### Emergency Maintenance

#### Hot-fix Deployment

```bash
#!/bin/bash
# hotfix-deploy.sh - Emergency hot-fix deployment

HOTFIX_BRANCH=$1

if [ -z "$HOTFIX_BRANCH" ]; then
    echo "Usage: $0 <hotfix-branch>"
    exit 1
fi

echo "=== Emergency Hot-fix Deployment ==="
echo "Hot-fix branch: $HOTFIX_BRANCH"
echo "Deploy time: $(date)"
echo

# Create emergency backup
echo "1. Creating emergency backup..."
git tag "pre-hotfix-$(date +%Y%m%d-%H%M%S)"
./backup-config.sh

# Deploy hot-fix
echo "2. Deploying hot-fix..."
git fetch origin
git checkout "$HOTFIX_BRANCH"
npm ci --production
npm run build

# Test configuration
echo "3. Testing configuration..."
node -e "require('./dist/utils/env').config" || {
    echo "❌ Hot-fix configuration invalid, rolling back..."
    git checkout main
    npm ci --production
    npm run build
    exit 1
}

# Deploy with zero downtime
echo "4. Deploying with zero downtime..."
pm2 reload claude-wrapper --update-env

# Verify deployment
echo "5. Verifying deployment..."
sleep 15
if curl -f http://localhost:3000/health > /dev/null; then
    echo "✅ Hot-fix deployed successfully"
    send_alert "info" "Hot-fix deployed" "Branch: $HOTFIX_BRANCH"
else
    echo "❌ Hot-fix verification failed, rolling back..."
    git checkout main
    npm ci --production
    npm run build
    pm2 reload claude-wrapper --update-env
    send_alert "critical" "Hot-fix failed, rolled back" "Branch: $HOTFIX_BRANCH"
    exit 1
fi

echo "=== Hot-fix Deployment Completed ==="
```

---

## Command Reference

### Production Server Commands

```bash
# Server Management
claude-wrapper --production --health-monitoring          # Start production server
claude-wrapper --start --production --health-monitoring  # Start as daemon
claude-wrapper --stop                                    # Stop daemon
claude-wrapper --status                                  # Check status
claude-wrapper --restart                                 # Restart daemon
claude-wrapper --logs                                    # View logs

# Configuration
claude-wrapper --config-check                            # Validate configuration
claude-wrapper --version                                 # Show version
claude-wrapper --help                                    # Show help

# Debugging
claude-wrapper --debug                                   # Enable debug mode
claude-wrapper --verbose                                 # Verbose logging
```

### Health Check Commands

```bash
# Basic health checks
curl http://localhost:3000/health                        # Simple health
curl http://localhost:3000/health/detailed               # Detailed health
curl http://localhost:3000/health/system                 # System health (production)

# Kubernetes probes
curl http://localhost:3000/health/ready                  # Readiness probe
curl http://localhost:3000/health/live                   # Liveness probe

# Health monitoring
curl http://localhost:3000/v1/debug/system/health        # Debug health info
```

### PM2 Commands

```bash
# Process management
pm2 start ecosystem.config.js --env production          # Start cluster
pm2 stop claude-wrapper                                 # Stop all instances
pm2 restart claude-wrapper                              # Restart all instances
pm2 reload claude-wrapper --update-env                  # Zero-downtime restart
pm2 delete claude-wrapper                               # Delete all instances

# Scaling
pm2 scale claude-wrapper 5                              # Scale to 5 instances
pm2 scale claude-wrapper +2                             # Add 2 instances
pm2 scale claude-wrapper -1                             # Remove 1 instance

# Monitoring
pm2 status                                               # Process status
pm2 monit                                                # Real-time monitoring
pm2 logs claude-wrapper                                 # View logs
pm2 logs claude-wrapper --lines 100                     # Last 100 lines

# Maintenance
pm2 save                                                 # Save process list
pm2 resurrect                                           # Restore saved processes
pm2 startup                                             # Generate startup script
```

### Debug Commands

```bash
# Debug endpoints
curl http://localhost:3000/v1/debug/system/status       # System status
curl http://localhost:3000/v1/debug/system/ports        # Port status
curl http://localhost:3000/v1/debug/system/memory       # Memory usage
curl http://localhost:3000/v1/debug/system/sessions     # Session statistics

# Performance debugging
curl http://localhost:3000/v1/debug/performance         # Performance metrics
curl http://localhost:3000/v1/debug/compatibility       # Compatibility status

# Request debugging
curl -X POST http://localhost:3000/v1/debug/request \
  -H "Content-Type: application/json" \
  -d '{"analyze": true}'                                 # Analyze request
```

### Log Management Commands

```bash
# Log viewing
tail -f /var/log/claude-wrapper/application.log         # Follow logs
grep ERROR /var/log/claude-wrapper/application.log      # Find errors
journalctl -u claude-wrapper -f                         # System logs

# Log analysis
jq 'select(.level == "error")' /var/log/claude-wrapper/application.log | tail -10
jq 'select(.responseTime > 1000)' /var/log/claude-wrapper/application.log | tail -10

# Log rotation
logrotate -f /etc/logrotate.d/claude-wrapper            # Force rotation
```

### Backup Commands

```bash
# Configuration backup
./backup-config.sh                                      # Backup configuration
./backup-sessions.sh                                    # Backup session data

# Restore operations
./disaster-recovery.sh backup-file.tar.gz               # Full recovery
./rollback.sh 20250705-143022                          # Rollback to backup
```

### Monitoring Commands

```bash
# Resource monitoring
htop -p $(pgrep claude-wrapper)                        # Process monitoring
iotop -p $(pgrep claude-wrapper)                       # I/O monitoring
nethogs                                                # Network monitoring

# Performance monitoring
./performance-monitor.sh                               # Start performance monitoring
./capacity-dashboard.sh                               # Real-time dashboard

# Health monitoring
./health-monitor.sh                                   # Start health monitoring
```

---

## Best Practices and Recommendations

### Operational Excellence

#### Daily Operations

1. **Proactive Monitoring**
   - Check health endpoints every 5 minutes
   - Monitor resource usage trends
   - Review error logs daily
   - Validate backup completion

2. **Performance Optimization**
   - Monitor response times continuously
   - Track memory usage patterns
   - Optimize garbage collection settings
   - Regular performance baselines

3. **Security Vigilance**
   - Rotate API keys monthly
   - Monitor authentication failures
   - Keep dependencies updated
   - Regular security audits

#### Change Management

1. **Deployment Strategy**
   ```bash
   # Always use blue-green or rolling deployments
   pm2 reload claude-wrapper --update-env  # Zero downtime
   
   # Never use
   pm2 restart claude-wrapper  # Causes downtime
   ```

2. **Testing Protocol**
   - Test in staging environment first
   - Validate configuration before deployment
   - Always have rollback plan ready
   - Monitor for 30 minutes post-deployment

3. **Backup Strategy**
   - Daily configuration backups
   - Weekly full system backups
   - Test restore procedures monthly
   - Keep 30 days of backups

#### Monitoring Best Practices

1. **Alert Thresholds**
   ```bash
   # Conservative thresholds to avoid alert fatigue
   ERROR_RATE_THRESHOLD=5%       # Error rate per 5 minutes
   RESPONSE_TIME_THRESHOLD=2000  # 2 seconds
   MEMORY_THRESHOLD=80%          # 80% memory usage
   CPU_THRESHOLD=70%             # 70% CPU usage
   ```

2. **Health Check Strategy**
   - Monitor business logic, not just connectivity
   - Include dependency health checks
   - Use different endpoints for different probes
   - Implement circuit breakers

3. **Log Management**
   - Use structured logging (JSON)
   - Include correlation IDs
   - Log performance metrics
   - Regular log analysis

#### Capacity Planning

1. **Scaling Triggers**
   ```bash
   # Scale up when ANY of these conditions persist for 5+ minutes:
   # - CPU usage > 70%
   # - Memory usage > 80%
   # - Response time > 2 seconds
   # - Error rate > 5%
   ```

2. **Resource Planning**
   - Monitor usage trends weekly
   - Plan capacity 3 months ahead
   - Always have 50% headroom
   - Test scaling procedures regularly

#### Security Best Practices

1. **Authentication**
   - Use strong API keys (32+ characters)
   - Rotate keys monthly
   - Never log API keys
   - Use environment variables only

2. **Network Security**
   - Use reverse proxy (Nginx/Apache)
   - Enable SSL/TLS
   - Configure firewall properly
   - Regular security scans

3. **Access Control**
   - Principle of least privilege
   - Regular access reviews
   - Audit all administrative actions
   - Use strong passwords and 2FA

#### Incident Response

1. **Preparation**
   - Document all procedures
   - Regular drills and testing
   - Clear escalation paths
   - Pre-configured alerts

2. **Response**
   - Follow runbooks strictly
   - Communicate early and often
   - Document all actions taken
   - Focus on recovery first

3. **Post-Incident**
   - Conduct blameless post-mortems
   - Update runbooks and procedures
   - Implement preventive measures
   - Share learnings with team

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Service Won't Start

**Symptoms:**
- Service fails to start
- Port binding errors
- Configuration errors

**Diagnosis:**
```bash
# Check if port is already in use
netstat -tulpn | grep :3000

# Check configuration
claude-wrapper --config-check

# Check logs
pm2 logs claude-wrapper
journalctl -u claude-wrapper -n 50
```

**Solutions:**
```bash
# Kill process using port
kill $(lsof -t -i:3000)

# Use automatic port detection
claude-wrapper --production --health-monitoring  # Auto-finds available port

# Fix configuration
vim /opt/claude-wrapper/.env.production
claude-wrapper --config-check
```

#### High Memory Usage

**Symptoms:**
- Memory usage > 80%
- Application slowdown
- OOM (Out of Memory) errors

**Diagnosis:**
```bash
# Check memory usage
ps -p $(pgrep claude-wrapper) -o %mem,vsz,rss
curl http://localhost:3000/health/detailed | jq '.checks[] | select(.name=="memory")'

# Check for memory leaks
node --inspect=$(pgrep claude-wrapper)
```

**Solutions:**
```bash
# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=512"

# Force garbage collection
kill -SIGUSR1 $(pgrep claude-wrapper)

# Restart service
pm2 restart claude-wrapper
```

#### Authentication Failures

**Symptoms:**
- 401 Unauthorized responses
- Authentication errors in logs
- API key rejection

**Diagnosis:**
```bash
# Test authentication
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/v1/auth/status

# Check API key configuration
echo $API_KEY | wc -c  # Should be 32+ characters

# Check authentication logs
grep -i "auth" /var/log/claude-wrapper/application.log | tail -10
```

**Solutions:**
```bash
# Regenerate API key
generate_api_key 32
export API_KEY="new-generated-key"

# Update configuration
sed -i "s/API_KEY=.*/API_KEY=$API_KEY/" .env.production

# Restart service
pm2 restart claude-wrapper --update-env
```

#### Poor Performance

**Symptoms:**
- Slow response times
- High CPU usage
- Request timeouts

**Diagnosis:**
```bash
# Check performance metrics
curl http://localhost:3000/health/detailed | jq '.performance'

# Monitor real-time performance
htop -p $(pgrep claude-wrapper)

# Check for blocking operations
strace -p $(pgrep claude-wrapper) -e read,write
```

**Solutions:**
```bash
# Scale up instances
pm2 scale claude-wrapper +2

# Optimize configuration
export NODE_OPTIONS="--max-old-space-size=1024"

# Enable compression
echo "COMPRESSION_ENABLED=true" >> .env.production
pm2 restart claude-wrapper --update-env
```

#### Connection Issues

**Symptoms:**
- Connection refused errors
- Network timeouts
- Intermittent connectivity

**Diagnosis:**
```bash
# Test connectivity
telnet localhost 3000
curl -v http://localhost:3000/health

# Check network statistics
netstat -i
ss -tuln | grep :3000
```

**Solutions:**
```bash
# Check firewall
ufw status
iptables -L

# Restart networking
systemctl restart networking

# Check load balancer
nginx -t
systemctl status nginx
```

### Advanced Troubleshooting

#### Memory Leak Detection

```bash
#!/bin/bash
# memory-leak-detection.sh - Detect memory leaks

echo "Starting memory leak detection..."

# Baseline memory usage
BASELINE=$(ps -p $(pgrep claude-wrapper) -o rss --no-headers)
echo "Baseline memory: ${BASELINE}KB"

# Monitor for 30 minutes
for i in {1..30}; do
    sleep 60
    CURRENT=$(ps -p $(pgrep claude-wrapper) -o rss --no-headers)
    INCREASE=$((CURRENT - BASELINE))
    PERCENTAGE=$(echo "scale=2; $INCREASE * 100 / $BASELINE" | bc)
    
    echo "Minute $i: ${CURRENT}KB (+${INCREASE}KB, +${PERCENTAGE}%)"
    
    # Alert if memory increased by more than 50%
    if (( $(echo "$PERCENTAGE > 50" | bc -l) )); then
        echo "⚠️ Potential memory leak detected!"
        send_alert "warning" "Memory leak detected" "Memory increased by ${PERCENTAGE}%"
        break
    fi
done
```

#### Performance Profiling

```bash
#!/bin/bash
# performance-profile.sh - Profile application performance

echo "Starting performance profiling..."

# CPU profiling
node --prof dist/index.js &
PID=$!
sleep 300  # Profile for 5 minutes
kill $PID

# Process profile
node --prof-process isolate-*.log > cpu-profile.txt
echo "CPU profile saved to cpu-profile.txt"

# Memory profiling with heap snapshots
node --inspect-brk=9229 dist/index.js &
echo "Connect Chrome DevTools to localhost:9229 for memory profiling"
```

#### Network Diagnostics

```bash
#!/bin/bash
# network-diagnostics.sh - Comprehensive network diagnosis

echo "=== Network Diagnostics ==="

# Port connectivity
echo "1. Port connectivity:"
nc -zv localhost 3000 && echo "✅ Port 3000 accessible" || echo "❌ Port 3000 not accessible"

# DNS resolution
echo -e "\n2. DNS resolution:"
nslookup localhost

# Network interfaces
echo -e "\n3. Network interfaces:"
ip addr show

# Routing table
echo -e "\n4. Routing table:"
ip route show

# Active connections
echo -e "\n5. Active connections:"
ss -tuln | grep :3000

# Firewall rules
echo -e "\n6. Firewall status:"
ufw status verbose 2>/dev/null || iptables -L

# Load balancer health (if applicable)
echo -e "\n7. Load balancer health:"
curl -s http://localhost/health 2>/dev/null && echo "✅ Load balancer healthy" || echo "❌ Load balancer issues"
```

---

## Emergency Procedures

### Critical System Failure

#### Immediate Response (0-5 minutes)

1. **Assess Situation**
   ```bash
   # Quick system check
   ps aux | grep claude-wrapper
   curl -f http://localhost:3000/health
   systemctl status claude-wrapper
   ```

2. **Attempt Quick Recovery**
   ```bash
   # Try restart
   pm2 restart claude-wrapper
   
   # If that fails, try manual start
   claude-wrapper --production --health-monitoring &
   ```

3. **Escalate if Needed**
   ```bash
   # Send critical alert
   send_alert "critical" "System failure - immediate attention required" "Service unresponsive after restart attempts"
   ```

#### System Recovery (5-30 minutes)

1. **Detailed Diagnosis**
   ```bash
   # System resources
   free -h
   df -h
   top -n 1
   
   # Service logs
   tail -100 /var/log/claude-wrapper/application.log
   journalctl -u claude-wrapper -n 100
   
   # System logs
   dmesg | tail -20
   ```

2. **Progressive Recovery Steps**
   ```bash
   # Step 1: Clean restart
   pm2 delete claude-wrapper
   pm2 start ecosystem.config.js --env production
   
   # Step 2: Reset to known good state
   git reset --hard HEAD
   npm ci --production
   npm run build
   
   # Step 3: Restore from backup
   ./disaster-recovery.sh /backup/claude-wrapper/latest-backup.tar.gz
   ```

### Data Corruption

#### Detection and Response

```bash
#!/bin/bash
# data-corruption-response.sh - Handle data corruption

echo "=== Data Corruption Response ==="

# Stop service immediately
echo "1. Stopping service..."
pm2 stop claude-wrapper

# Check filesystem integrity
echo "2. Checking filesystem..."
fsck -n /dev/sda1  # Replace with your disk

# Backup corrupted state for analysis
echo "3. Backing up corrupted state..."
tar -czf /backup/corrupted-state-$(date +%Y%m%d-%H%M%S).tar.gz /opt/claude-wrapper

# Restore from last known good backup
echo "4. Restoring from backup..."
LATEST_BACKUP=$(ls -t /backup/claude-wrapper/claude-wrapper-config-*.tar.gz | head -1)
./disaster-recovery.sh "$LATEST_BACKUP"

# Verify restoration
echo "5. Verifying restoration..."
sleep 30
if curl -f http://localhost:3000/health > /dev/null; then
    echo "✅ Recovery successful"
    send_alert "info" "Data corruption recovery completed" "Service restored from backup"
else
    echo "❌ Recovery failed, escalating..."
    send_alert "critical" "Data corruption recovery failed" "Manual intervention required"
fi
```

### Security Incident

#### Immediate Containment

```bash
#!/bin/bash
# security-incident-response.sh - Security incident containment

echo "=== Security Incident Response ==="

# Isolate system
echo "1. Isolating system..."
# Block all external traffic except management
ufw --force enable
ufw default deny incoming
ufw allow from 192.168.1.0/24  # Allow management network only

# Stop service
echo "2. Stopping potentially compromised service..."
pm2 stop claude-wrapper

# Preserve evidence
echo "3. Preserving evidence..."
cp /var/log/claude-wrapper/*.log /tmp/incident-logs-$(date +%Y%m%d-%H%M%S)/
ps aux > /tmp/process-snapshot-$(date +%Y%m%d-%H%M%S).txt
netstat -tulpn > /tmp/network-snapshot-$(date +%Y%m%d-%H%M%S).txt

# Analyze for compromise
echo "4. Checking for signs of compromise..."
# Check for unauthorized files
find /opt/claude-wrapper -newer /opt/claude-wrapper/.env.production -type f

# Check for unauthorized processes
ps aux | grep -v "claude-wrapper\|node\|npm"

# Check for unauthorized network connections
netstat -tulpn | grep -v ":22\|:80\|:443\|:3000"

# Generate incident report
echo "5. Generating incident report..."
cat > /tmp/security-incident-$(date +%Y%m%d-%H%M%S).txt << EOF
Security Incident Report
Date: $(date)
Server: $(hostname)
Incident Type: [To be determined]

Initial Findings:
- Service status: Stopped for investigation
- Log preservation: Completed
- System isolation: Completed
- Evidence collection: Completed

Next Steps:
1. Forensic analysis of logs
2. Malware scan
3. Integrity verification
4. Clean restoration if needed

Contact: [Security team contact]
EOF

send_alert "critical" "Security incident detected" "System isolated, investigation in progress"
```

### Disaster Recovery Activation

#### Complete Site Failure

```bash
#!/bin/bash
# disaster-recovery-activation.sh - Activate disaster recovery site

DR_SITE_HOST="dr.yourdomain.com"
DR_BACKUP_PATH="/backup/claude-wrapper/latest"

echo "=== Disaster Recovery Activation ==="

# Verify DR site availability
echo "1. Verifying DR site availability..."
if ping -c 3 "$DR_SITE_HOST" > /dev/null; then
    echo "✅ DR site reachable"
else
    echo "❌ DR site unreachable - check network connectivity"
    exit 1
fi

# Transfer latest backup to DR site
echo "2. Transferring backup to DR site..."
scp /backup/claude-wrapper/claude-wrapper-config-latest.tar.gz \
    admin@$DR_SITE_HOST:/opt/recovery/

# Activate DR site
echo "3. Activating DR site..."
ssh admin@$DR_SITE_HOST "
cd /opt/recovery
./disaster-recovery.sh claude-wrapper-config-latest.tar.gz
"

# Update DNS to point to DR site
echo "4. Updating DNS (manual step required)..."
echo "   Update DNS A record for api.yourdomain.com to point to $DR_SITE_HOST"

# Verify DR site functionality
echo "5. Verifying DR site..."
sleep 60  # Allow DNS propagation
if curl -f http://$DR_SITE_HOST/health > /dev/null; then
    echo "✅ DR site activated successfully"
    send_alert "info" "DR site activated" "Service restored on DR infrastructure"
else
    echo "❌ DR site activation failed"
    send_alert "critical" "DR site activation failed" "Manual intervention required"
fi

echo "=== DR Activation Complete ==="
echo "Monitor DR site closely and prepare for failback when primary site is restored"
```

This comprehensive operations guide provides all the necessary procedures and tools for managing the Claude Wrapper production server infrastructure effectively. Regular practice of these procedures and maintaining up-to-date documentation will ensure smooth operations and quick resolution of any issues that may arise.