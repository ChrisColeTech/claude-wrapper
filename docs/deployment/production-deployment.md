# Phase 3B Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Claude Wrapper to production environments. The system has been thoroughly tested and validated for production use with 100% Python feature parity.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **CPU**: Minimum 1 vCPU (2 vCPU recommended)
- **Storage**: Minimum 1GB available disk space
- **Network**: Outbound HTTPS access to Claude API providers

### Authentication Requirements

You must have ONE of the following authentication methods configured:

1. **Anthropic Direct**: `ANTHROPIC_API_KEY`
2. **AWS Bedrock**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLAUDE_CODE_USE_BEDROCK=1`
3. **Google Vertex AI**: `GOOGLE_APPLICATION_CREDENTIALS`, `CLAUDE_CODE_USE_VERTEX=1`
4. **Claude CLI**: Existing Claude CLI authentication

## Production Server Management Features

The claude-wrapper includes advanced production server management capabilities for enterprise deployments:

### Production Server Manager
- **Graceful startup with retry logic**: Automatic retry attempts with exponential backoff
- **Port conflict resolution**: Intelligent port management with reservation system
- **Health monitoring integration**: Real-time health checks and system monitoring
- **Resource management**: Proper cleanup and resource release on shutdown
- **Signal handling**: Comprehensive signal handling for graceful shutdowns

### Health Monitoring System
- **Multi-level health checks**: Memory, port availability, and system uptime monitoring
- **Performance tracking**: Response time monitoring and resource usage analytics
- **Alerting thresholds**: Configurable alert conditions and failure tracking
- **Detailed reporting**: Comprehensive health reports with status summaries

### Port Management System
- **Conflict detection**: Automatic detection and resolution of port conflicts
- **Port reservations**: Reserve ports to prevent conflicts during scaling
- **Dynamic allocation**: Find available ports within configurable ranges
- **Cleanup automation**: Automatic cleanup of expired port reservations

## Production Configuration

### Environment Variables

Create a `.env.production` file with the following configuration:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Authentication (choose ONE method)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
# OR for Bedrock:
# AWS_ACCESS_KEY_ID=your-aws-access-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret-key
# CLAUDE_CODE_USE_BEDROCK=1
# OR for Vertex AI:
# CLAUDE_CODE_USE_VERTEX=1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Security
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=true

# Performance
COMPRESSION_ENABLED=true
CACHE_ENABLED=true
SESSION_CLEANUP_INTERVAL=3600000

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
```

### Security Configuration

#### API Key Protection

For additional security, you can enable API key protection:

```bash
# Enable API key protection
API_KEY_PROTECTION=true
API_KEY=your-generated-api-key
```

When enabled, clients must include the API key in requests:

```bash
curl -H "Authorization: Bearer your-generated-api-key" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-3-sonnet-20240229","messages":[{"role":"user","content":"Hello"}]}' \
     http://your-server:3000/v1/chat/completions
```

#### CORS Configuration

Configure CORS for your domain:

```bash
# Restrict CORS to specific domains
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

#### Rate Limiting

Configure rate limiting to prevent abuse:

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100        # 100 requests
RATE_LIMIT_WINDOW=900000  # per 15 minutes
```

## Production Server Startup

### Enhanced Production Mode

The claude-wrapper provides production-grade server management through the `--production` flag:

```bash
# Start with production features enabled
claude-wrapper --production --health-monitoring --port 3000

# Or with environment variables
NODE_ENV=production claude-wrapper --health-monitoring
```

### Daemon Mode for Production

Run the server as a background daemon:

```bash
# Start daemon
claude-wrapper --start --production --health-monitoring

# Check status
claude-wrapper --status

# Stop daemon
claude-wrapper --stop
```

### Production Features Enabled

When using `--production` flag, the following features are automatically enabled:
- Production server manager with graceful startup/shutdown
- Enhanced error handling and retry logic
- Port conflict resolution and management
- Resource cleanup and memory optimization
- Comprehensive logging and monitoring
- Security hardening and rate limiting

## Deployment Methods

### Method 1: Direct Node.js Deployment

#### 1. Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Deploy the Application

```bash
# Clone and build
git clone https://github.com/your-org/claude-wrapper.git
cd claude-wrapper/app
npm install
npm run build

# Copy production configuration
cp .env.production.example .env.production
# Edit .env.production with your settings

# Start with production features enabled
NODE_ENV=production ./node_modules/.bin/claude-wrapper --production --health-monitoring

# Or with PM2 for better process management
pm2 start "./node_modules/.bin/claude-wrapper" --name "claude-wrapper" -- --production --health-monitoring
pm2 save
pm2 startup
```

#### 3. Configure Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name api.yourdomain.com;

    # SSL configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### Method 2: Docker Deployment

#### 1. Build Docker Image

```bash
# Build the image
docker build -t claude-wrapper:latest .

# Or use the provided docker-compose
docker-compose up -d
```

#### 2. Run with Docker

```bash
# Create network
docker network create claude-network

# Run the container
docker run -d \
  --name claude-wrapper \
  --network claude-network \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-api-key \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  claude-wrapper:latest
```

#### 3. Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  claude-wrapper:
    build: .
    container_name: claude-wrapper
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LOG_LEVEL=info
      - CORS_ORIGINS=https://yourdomain.com
    volumes:
      - ./logs:/app/logs
    command: ["./node_modules/.bin/claude-wrapper", "--production", "--health-monitoring"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/detailed"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 4. Production Docker Compose with Monitoring

```yaml
version: '3.8'
services:
  claude-wrapper:
    build: .
    container_name: claude-wrapper-prod
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics port
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LOG_LEVEL=info
      - CORS_ORIGINS=https://yourdomain.com
      - METRICS_ENABLED=true
      - METRICS_PORT=9090
      - HEALTH_CHECK_ENABLED=true
      - COMPRESSION_ENABLED=true
      - RATE_LIMIT_ENABLED=true
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    command: ["./node_modules/.bin/claude-wrapper", "--production", "--health-monitoring"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/detailed"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      - nginx
    networks:
      - claude-network

  nginx:
    image: nginx:alpine
    container_name: claude-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - claude-wrapper
    networks:
      - claude-network

networks:
  claude-network:
    driver: bridge
```

### Method 3: Kubernetes Deployment

#### 1. Create Kubernetes Manifests

```bash
# Apply the deployment
kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -l app=claude-wrapper
kubectl get services claude-wrapper
```

#### 2. Configure Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: claude-wrapper-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: claude-wrapper-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: claude-wrapper
            port:
              number: 80
```

### Method 4: Cloud Platform Deployment

#### AWS ECS Deployment

```json
{
  "family": "claude-wrapper",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "claude-wrapper",
      "image": "your-account.dkr.ecr.region.amazonaws.com/claude-wrapper:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "LOG_LEVEL", "value": "info"},
        {"name": "HEALTH_CHECK_ENABLED", "value": "true"},
        {"name": "METRICS_ENABLED", "value": "true"}
      ],
      "secrets": [
        {
          "name": "ANTHROPIC_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:claude-wrapper/api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/claude-wrapper",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "entryPoint": ["./node_modules/.bin/claude-wrapper"],
      "command": ["--production", "--health-monitoring"]
    }
  ]
}
```

#### Google Cloud Run Deployment

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: claude-wrapper
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/execution-environment: gen2
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/your-project/claude-wrapper:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-wrapper-secrets
              key: anthropic_api_key
        - name: LOG_LEVEL
          value: "info"
        - name: HEALTH_CHECK_ENABLED
          value: "true"
        - name: METRICS_ENABLED
          value: "true"
        args: ["--production", "--health-monitoring"]
        resources:
          requests:
            memory: "512Mi"
            cpu: "1000m"
          limits:
            memory: "1Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/detailed
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### Azure Container Instances

```yaml
apiVersion: 2021-03-01
location: eastus
name: claude-wrapper-group
properties:
  containers:
  - name: claude-wrapper
    properties:
      image: your-registry.azurecr.io/claude-wrapper:latest
      ports:
      - port: 3000
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: '3000'
      - name: LOG_LEVEL
        value: info
      - name: HEALTH_CHECK_ENABLED
        value: 'true'
      - name: METRICS_ENABLED
        value: 'true'
      - name: ANTHROPIC_API_KEY
        secureValue: your-api-key-here
      command: ["./node_modules/.bin/claude-wrapper", "--production", "--health-monitoring"]
      resources:
        requests:
          memoryInGB: 1.0
          cpu: 1.0
        limits:
          memoryInGB: 2.0
          cpu: 2.0
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /health/detailed
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 5
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 3000
```

## Advanced Production Features

### Production Server Management

The Production Server Manager provides enterprise-grade server lifecycle management:

```typescript
// Production server configuration
{
  port: number;                    // Server port
  host: string;                    // Bind address
  timeout: number;                 // Request timeout
  gracefulShutdownTimeout: number; // Shutdown timeout
  maxStartupAttempts: number;      // Startup retry attempts
  startupRetryDelay: number;       // Retry delay
  healthCheckEnabled: boolean;     // Enable health monitoring
  preflightChecks: boolean;        // Run preflight validation
}
```

### Port Management System

Advanced port conflict resolution and management:

```bash
# Configure port management
PORT_SCAN_RANGE_START=8000      # Start of scan range
PORT_SCAN_RANGE_END=8099        # End of scan range
PORT_RESERVATION_TIMEOUT=300000 # 5 minutes
PORT_MAX_RETRIES=5              # Maximum retry attempts
```

### Health Monitoring System

Comprehensive health monitoring with configurable thresholds:

```bash
# Health monitoring configuration
HEALTH_CHECK_INTERVAL=30000      # Check interval (30 seconds)
HEALTH_CHECK_TIMEOUT=5000        # Check timeout (5 seconds)
HEALTH_RETRY_ATTEMPTS=2          # Retry attempts
HEALTH_MEMORY_THRESHOLD=0.8      # Memory usage alert threshold (80%)
HEALTH_RESPONSE_TIME_THRESHOLD=1000  # Response time threshold (1 second)
HEALTH_FAILURE_THRESHOLD=3       # Consecutive failure threshold
```

## Monitoring and Observability

### Health Checks

The service provides multiple health check endpoints:

- **Simple Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed`
- **System Health**: `GET /health/system` (production mode only)
- **Readiness**: `GET /health/ready` (for Kubernetes)
- **Liveness**: `GET /health/live` (for Kubernetes)

### Metrics

Enable metrics collection:

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

Access metrics at: `http://localhost:9090/metrics`

### Logging

Configure structured logging:

```bash
LOG_LEVEL=info          # error, warn, info, debug
LOG_FORMAT=json         # json, simple
LOG_FILE=true           # Enable file logging
LOG_MAX_SIZE=20m        # Max log file size
LOG_MAX_FILES=5         # Number of log files to retain
```

### Alerting

Set up alerting thresholds:

```bash
ALERTING_ENABLED=true
UPTIME_THRESHOLD=0.99   # 99% uptime
```

## Performance Tuning

### Memory Optimization

```bash
# Node.js memory settings
NODE_OPTIONS="--max-old-space-size=512"

# Application settings
CACHE_TTL=300                    # 5 minutes
SESSION_CLEANUP_INTERVAL=3600000 # 1 hour
MAX_CONCURRENT_REQUESTS=1000
```

### Compression

Enable gzip compression:

```bash
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6  # Balance between speed and compression
```

### Connection Tuning

```bash
SERVER_TIMEOUT=30000        # 30 seconds
KEEP_ALIVE_TIMEOUT=5000     # 5 seconds
HEADERS_TIMEOUT=10000       # 10 seconds
BODY_PARSER_LIMIT=10mb      # Request size limit
```

## Security Hardening

### Network Security

1. **Firewall Configuration**:
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw deny 3000   # Block direct access to app
   ```

2. **SSL/TLS Configuration**:
   - Use strong SSL certificates
   - Enable HTTP/2
   - Configure secure headers

### Application Security

1. **API Key Rotation**:
   ```bash
   # Rotate API keys regularly
   SECRET_ROTATION_INTERVAL=86400000  # 24 hours
   ```

2. **Rate Limiting**:
   ```bash
   RATE_LIMIT_MAX=100              # Requests per window
   MAX_LOGIN_ATTEMPTS=5            # Failed auth attempts
   LOCKOUT_DURATION=900000         # 15 minutes
   ```

3. **Input Validation**:
   ```bash
   MAX_HEADER_SIZE=8192           # 8KB headers
   BODY_PARSER_LIMIT=10mb         # 10MB request limit
   ```

## Backup and Recovery

### Session Data

Sessions are stored in memory by default. For persistence:

```bash
SESSION_PERSISTENCE=true
DATA_PATH=/app/data  # Configure persistent storage
```

### Configuration Backup

```bash
# Backup configuration
cp .env.production /backup/claude-wrapper-config-$(date +%Y%m%d).env

# Backup logs
tar -czf /backup/claude-wrapper-logs-$(date +%Y%m%d).tar.gz logs/
```

### Disaster Recovery

1. **Automated Backups**:
   ```bash
   # Daily backup cron job
   0 2 * * * /backup/claude-wrapper-backup.sh
   ```

2. **Recovery Procedure**:
   ```bash
   # Stop service
   pm2 stop claude-wrapper
   
   # Restore configuration
   cp /backup/claude-wrapper-config-latest.env .env.production
   
   # Restart service
   pm2 start claude-wrapper
   ```

## Scaling

### Horizontal Scaling

```bash
# PM2 cluster mode
pm2 start ecosystem.config.js --env production -i max

# Docker swarm
docker service create \
  --name claude-wrapper \
  --replicas 3 \
  --publish 3000:3000 \
  claude-wrapper:latest

# Kubernetes
kubectl scale deployment claude-wrapper --replicas=3
```

### Load Balancing

```nginx
upstream claude-wrapper {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    location / {
        proxy_pass http://claude-wrapper;
    }
}
```

### Production Health Monitoring

When health monitoring is enabled (`--health-monitoring`), the system provides:

#### Real-time Health Reports
```bash
# Get comprehensive health status
curl http://localhost:3000/health/detailed

# Example response
{
  "overall": "healthy",
  "uptime": 3600000,
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
  },
  "performance": {
    "avgResponseTime": 15.5,
    "memoryUsage": {
      "rss": 47185920,
      "heapTotal": 67108864,
      "heapUsed": 47456032
    }
  }
}
```

#### Custom Health Check Registration
```typescript
// Register custom health checks in production
healthMonitor.registerHealthCheck('database', async () => {
  // Your custom health check logic
  return {
    name: 'database',
    status: 'healthy',
    message: 'Database connection active',
    duration: 10,
    timestamp: new Date()
  };
});
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   ```bash
   # Check auth configuration
   curl http://localhost:3000/v1/auth/status
   
   # Verify environment variables
   echo $ANTHROPIC_API_KEY | head -c 10
   ```

2. **Memory Issues**:
   ```bash
   # Monitor memory usage with production health monitoring
   curl http://localhost:3000/health/detailed
   
   # Check specific memory health check
   curl http://localhost:3000/health/detailed | jq '.checks[] | select(.name=="memory")'
   
   # Check Node.js memory
   node --max-old-space-size=512 dist/index.js
   ```

3. **Port Conflicts**:
   ```bash
   # Production mode automatically resolves port conflicts
   # Check port management status
   curl http://localhost:3000/health/detailed | jq '.checks[] | select(.name=="server-port")'
   
   # Manual port availability check
   netstat -tulpn | grep :3000
   ```

4. **Performance Issues**:
   ```bash
   # Check production metrics
   curl http://localhost:9090/metrics
   
   # Monitor response times with health monitoring
   curl http://localhost:3000/health/detailed | jq '.performance'
   
   # Traditional response time check
   curl -w "@curl-format.txt" http://localhost:3000/health
   ```

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug
VERBOSE_LOGGING=true
DEBUG_ENDPOINTS=true  # Only in non-production
```

## Maintenance

### Updates

```bash
# Backup current deployment
pm2 save

# Pull updates
git pull origin main
npm install
npm run build

# Restart with zero downtime
pm2 reload claude-wrapper
```

### Health Monitoring

```bash
# Check service status
pm2 status

# Monitor logs
pm2 logs claude-wrapper --lines 100

# Health check
curl http://localhost:3000/health
```

### Performance Monitoring

```bash
# Check metrics
curl http://localhost:3000/health/detailed | jq '.system.metrics'

# Monitor resource usage
top -p $(pgrep -f "claude-wrapper")
```

## Production Operations

### Server Lifecycle Management

The production server manager provides comprehensive lifecycle management:

```bash
# Check production server health status
curl http://localhost:3000/health/detailed | jq '.checks[] | select(.name=="server-port")'

# Monitor startup performance
grep "Production server started" /var/log/claude-wrapper.log

# Check graceful shutdown logs
grep "Production server shutdown" /var/log/claude-wrapper.log
```

### Production Scaling

#### Horizontal Scaling with Load Balancing
```bash
# Start multiple instances with production features
claude-wrapper --production --health-monitoring --port 3001 &
claude-wrapper --production --health-monitoring --port 3002 &
claude-wrapper --production --health-monitoring --port 3003 &

# Configure Nginx load balancer
upstream claude-wrapper-cluster {
    server localhost:3001 max_fails=3 fail_timeout=30s;
    server localhost:3002 max_fails=3 fail_timeout=30s;
    server localhost:3003 max_fails=3 fail_timeout=30s;
    
    # Health checks
    health_check interval=10s fails=3 passes=2;
}
```

#### PM2 Cluster Mode with Production Features
```bash
# PM2 ecosystem file for production clustering
module.exports = {
  apps: [{
    name: 'claude-wrapper-cluster',
    script: './node_modules/.bin/claude-wrapper',
    args: '--production --health-monitoring',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};

# Start cluster
pm2 start ecosystem.config.js
```

### Production Monitoring Dashboard

Create a monitoring dashboard for production operations:

```bash
#!/bin/bash
# production-monitor.sh - Production monitoring script

echo "=== Claude Wrapper Production Status ==="
echo "Timestamp: $(date)"
echo

# Health check
echo "🏥 Health Status:"
HEALTH=$(curl -s http://localhost:3000/health/detailed)
echo "$HEALTH" | jq -r '.overall // "unavailable"'
echo

# Memory usage
echo "💾 Memory Usage:"
echo "$HEALTH" | jq -r '.checks[] | select(.name=="memory") | .message // "unavailable"'
echo

# Port status
echo "🌐 Port Status:"
echo "$HEALTH" | jq -r '.checks[] | select(.name=="server-port") | .message // "unavailable"'
echo

# Performance metrics
echo "⚡ Performance:"
echo "$HEALTH" | jq -r '.performance | "Avg Response Time: \(.avgResponseTime)ms"'
echo

# Process status
echo "🔄 Process Status:"
if pgrep -f "claude-wrapper" > /dev/null; then
    echo "✅ Running (PID: $(pgrep -f claude-wrapper))"
else
    echo "❌ Not running"
fi
echo

# Recent logs
echo "📝 Recent Activity:"
tail -5 /var/log/claude-wrapper.log 2>/dev/null || echo "No logs available"
```

### Automated Production Operations

#### Health Check Automation
```bash
#!/bin/bash
# health-check-automation.sh - Automated health monitoring

HEALTH_URL="http://localhost:3000/health/detailed"
ALERT_WEBHOOK="https://your-webhook-url.com/alert"

# Get health status
HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
OVERALL_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.overall // "unknown"')

# Alert on unhealthy status
if [ "$OVERALL_STATUS" != "healthy" ]; then
    MESSAGE="⚠️ Claude Wrapper health check failed: $OVERALL_STATUS"
    curl -X POST "$ALERT_WEBHOOK" -H "Content-Type: application/json" \
         -d "{\"text\": \"$MESSAGE\", \"details\": $HEALTH_RESPONSE}"
fi

# Log status
echo "$(date): Health status: $OVERALL_STATUS" >> /var/log/claude-wrapper-health.log
```

#### Automatic Restart on Failure
```bash
#!/bin/bash
# auto-restart.sh - Automatic restart on failure

HEALTH_URL="http://localhost:3000/health"
MAX_FAILURES=3
FAILURE_COUNT=0

while true; do
    if ! curl -f -s "$HEALTH_URL" > /dev/null; then
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        echo "$(date): Health check failed ($FAILURE_COUNT/$MAX_FAILURES)"
        
        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            echo "$(date): Restarting claude-wrapper due to repeated failures"
            pm2 restart claude-wrapper
            FAILURE_COUNT=0
        fi
    else
        FAILURE_COUNT=0
    fi
    
    sleep 30
done
```

## Production Checklist

### Pre-Deployment
- [ ] Authentication configured and tested
- [ ] SSL/TLS certificates installed and valid
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS configured for your domain
- [ ] Production server manager tested
- [ ] Health monitoring system validated
- [ ] Port management configured

### Deployment
- [ ] Production mode enabled (`--production` flag)
- [ ] Health monitoring enabled (`--health-monitoring` flag)
- [ ] Logging configured and rotated
- [ ] Monitoring and alerting set up
- [ ] Health checks responding correctly
- [ ] Load balancing configured (if applicable)
- [ ] Graceful shutdown tested

### Post-Deployment
- [ ] Backup procedures in place
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Team trained on operations
- [ ] Monitoring dashboard setup
- [ ] Automated health checks configured
- [ ] Auto-restart mechanisms tested

## Support

For production support and questions:

1. **Health Checks**: Monitor `/health` endpoint
2. **Logs**: Check application logs in `/app/logs`
3. **Metrics**: Review metrics at `/metrics` endpoint
4. **Debug**: Use `/v1/debug/request` for request analysis

## Quick Start for Production

For immediate production deployment, use the following commands:

```bash
# 1. Install and build
npm install && npm run build

# 2. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your settings

# 3. Start in production mode with all features
claude-wrapper --production --health-monitoring

# 4. Verify deployment
curl http://localhost:3000/health/detailed
```

## Documentation Summary

This production deployment guide covers:

- **Enhanced Production Features**: Production server manager, health monitoring, and port management
- **Multiple Deployment Methods**: Direct Node.js, Docker, Kubernetes, and cloud platforms (AWS, GCP, Azure)
- **Security Configuration**: Authentication, CORS, rate limiting, and SSL/TLS setup
- **Monitoring & Observability**: Comprehensive health checks, metrics, and alerting
- **Operations & Scaling**: Horizontal scaling, load balancing, and automated operations
- **Troubleshooting**: Common issues, debugging techniques, and production monitoring

The Claude Wrapper is now ready for production deployment with enterprise-grade reliability, performance, and comprehensive monitoring capabilities for Phase 3B requirements.