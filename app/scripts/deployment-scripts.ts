/**
 * Phase 15A Deployment Scripts
 * Automated deployment scripts for production deployment
 * Based on Python implementation deployment patterns
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getProductionConfig, ProductionConfigManager } from '../config/production.config';
import { generateAllDockerFiles } from '../config/docker.config';

/**
 * Deployment Configuration
 */
export interface DeploymentConfig {
  environment: 'production' | 'staging' | 'development';
  method: 'docker' | 'kubernetes' | 'pm2' | 'systemd';
  buildVersion: string;
  registry?: string;
  namespace?: string;
  replicas?: number;
  resources?: {
    memory: string;
    cpu: string;
  };
}

/**
 * Deployment Manager
 * Handles automated deployment of Claude Wrapper
 */
export class DeploymentManager {
  private config: DeploymentConfig;
  private projectRoot: string;

  constructor(config: DeploymentConfig, projectRoot: string = process.cwd()) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Execute full deployment pipeline
   */
  async deploy(): Promise<void> {
    console.log(`🚀 Starting deployment for ${this.config.environment} environment`);
    
    try {
      // Pre-deployment checks
      await this.preDeploymentChecks();
      
      // Build application
      await this.buildApplication();
      
      // Run tests
      await this.runTests();
      
      // Generate deployment files
      await this.generateDeploymentFiles();
      
      // Deploy based on method
      switch (this.config.method) {
        case 'docker':
          await this.deployDocker();
          break;
        case 'kubernetes':
          await this.deployKubernetes();
          break;
        case 'pm2':
          await this.deployPM2();
          break;
        case 'systemd':
          await this.deploySystemd();
          break;
        default:
          throw new Error(`Unsupported deployment method: ${this.config.method}`);
      }
      
      // Post-deployment verification
      await this.postDeploymentVerification();
      
      console.log('✅ Deployment completed successfully!');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Pre-deployment checks
   */
  private async preDeploymentChecks(): Promise<void> {
    console.log('🔍 Running pre-deployment checks...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
      console.warn(`⚠️  Node.js version ${nodeVersion} may not be optimal. Recommended: v18.x or v20.x`);
    }
    
    // Check required files
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts'
    ];
    
    for (const file of requiredFiles) {
      if (!existsSync(join(this.projectRoot, file))) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    // Check environment configuration
    if (this.config.environment === 'production') {
      const prodConfig = getProductionConfig();
      if (!prodConfig.authentication.enabled) {
        console.warn('⚠️  Authentication is disabled in production config');
      }
    }
    
    console.log('✅ Pre-deployment checks passed');
  }

  /**
   * Build application
   */
  private async buildApplication(): Promise<void> {
    console.log('🔨 Building application...');
    
    try {
      // Install dependencies
      execSync('npm ci', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      
      // Build TypeScript
      execSync('npm run build', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      
      // Verify build output
      if (!existsSync(join(this.projectRoot, 'dist/index.js'))) {
        throw new Error('Build output not found');
      }
      
      console.log('✅ Application built successfully');
      
    } catch (error) {
      throw new Error(`Build failed: ${error}`);
    }
  }

  /**
   * Run tests
   */
  private async runTests(): Promise<void> {
    console.log('🧪 Running tests...');
    
    try {
      // Run unit tests
      execSync('npm test -- --passWithNoTests', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      
      // Run type checking
      execSync('npm run type-check', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      
      // Run linting
      execSync('npm run lint', { 
        cwd: this.projectRoot, 
        stdio: 'inherit' 
      });
      
      console.log('✅ All tests passed');
      
    } catch (error) {
      throw new Error(`Tests failed: ${error}`);
    }
  }

  /**
   * Generate deployment files
   */
  private async generateDeploymentFiles(): Promise<void> {
    console.log('📝 Generating deployment files...');
    
    // Create deployment directory
    const deploymentDir = join(this.projectRoot, 'deployment');
    if (!existsSync(deploymentDir)) {
      mkdirSync(deploymentDir, { recursive: true });
    }
    
    // Generate production configuration
    const configManager = new ProductionConfigManager();
    const prodTemplate = ProductionConfigManager.createProductionTemplate();
    writeFileSync(
      join(deploymentDir, '.env.production.example'),
      prodTemplate
    );
    
    // Generate Docker files
    const dockerFiles = generateAllDockerFiles();
    for (const [filename, content] of Object.entries(dockerFiles)) {
      const filepath = join(this.projectRoot, filename);
      const dir = filepath.substring(0, filepath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filepath, content);
    }
    
    // Generate PM2 ecosystem file
    this.generatePM2Config();
    
    // Generate systemd service file
    this.generateSystemdService();
    
    console.log('✅ Deployment files generated');
  }

  /**
   * Generate PM2 configuration
   */
  private generatePM2Config(): void {
    const pm2Config = {
      apps: [{
        name: 'claude-wrapper',
        script: 'dist/index.js',
        cwd: this.projectRoot,
        instances: this.config.replicas || 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'development',
          PORT: 3000
        },
        env_production: {
          NODE_ENV: 'production',
          PORT: 3000
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true,
        watch: false,
        max_memory_restart: this.config.resources?.memory || '512M',
        restart_delay: 4000,
        max_restarts: 10,
        min_uptime: '10s'
      }]
    };
    
    writeFileSync(
      join(this.projectRoot, 'ecosystem.config.js'),
      `module.exports = ${JSON.stringify(pm2Config, null, 2)};`
    );
  }

  /**
   * Generate systemd service file
   */
  private generateSystemdService(): void {
    const serviceContent = `[Unit]
Description=Claude Wrapper - OpenAI-compatible API for Claude Code
Documentation=https://github.com/anthropics/claude-wrapper
After=network.target

[Service]
Type=simple
User=claude-wrapper
WorkingDirectory=${this.projectRoot}
Environment=NODE_ENV=${this.config.environment}
Environment=PORT=3000
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
TimeoutStopSec=30
KillMode=process
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claude-wrapper

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.projectRoot}/logs ${this.projectRoot}/data

# Resource limits
LimitNOFILE=65536
MemoryMax=${this.config.resources?.memory || '512M'}

[Install]
WantedBy=multi-user.target
`;
    
    writeFileSync(
      join(this.projectRoot, 'deployment/claude-wrapper.service'),
      serviceContent
    );
  }

  /**
   * Deploy using Docker
   */
  private async deployDocker(): Promise<void> {
    console.log('🐳 Deploying with Docker...');
    
    try {
      // Build Docker image
      const imageName = `claude-wrapper:${this.config.buildVersion}`;
      execSync(`docker build -t ${imageName} .`, {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      
      // Tag for registry if specified
      if (this.config.registry) {
        const registryImage = `${this.config.registry}/${imageName}`;
        execSync(`docker tag ${imageName} ${registryImage}`, {
          stdio: 'inherit'
        });
        
        // Push to registry
        execSync(`docker push ${registryImage}`, {
          stdio: 'inherit'
        });
      }
      
      // Deploy with docker-compose
      execSync('docker-compose up -d', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      
      console.log('✅ Docker deployment completed');
      
    } catch (error) {
      throw new Error(`Docker deployment failed: ${error}`);
    }
  }

  /**
   * Deploy using Kubernetes
   */
  private async deployKubernetes(): Promise<void> {
    console.log('☸️  Deploying with Kubernetes...');
    
    try {
      // Apply Kubernetes manifests
      if (this.config.namespace) {
        execSync(`kubectl create namespace ${this.config.namespace} --dry-run=client -o yaml | kubectl apply -f -`, {
          stdio: 'inherit'
        });
      }
      
      const kubectlCmd = this.config.namespace 
        ? `kubectl apply -f k8s/ -n ${this.config.namespace}`
        : 'kubectl apply -f k8s/';
      
      execSync(kubectlCmd, {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      
      // Wait for deployment to be ready
      const deploymentName = this.config.namespace
        ? `deployment/claude-wrapper -n ${this.config.namespace}`
        : 'deployment/claude-wrapper';
      
      execSync(`kubectl rollout status ${deploymentName} --timeout=300s`, {
        stdio: 'inherit'
      });
      
      console.log('✅ Kubernetes deployment completed');
      
    } catch (error) {
      throw new Error(`Kubernetes deployment failed: ${error}`);
    }
  }

  /**
   * Deploy using PM2
   */
  private async deployPM2(): Promise<void> {
    console.log('🔧 Deploying with PM2...');
    
    try {
      // Stop existing processes
      try {
        execSync('pm2 stop claude-wrapper', { stdio: 'inherit' });
      } catch {
        // Ignore if not running
      }
      
      // Start with PM2
      execSync(`pm2 start ecosystem.config.js --env ${this.config.environment}`, {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      
      // Save PM2 configuration
      execSync('pm2 save', { stdio: 'inherit' });
      
      console.log('✅ PM2 deployment completed');
      
    } catch (error) {
      throw new Error(`PM2 deployment failed: ${error}`);
    }
  }

  /**
   * Deploy using systemd
   */
  private async deploySystemd(): Promise<void> {
    console.log('⚙️  Deploying with systemd...');
    
    try {
      // Copy service file
      execSync('sudo cp deployment/claude-wrapper.service /etc/systemd/system/', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      
      // Reload systemd
      execSync('sudo systemctl daemon-reload', { stdio: 'inherit' });
      
      // Enable and start service
      execSync('sudo systemctl enable claude-wrapper', { stdio: 'inherit' });
      execSync('sudo systemctl restart claude-wrapper', { stdio: 'inherit' });
      
      console.log('✅ systemd deployment completed');
      
    } catch (error) {
      throw new Error(`systemd deployment failed: ${error}`);
    }
  }

  /**
   * Post-deployment verification
   */
  private async postDeploymentVerification(): Promise<void> {
    console.log('🔍 Running post-deployment verification...');
    
    // Wait for service to start
    await this.sleep(10000);
    
    try {
      // Check health endpoint
      const healthCheck = await this.checkHealth();
      if (!healthCheck) {
        throw new Error('Health check failed');
      }
      
      // Verify API endpoints
      await this.verifyEndpoints();
      
      console.log('✅ Post-deployment verification passed');
      
    } catch (error) {
      throw new Error(`Post-deployment verification failed: ${error}`);
    }
  }

  /**
   * Check service health
   */
  private async checkHealth(): Promise<boolean> {
    const maxRetries = 5;
    const retryDelay = 5000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch('http://localhost:3000/health');
        if (response.ok) {
          const health = await response.json();
          console.log('✅ Health check passed:', health.status);
          return true;
        }
      } catch (error) {
        console.log(`Health check attempt ${i + 1}/${maxRetries} failed:`, error);
        if (i < maxRetries - 1) {
          await this.sleep(retryDelay);
        }
      }
    }
    
    return false;
  }

  /**
   * Verify API endpoints
   */
  private async verifyEndpoints(): Promise<void> {
    const endpoints = [
      '/health',
      '/v1/models',
      '/v1/auth/status'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3000${endpoint}`);
        if (!response.ok) {
          throw new Error(`Endpoint ${endpoint} returned status ${response.status}`);
        }
        console.log(`✅ Endpoint ${endpoint} verified`);
      } catch (error) {
        throw new Error(`Endpoint verification failed for ${endpoint}: ${error}`);
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Rollback deployment
   */
  async rollback(previousVersion?: string): Promise<void> {
    console.log('🔄 Rolling back deployment...');
    
    try {
      switch (this.config.method) {
        case 'docker':
          if (previousVersion) {
            execSync(`docker-compose down && docker-compose up -d claude-wrapper:${previousVersion}`, {
              cwd: this.projectRoot,
              stdio: 'inherit'
            });
          }
          break;
        case 'kubernetes':
          execSync('kubectl rollout undo deployment/claude-wrapper', {
            stdio: 'inherit'
          });
          break;
        case 'pm2':
          execSync('pm2 restart claude-wrapper', {
            stdio: 'inherit'
          });
          break;
        case 'systemd':
          execSync('sudo systemctl restart claude-wrapper', {
            stdio: 'inherit'
          });
          break;
      }
      
      console.log('✅ Rollback completed');
      
    } catch (error) {
      throw new Error(`Rollback failed: ${error}`);
    }
  }
}

/**
 * CLI interface for deployment
 */
export async function deployFromCLI(): Promise<void> {
  const args = process.argv.slice(2);
  const environment = args[0] || 'production';
  const method = args[1] || 'docker';
  const version = args[2] || `v${Date.now()}`;
  
  const config: DeploymentConfig = {
    environment: environment as any,
    method: method as any,
    buildVersion: version,
    replicas: 3,
    resources: {
      memory: '512M',
      cpu: '0.5'
    }
  };
  
  const deployer = new DeploymentManager(config);
  await deployer.deploy();
}

// Export for script usage
if (require.main === module) {
  deployFromCLI().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}