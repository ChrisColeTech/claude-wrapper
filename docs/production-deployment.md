# Phase 15A Production Deployment Guide

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

# Start with PM2
pm2 start ecosystem.config.js --env production
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
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

## Monitoring and Observability

### Health Checks

The service provides multiple health check endpoints:

- **Simple Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed`
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
   # Monitor memory usage
   curl http://localhost:3000/health/detailed
   
   # Check Node.js memory
   node --max-old-space-size=512 dist/index.js
   ```

3. **Performance Issues**:
   ```bash
   # Check metrics
   curl http://localhost:9090/metrics
   
   # Monitor response times
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

## Production Checklist

- [ ] Authentication configured and tested
- [ ] SSL/TLS certificates installed and valid
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS configured for your domain
- [ ] Logging configured and rotated
- [ ] Monitoring and alerting set up
- [ ] Health checks responding correctly
- [ ] Backup procedures in place
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Team trained on operations

## Support

For production support and questions:

1. **Health Checks**: Monitor `/health` endpoint
2. **Logs**: Check application logs in `/app/logs`
3. **Metrics**: Review metrics at `/metrics` endpoint
4. **Debug**: Use `/v1/debug/request` for request analysis

The Claude Wrapper is now ready for production deployment with enterprise-grade reliability and performance.