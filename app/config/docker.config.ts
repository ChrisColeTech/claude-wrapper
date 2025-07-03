/**
 * Phase 15A Docker Configuration Setup
 * Docker-optimized configuration for containerized deployment
 * Based on Python implementation Docker patterns
 */

/**
 * Docker-specific Configuration Interface
 * Optimized for containerized environments
 */
export interface DockerConfig {
  // Container Configuration
  container: {
    name: string;
    version: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    healthCheckRetries: number;
    shutdownGracePeriod: number;
  };

  // Resource Limits
  resources: {
    memoryLimit: string;
    cpuLimit: string;
    maxFileDescriptors: number;
    maxProcesses: number;
  };

  // Networking
  networking: {
    exposedPorts: number[];
    internalPort: number;
    enableIpv6: boolean;
    dnsConfig: string[];
  };

  // Volume Configuration
  volumes: {
    logsPath: string;
    configPath: string;
    dataPath: string;
    tempPath: string;
  };

  // Environment Configuration
  environment: {
    nodeEnv: string;
    timezone: string;
    locale: string;
    enableDebug: boolean;
  };
}

/**
 * Default Docker Configuration
 * Optimized for container deployment
 */
export const defaultDockerConfig: DockerConfig = {
  container: {
    name: process.env.CONTAINER_NAME || 'claude-wrapper',
    version: process.env.CONTAINER_VERSION || '1.0.0',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30', 10),
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5', 10),
    healthCheckRetries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3', 10),
    shutdownGracePeriod: parseInt(process.env.SHUTDOWN_GRACE_PERIOD || '15', 10)
  },

  resources: {
    memoryLimit: process.env.MEMORY_LIMIT || '512m',
    cpuLimit: process.env.CPU_LIMIT || '0.5',
    maxFileDescriptors: parseInt(process.env.MAX_FILE_DESCRIPTORS || '1024', 10),
    maxProcesses: parseInt(process.env.MAX_PROCESSES || '256', 10)
  },

  networking: {
    exposedPorts: [parseInt(process.env.PORT || '3000', 10)],
    internalPort: parseInt(process.env.INTERNAL_PORT || '3000', 10),
    enableIpv6: process.env.ENABLE_IPV6 === 'true',
    dnsConfig: process.env.DNS_CONFIG?.split(',') || ['8.8.8.8', '8.8.4.4']
  },

  volumes: {
    logsPath: process.env.LOGS_PATH || '/app/logs',
    configPath: process.env.CONFIG_PATH || '/app/config',
    dataPath: process.env.DATA_PATH || '/app/data',
    tempPath: process.env.TEMP_PATH || '/tmp'
  },

  environment: {
    nodeEnv: process.env.NODE_ENV || 'production',
    timezone: process.env.TZ || 'UTC',
    locale: process.env.LOCALE || 'en_US.UTF-8',
    enableDebug: process.env.DEBUG === 'true'
  }
};

/**
 * Docker Configuration Generator
 * Generates Docker-related configuration files
 */
export class DockerConfigGenerator {
  private config: DockerConfig;

  constructor(config?: Partial<DockerConfig>) {
    this.config = { ...defaultDockerConfig, ...config };
  }

  /**
   * Generate Dockerfile
   */
  generateDockerfile(): string {
    return `# Claude Wrapper Production Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S claude -u 1001

# Install production dependencies
RUN apk add --no-cache \\
    ca-certificates \\
    curl \\
    dumb-init \\
    && rm -rf /var/cache/apk/*

# Copy built application
COPY --from=builder --chown=claude:nodejs /app/dist ./dist
COPY --from=builder --chown=claude:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=claude:nodejs /app/package*.json ./

# Create required directories
RUN mkdir -p ${this.config.volumes.logsPath} ${this.config.volumes.dataPath} && \\
    chown -R claude:nodejs ${this.config.volumes.logsPath} ${this.config.volumes.dataPath}

# Set environment variables
ENV NODE_ENV=${this.config.environment.nodeEnv}
ENV TZ=${this.config.environment.timezone}
ENV LOCALE=${this.config.environment.locale}
ENV PORT=${this.config.networking.internalPort}

# Configure resource limits
ENV NODE_OPTIONS="--max-old-space-size=256"
RUN ulimit -n ${this.config.resources.maxFileDescriptors}

# Switch to non-root user
USER claude

# Expose port
EXPOSE ${this.config.networking.internalPort}

# Health check
HEALTHCHECK --interval=${this.config.container.healthCheckInterval}s \\
           --timeout=${this.config.container.healthCheckTimeout}s \\
           --retries=${this.config.container.healthCheckRetries} \\
           --start-period=10s \\
  CMD curl -f http://localhost:${this.config.networking.internalPort}/health || exit 1

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

# Add labels
LABEL maintainer="Claude Code Team"
LABEL version="${this.config.container.version}"
LABEL description="Claude Wrapper - OpenAI-compatible API for Claude Code"
LABEL org.opencontainers.image.source="https://github.com/anthropics/claude-wrapper"
`;
  }

  /**
   * Generate docker-compose.yml
   */
  generateDockerCompose(): string {
    return `# Claude Wrapper Docker Compose Configuration
version: '3.8'

services:
  claude-wrapper:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${this.config.container.name}
    restart: unless-stopped
    
    ports:
      - "${this.config.networking.exposedPorts[0]}:${this.config.networking.internalPort}"
    
    environment:
      - NODE_ENV=${this.config.environment.nodeEnv}
      - TZ=${this.config.environment.timezone}
      - PORT=${this.config.networking.internalPort}
      # Add your Claude authentication here:
      # - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      # OR for Bedrock:
      # - AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
      # - AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}
      # - CLAUDE_CODE_USE_BEDROCK=1
      # OR for Vertex AI:
      # - CLAUDE_CODE_USE_VERTEX=1
      # - GOOGLE_APPLICATION_CREDENTIALS=/app/config/service-account.json
    
    volumes:
      - ${this.config.container.name}-logs:${this.config.volumes.logsPath}
      - ${this.config.container.name}-data:${this.config.volumes.dataPath}
      - ./config:/app/config:ro
      # Uncomment for Vertex AI service account:
      # - ./service-account.json:/app/config/service-account.json:ro
    
    deploy:
      resources:
        limits:
          memory: ${this.config.resources.memoryLimit}
          cpus: '${this.config.resources.cpuLimit}'
        reservations:
          memory: 128m
          cpus: '0.1'
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${this.config.networking.internalPort}/health"]
      interval: ${this.config.container.healthCheckInterval}s
      timeout: ${this.config.container.healthCheckTimeout}s
      retries: ${this.config.container.healthCheckRetries}
      start_period: 10s
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    
    security_opt:
      - no-new-privileges:true
    
    networks:
      - claude-network

volumes:
  ${this.config.container.name}-logs:
    driver: local
  ${this.config.container.name}-data:
    driver: local

networks:
  claude-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
`;
  }

  /**
   * Generate .dockerignore
   */
  generateDockerIgnore(): string {
    return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
*.test.ts
*.spec.ts
tests/
__tests__/

# Development
.git/
.gitignore
README.md
.env*
!.env.production.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Build artifacts
dist/
build/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Temporary files
tmp/
temp/
`;
  }

  /**
   * Generate health check script
   */
  generateHealthCheck(): string {
    return `#!/bin/sh
# Health check script for Claude Wrapper container

set -e

# Configuration
HEALTH_URL="http://localhost:${this.config.networking.internalPort}/health"
TIMEOUT=${this.config.container.healthCheckTimeout}
MAX_RETRIES=${this.config.container.healthCheckRetries}

# Function to check health
check_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Health check attempt $attempt/$MAX_RETRIES..."
        
        # Use curl to check health endpoint
        if curl -sf --max-time $TIMEOUT "$HEALTH_URL" > /dev/null 2>&1; then
            echo "Health check passed"
            return 0
        fi
        
        echo "Health check failed (attempt $attempt)"
        attempt=$((attempt + 1))
        
        if [ $attempt -le $MAX_RETRIES ]; then
            sleep 1
        fi
    done
    
    echo "Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Run health check
check_health
`;
  }

  /**
   * Generate entrypoint script
   */
  generateEntrypoint(): string {
    return `#!/bin/sh
# Entrypoint script for Claude Wrapper container

set -e

# Configuration
SHUTDOWN_GRACE_PERIOD=${this.config.container.shutdownGracePeriod}
LOG_LEVEL=\${LOG_LEVEL:-info}

# Function to handle shutdown
shutdown_handler() {
    echo "Received shutdown signal, starting graceful shutdown..."
    
    # Send SIGTERM to Node.js process
    if [ ! -z "$NODE_PID" ]; then
        kill -TERM "$NODE_PID"
        
        # Wait for graceful shutdown
        local count=0
        while [ $count -lt $SHUTDOWN_GRACE_PERIOD ] && kill -0 "$NODE_PID" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$NODE_PID" 2>/dev/null; then
            echo "Force killing Node.js process after ${SHUTDOWN_GRACE_PERIOD}s"
            kill -KILL "$NODE_PID"
        fi
    fi
    
    echo "Graceful shutdown completed"
    exit 0
}

# Set up signal handlers
trap shutdown_handler SIGTERM SIGINT

# Validate environment
echo "Starting Claude Wrapper container..."
echo "Node.js version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Log level: $LOG_LEVEL"

# Create required directories
mkdir -p ${this.config.volumes.logsPath}
mkdir -p ${this.config.volumes.dataPath}

# Check if authentication is configured
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "WARNING: No authentication configured. Set ANTHROPIC_API_KEY, AWS credentials, or Google credentials."
fi

# Start the application
echo "Starting Claude Wrapper application..."
node dist/index.js &
NODE_PID=$!

# Wait for the application to exit
wait $NODE_PID
`;
  }

  /**
   * Generate Kubernetes deployment
   */
  generateKubernetesDeployment(): string {
    return `# Claude Wrapper Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${this.config.container.name}
  labels:
    app: ${this.config.container.name}
    version: ${this.config.container.version}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${this.config.container.name}
  template:
    metadata:
      labels:
        app: ${this.config.container.name}
        version: ${this.config.container.version}
    spec:
      serviceAccountName: ${this.config.container.name}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      
      containers:
      - name: ${this.config.container.name}
        image: ${this.config.container.name}:${this.config.container.version}
        ports:
        - containerPort: ${this.config.networking.internalPort}
          name: http
          protocol: TCP
        
        env:
        - name: NODE_ENV
          value: "${this.config.environment.nodeEnv}"
        - name: PORT
          value: "${this.config.networking.internalPort}"
        - name: TZ
          value: "${this.config.environment.timezone}"
        # Add authentication from secrets:
        # - name: ANTHROPIC_API_KEY
        #   valueFrom:
        #     secretKeyRef:
        #       name: claude-wrapper-secrets
        #       key: anthropic-api-key
        
        resources:
          limits:
            memory: ${this.config.resources.memoryLimit}
            cpu: ${this.config.resources.cpuLimit}
          requests:
            memory: 128Mi
            cpu: 100m
        
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: ${this.config.container.healthCheckInterval}
          timeoutSeconds: ${this.config.container.healthCheckTimeout}
          failureThreshold: ${this.config.container.healthCheckRetries}
        
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
        
        volumeMounts:
        - name: logs
          mountPath: ${this.config.volumes.logsPath}
        - name: data
          mountPath: ${this.config.volumes.dataPath}
        - name: tmp
          mountPath: ${this.config.volumes.tempPath}
      
      volumes:
      - name: logs
        emptyDir: {}
      - name: data
        emptyDir: {}
      - name: tmp
        emptyDir: {}
      
      terminationGracePeriodSeconds: ${this.config.container.shutdownGracePeriod}

---
apiVersion: v1
kind: Service
metadata:
  name: ${this.config.container.name}
  labels:
    app: ${this.config.container.name}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app: ${this.config.container.name}

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${this.config.container.name}
  labels:
    app: ${this.config.container.name}
`;
  }

  /**
   * Get current configuration
   */
  getConfig(): DockerConfig {
    return { ...this.config };
  }
}

// Export default instance
export const dockerConfig = new DockerConfigGenerator();

// Export utility functions
export const generateAllDockerFiles = (): Record<string, string> => {
  const generator = new DockerConfigGenerator();
  
  return {
    'Dockerfile': generator.generateDockerfile(),
    'docker-compose.yml': generator.generateDockerCompose(),
    '.dockerignore': generator.generateDockerIgnore(),
    'scripts/health-check.sh': generator.generateHealthCheck(),
    'scripts/entrypoint.sh': generator.generateEntrypoint(),
    'k8s/deployment.yaml': generator.generateKubernetesDeployment()
  };
};