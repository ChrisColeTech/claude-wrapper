#!/usr/bin/env node
/**
 * Comprehensive Health Check Script
 * Runs all diagnostic commands in sequence for complete system health validation
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class HealthChecker {
  constructor(mode = 'full') {
    this.mode = mode; // 'full', 'daily', 'quick'
    this.healthResults = {
      timestamp: new Date().toISOString(),
      mode: mode,
      checks: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        skippedChecks: 0
      },
      recommendations: [],
      overallHealth: 'unknown'
    };
  }

  async runCheck(name, command, description, required = true) {
    console.log(`🔍 ${name}...`);
    
    const check = {
      name: name,
      command: command,
      description: description,
      required: required,
      status: 'unknown',
      duration: 0,
      output: '',
      error: null
    };

    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        cwd: path.join(__dirname, '../../..'),
        timeout: 30000 // 30 second timeout
      });
      
      check.duration = Date.now() - startTime;
      check.output = stdout;
      
      if (stderr && stderr.trim()) {
        check.error = stderr;
        check.status = 'warning';
        console.log(`  ⚠️ ${name}: Warning (${check.duration}ms)`);
      } else {
        check.status = 'pass';
        console.log(`  ✅ ${name}: Pass (${check.duration}ms)`);
      }
      
    } catch (error) {
      check.duration = Date.now() - startTime;
      check.error = error.message;
      check.status = required ? 'fail' : 'skip';
      
      if (required) {
        console.log(`  ❌ ${name}: Fail (${check.duration}ms)`);
      } else {
        console.log(`  ⏭️ ${name}: Skipped (${check.duration}ms)`);
      }
    }
    
    this.healthResults.checks.push(check);
    this.healthResults.summary.totalChecks++;
    
    if (check.status === 'pass' || check.status === 'warning') {
      this.healthResults.summary.passedChecks++;
    } else if (check.status === 'fail') {
      this.healthResults.summary.failedChecks++;
    } else {
      this.healthResults.summary.skippedChecks++;
    }
  }

  async runQuickHealthCheck() {
    console.log('🚀 Running Quick Health Check...');
    
    // Essential checks only
    await this.runCheck(
      'Singleton Audit',
      'npm run audit:singletons',
      'Check singleton pattern compliance'
    );
    
    await this.runCheck(
      'Response Schema Validation',
      'npm run test:response:schema',
      'Validate error response schemas'
    );
    
    await this.runCheck(
      'Build Check',
      'npm run build',
      'Verify TypeScript compilation'
    );
  }

  async runDailyHealthCheck() {
    console.log('🚀 Running Daily Health Check...');
    
    // Core system checks
    await this.runCheck(
      'Singleton Audit',
      'npm run audit:singletons',
      'Check singleton pattern compliance'
    );
    
    await this.runCheck(
      'Response Schema Validation',
      'npm run test:response:schema',
      'Validate error response schemas'
    );
    
    await this.runCheck(
      'Response Format Comparison',
      'npm run test:response:compare',
      'Compare expected vs actual response formats'
    );
    
    await this.runCheck(
      'API Contract Validation',
      'npm run test:contract:validation',
      'Validate API endpoints and contracts',
      false // Optional for daily
    );
    
    await this.runCheck(
      'Statistics Tracking Debug',
      'npm run debug:statistics-tracking',
      'Debug error statistics accumulation'
    );
    
    await this.runCheck(
      'Build Check',
      'npm run build',
      'Verify TypeScript compilation'
    );
    
    await this.runCheck(
      'Lint Check',
      'npm run lint',
      'Check code style and quality'
    );
    
    await this.runCheck(
      'Type Check',
      'npm run type-check',
      'Verify TypeScript type safety'
    );
  }

  async runFullHealthCheck() {
    console.log('🚀 Running Full Health Check...');
    
    // Comprehensive system validation
    await this.runCheck(
      'Singleton Audit',
      'npm run audit:singletons',
      'Check singleton pattern compliance'
    );
    
    await this.runCheck(
      'Response Schema Validation',
      'npm run test:response:schema',
      'Validate error response schemas'
    );
    
    await this.runCheck(
      'Response Format Comparison',
      'npm run test:response:compare',
      'Compare expected vs actual response formats'
    );
    
    await this.runCheck(
      'API Contract Validation',
      'npm run test:contract:validation',
      'Validate API endpoints and contracts'
    );
    
    await this.runCheck(
      'Statistics Tracking Debug',
      'npm run debug:statistics-tracking',
      'Debug error statistics accumulation'
    );
    
    await this.runCheck(
      'Integration Test Diagnostics',
      'npm run test:integration:debug',
      'Run integration tests with diagnostics'
    );
    
    await this.runCheck(
      'Build Check',
      'npm run build',
      'Verify TypeScript compilation'
    );
    
    await this.runCheck(
      'Lint Check',
      'npm run lint',
      'Check code style and quality'
    );
    
    await this.runCheck(
      'Type Check',
      'npm run type-check',
      'Verify TypeScript type safety'
    );
    
    await this.runCheck(
      'Unit Tests',
      'npm test -- --testPathPattern="unit" --passWithNoTests',
      'Run unit test suite'
    );
    
    await this.runCheck(
      'Integration Tests',
      'npm test -- --testPathPattern="integration" --passWithNoTests',
      'Run integration test suite'
    );
    
    await this.runCheck(
      'Performance Tests',
      'npm run test:performance:integration',
      'Check test performance and resource usage',
      false // Optional for full check
    );
  }

  calculateOverallHealth() {
    const passRate = this.healthResults.summary.passedChecks / this.healthResults.summary.totalChecks;
    const requiredChecks = this.healthResults.checks.filter(check => check.required);
    const requiredPassRate = requiredChecks.filter(check => 
      check.status === 'pass' || check.status === 'warning'
    ).length / requiredChecks.length;
    
    if (requiredPassRate === 1 && passRate >= 0.9) {
      this.healthResults.overallHealth = 'excellent';
    } else if (requiredPassRate === 1 && passRate >= 0.8) {
      this.healthResults.overallHealth = 'good';
    } else if (requiredPassRate >= 0.8) {
      this.healthResults.overallHealth = 'fair';
    } else {
      this.healthResults.overallHealth = 'poor';
    }
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    const failedChecks = this.healthResults.checks.filter(check => check.status === 'fail');
    const warningChecks = this.healthResults.checks.filter(check => check.status === 'warning');
    
    if (failedChecks.length > 0) {
      this.healthResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Failed Health Checks',
        action: 'Fix failing system components',
        details: `${failedChecks.length} critical checks failed`,
        failedChecks: failedChecks.map(check => ({
          name: check.name,
          error: check.error
        }))
      });
    }
    
    if (warningChecks.length > 0) {
      this.healthResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Warning Health Checks',
        action: 'Review and fix warning conditions',
        details: `${warningChecks.length} checks completed with warnings`,
        warningChecks: warningChecks.map(check => ({
          name: check.name,
          error: check.error
        }))
      });
    }
    
    // Performance recommendations
    const slowChecks = this.healthResults.checks.filter(check => check.duration > 10000);
    if (slowChecks.length > 0) {
      this.healthResults.recommendations.push({
        priority: 'LOW',
        issue: 'Slow Health Checks',
        action: 'Optimize slow-running checks',
        details: `${slowChecks.length} checks took longer than 10 seconds`,
        slowChecks: slowChecks.map(check => ({
          name: check.name,
          duration: check.duration
        }))
      });
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/health-check-report.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.healthResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Health report saved to: ${reportPath}`);
    
    return this.healthResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/health-check-report.txt');
    
    let report = '';
    report += '🏥 System Health Check Report\n';
    report += '============================\n\n';
    report += `📅 Generated: ${this.healthResults.timestamp}\n`;
    report += `🔍 Mode: ${this.healthResults.mode}\n`;
    report += `🎯 Overall Health: ${this.healthResults.overallHealth.toUpperCase()}\n\n`;
    
    report += '📊 Summary:\n';
    report += `  Total Checks: ${this.healthResults.summary.totalChecks}\n`;
    report += `  Passed: ${this.healthResults.summary.passedChecks}\n`;
    report += `  Failed: ${this.healthResults.summary.failedChecks}\n`;
    report += `  Skipped: ${this.healthResults.summary.skippedChecks}\n\n`;

    if (this.healthResults.checks.length > 0) {
      report += '📋 Check Results:\n';
      this.healthResults.checks.forEach(check => {
        const statusIcon = {
          'pass': '✅',
          'fail': '❌',
          'warning': '⚠️',
          'skip': '⏭️'
        }[check.status] || '❓';
        
        report += `  ${statusIcon} ${check.name} (${check.duration}ms)\n`;
        if (check.error) {
          report += `    Error: ${check.error}\n`;
        }
      });
      report += '\n';
    }

    if (this.healthResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.healthResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.issue}\n`;
        report += `    Action: ${rec.action}\n`;
        report += `    Details: ${rec.details}\n`;
        report += '\n';
      });
    }

    // Health score
    const passRate = Math.round((this.healthResults.summary.passedChecks / this.healthResults.summary.totalChecks) * 100);
    report += `🎯 Health Score: ${passRate}%\n`;

    fs.writeFileSync(textReportPath, report);
    console.log(`📄 Text report saved to: ${textReportPath}`);
  }

  async runHealthCheck() {
    const startTime = Date.now();
    
    try {
      switch (this.mode) {
        case 'quick':
          await this.runQuickHealthCheck();
          break;
        case 'daily':
          await this.runDailyHealthCheck();
          break;
        case 'full':
        default:
          await this.runFullHealthCheck();
          break;
      }
      
      this.calculateOverallHealth();
      this.generateRecommendations();
      
      const totalDuration = Date.now() - startTime;
      console.log(`\n⏱️ Total health check duration: ${totalDuration}ms`);
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'full'; // full, daily, quick
  const checker = new HealthChecker(mode);
  
  try {
    const results = await checker.runHealthCheck();
    
    // Exit with appropriate code based on health
    if (results.overallHealth === 'excellent' || results.overallHealth === 'good') {
      console.log(`🎉 System health: ${results.overallHealth.toUpperCase()}!`);
      process.exit(0);
    } else if (results.overallHealth === 'fair') {
      console.log(`⚠️ System health: ${results.overallHealth.toUpperCase()} - some issues found`);
      process.exit(0);
    } else {
      console.log(`❌ System health: ${results.overallHealth.toUpperCase()} - immediate action required`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Health check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { HealthChecker };