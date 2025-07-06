#!/usr/bin/env node
/**
 * Debug Monitoring System Script
 * Comprehensive debugging of monitoring system issues causing 500 errors
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

class MonitoringSystemDebugger {
  constructor() {
    this.debugResults = {
      timestamp: new Date().toISOString(),
      monitoringTests: [],
      endpointTests: [],
      performanceMonitorTests: [],
      issues: [],
      recommendations: []
    };
  }

  async testPerformanceMonitorBasics() {
    console.log('🔍 Testing performance monitor basics...');
    
    try {
      const { performanceMonitor } = require('../../dist/src/monitoring/performance-monitor');
      
      const test = {
        name: 'Performance Monitor Basic Operations',
        clearMetrics: false,
        startTimer: false,
        getAllStats: false,
        getStats: false,
        issues: []
      };

      // Test clearMetrics
      try {
        performanceMonitor.clearMetrics();
        test.clearMetrics = true;
        console.log('  ✅ clearMetrics() works');
      } catch (error) {
        test.issues.push(`clearMetrics failed: ${error.message}`);
        console.log(`  ❌ clearMetrics failed: ${error.message}`);
      }

      // Test startTimer
      try {
        const timer = performanceMonitor.startTimer('test-operation');
        timer.stop(true);
        test.startTimer = true;
        console.log('  ✅ startTimer() works');
      } catch (error) {
        test.issues.push(`startTimer failed: ${error.message}`);
        console.log(`  ❌ startTimer failed: ${error.message}`);
      }

      // Test getAllStats
      try {
        const stats = performanceMonitor.getAllStats();
        test.getAllStats = true;
        console.log(`  ✅ getAllStats() works - ${stats.size} operations`);
      } catch (error) {
        test.issues.push(`getAllStats failed: ${error.message}`);
        console.log(`  ❌ getAllStats failed: ${error.message}`);
      }

      // Test getStats
      try {
        const stats = performanceMonitor.getStats('test-operation');
        test.getStats = true;
        console.log('  ✅ getStats() works');
      } catch (error) {
        test.issues.push(`getStats failed: ${error.message}`);
        console.log(`  ❌ getStats failed: ${error.message}`);
      }

      this.debugResults.performanceMonitorTests.push(test);

    } catch (error) {
      console.log(`  ❌ Could not load performance monitor: ${error.message}`);
      this.debugResults.issues.push({
        type: 'performance_monitor_load',
        message: error.message
      });
    }
  }

  async testMonitoringUtilities() {
    console.log('🔍 Testing monitoring utilities...');
    
    try {
      const monitoringPath = '../../dist/src/routes/monitoring';
      const monitoring = require(monitoringPath);
      
      // Test if we can access MonitoringUtils (it's not exported, so we'll test the routes)
      console.log('  ✅ Monitoring module loaded');
      
      const test = {
        name: 'Monitoring Routes Instantiation',
        routeCreation: false,
        issues: []
      };

      try {
        const { createMonitoringRoutes } = monitoring;
        const router = createMonitoringRoutes();
        test.routeCreation = true;
        console.log('  ✅ Monitoring routes created successfully');
      } catch (error) {
        test.issues.push(`Route creation failed: ${error.message}`);
        console.log(`  ❌ Route creation failed: ${error.message}`);
      }

      this.debugResults.monitoringTests.push(test);

    } catch (error) {
      console.log(`  ❌ Could not load monitoring routes: ${error.message}`);
      this.debugResults.issues.push({
        type: 'monitoring_routes_load',
        message: error.message
      });
    }
  }

  async testMonitoringEndpoints() {
    console.log('🔍 Testing monitoring endpoints...');
    
    try {
      // Create a minimal Express app like the test
      const { performanceMonitor } = require('../../dist/src/monitoring/performance-monitor');
      const { createMonitoringRoutes } = require('../../dist/src/routes/monitoring');
      
      const app = express();
      app.use(express.json());
      app.use('/monitoring', createMonitoringRoutes());
      
      // Clear metrics for clean test
      performanceMonitor.clearMetrics();

      const endpoints = [
        { path: '/monitoring/health', name: 'Health Check' },
        { path: '/monitoring/status', name: 'Status Check' },
        { path: '/monitoring/metrics', name: 'Metrics' },
        { path: '/monitoring/dashboard', name: 'Dashboard' },
        { path: '/monitoring/system', name: 'System Metrics' }
      ];

      for (const endpoint of endpoints) {
        const test = {
          name: endpoint.name,
          path: endpoint.path,
          status: null,
          responseReceived: false,
          error: null,
          issues: []
        };

        try {
          console.log(`  Testing ${endpoint.name}...`);
          
          const response = await request(app)
            .get(endpoint.path)
            .timeout(5000);
          
          test.status = response.status;
          test.responseReceived = true;
          
          if (response.status === 200) {
            console.log(`    ✅ ${endpoint.name}: ${response.status}`);
          } else {
            console.log(`    ❌ ${endpoint.name}: ${response.status}`);
            test.issues.push(`Unexpected status: ${response.status}`);
            if (response.body && response.body.error) {
              test.issues.push(`Error: ${response.body.error}`);
            }
          }
          
        } catch (error) {
          test.error = error.message;
          test.issues.push(`Request failed: ${error.message}`);
          console.log(`    ❌ ${endpoint.name}: ${error.message}`);
        }

        this.debugResults.endpointTests.push(test);
      }

    } catch (error) {
      console.log(`  ❌ Could not create test app: ${error.message}`);
      this.debugResults.issues.push({
        type: 'test_app_creation',
        message: error.message
      });
    }
  }

  async testConstantsAndDependencies() {
    console.log('🔍 Testing constants and dependencies...');
    
    const dependencies = [
      { name: 'Production Constants', path: '../../dist/src/tools/constants/production' },
      { name: 'Logger Utils', path: '../../dist/src/utils/logger' },
      { name: 'Cleanup Service', path: '../../dist/src/services/cleanup-service' }
    ];

    for (const dep of dependencies) {
      try {
        const module = require(dep.path);
        console.log(`  ✅ ${dep.name} loaded successfully`);
        
        if (dep.name === 'Production Constants') {
          // Check if PRODUCTION_MONITORING constants exist
          if (module.PRODUCTION_MONITORING) {
            console.log(`    ✅ PRODUCTION_MONITORING constants available`);
            if (module.PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS) {
              console.log(`    ✅ RESPONSE_TIME_THRESHOLD_MS: ${module.PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS}`);
            } else {
              this.debugResults.issues.push({
                type: 'missing_constant',
                message: 'RESPONSE_TIME_THRESHOLD_MS not found'
              });
            }
          } else {
            this.debugResults.issues.push({
              type: 'missing_constants',
              message: 'PRODUCTION_MONITORING not found'
            });
          }
        }
        
      } catch (error) {
        console.log(`  ❌ ${dep.name} failed to load: ${error.message}`);
        this.debugResults.issues.push({
          type: 'dependency_load_error',
          dependency: dep.name,
          message: error.message
        });
      }
    }
  }

  generateRecommendations() {
    console.log('🔍 Generating recommendations...');
    
    const performanceMonitorIssues = this.debugResults.performanceMonitorTests.filter(
      test => test.issues.length > 0
    );

    if (performanceMonitorIssues.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Performance Monitor Issues',
        action: 'Fix performance monitor implementation',
        details: `${performanceMonitorIssues.length} performance monitor operations failing`,
        commands: [
          'Check performance monitor singleton implementation',
          'Verify timer implementation',
          'Check stats storage and retrieval'
        ]
      });
    }

    const endpointIssues = this.debugResults.endpointTests.filter(
      test => test.issues.length > 0
    );

    if (endpointIssues.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'HIGH',
        issue: 'Monitoring Endpoints Failing',
        action: 'Fix monitoring endpoint implementations',
        details: `${endpointIssues.length} monitoring endpoints have issues`,
        failingEndpoints: endpointIssues.map(test => test.path),
        commands: [
          'Check monitoring route handlers',
          'Verify MonitoringUtils functions',
          'Add proper error handling and logging'
        ]
      });
    }

    const dependencyIssues = this.debugResults.issues.filter(
      issue => issue.type.includes('load') || issue.type.includes('dependency')
    );

    if (dependencyIssues.length > 0) {
      this.debugResults.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Dependency Loading Issues',
        action: 'Fix module dependencies and imports',
        details: `${dependencyIssues.length} dependencies have loading issues`,
        commands: [
          'Check TypeScript compilation',
          'Verify module exports',
          'Check import paths and dependencies'
        ]
      });
    }
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../logs/monitoring-system-debug.json');
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.debugResults, null, 2));

    // Generate text report
    this.generateTextReport();

    console.log(`📄 Debug report saved to: ${reportPath}`);
    const totalTests = this.debugResults.performanceMonitorTests.length + 
                      this.debugResults.monitoringTests.length + 
                      this.debugResults.endpointTests.length;
    const passedTests = this.debugResults.performanceMonitorTests.filter(t => t.issues.length === 0).length +
                       this.debugResults.monitoringTests.filter(t => t.issues.length === 0).length +
                       this.debugResults.endpointTests.filter(t => t.issues.length === 0).length;
    console.log(`📊 Monitoring system tests: ${passedTests}/${totalTests} passed`);

    return this.debugResults;
  }

  generateTextReport() {
    const textReportPath = path.join(__dirname, '../logs/monitoring-system-debug.txt');
    
    let report = '';
    report += '🔧 Monitoring System Debug Report\n';
    report += '==================================\n\n';
    report += `📅 Generated: ${this.debugResults.timestamp}\n\n`;
    
    if (this.debugResults.performanceMonitorTests.length > 0) {
      report += '📊 Performance Monitor Tests:\n';
      this.debugResults.performanceMonitorTests.forEach(test => {
        const status = test.issues.length === 0 ? '✅' : '❌';
        report += `  ${status} ${test.name}\n`;
        if (test.issues.length > 0) {
          test.issues.forEach(issue => {
            report += `    - ${issue}\n`;
          });
        }
      });
      report += '\n';
    }

    if (this.debugResults.endpointTests.length > 0) {
      report += '🌐 Endpoint Tests:\n';
      this.debugResults.endpointTests.forEach(test => {
        const status = test.issues.length === 0 ? '✅' : '❌';
        report += `  ${status} ${test.name} (${test.path}): ${test.status || 'No response'}\n`;
        if (test.issues.length > 0) {
          test.issues.forEach(issue => {
            report += `    - ${issue}\n`;
          });
        }
      });
      report += '\n';
    }

    if (this.debugResults.issues.length > 0) {
      report += '⚠️ Issues Found:\n';
      this.debugResults.issues.forEach(issue => {
        report += `  [${issue.type}] ${issue.message}\n`;
      });
      report += '\n';
    }

    if (this.debugResults.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.debugResults.recommendations.forEach(rec => {
        report += `  [${rec.priority}] ${rec.issue}\n`;
        report += `    Action: ${rec.action}\n`;
        report += `    Details: ${rec.details}\n`;
        rec.commands.forEach(cmd => {
          report += `    - ${cmd}\n`;
        });
        report += '\n';
      });
    }

    const totalTests = this.debugResults.performanceMonitorTests.length + 
                      this.debugResults.monitoringTests.length + 
                      this.debugResults.endpointTests.length;
    const passedTests = this.debugResults.performanceMonitorTests.filter(t => t.issues.length === 0).length +
                       this.debugResults.monitoringTests.filter(t => t.issues.length === 0).length +
                       this.debugResults.endpointTests.filter(t => t.issues.length === 0).length;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    report += `🎯 Monitoring System Score: ${passRate}%\n`;

    fs.writeFileSync(textReportPath, report);
    console.log(`📄 Text report saved to: ${textReportPath}`);
  }

  async runDebug() {
    console.log('🚀 Starting monitoring system debug...');
    
    try {
      await this.testConstantsAndDependencies();
      await this.testPerformanceMonitorBasics();
      await this.testMonitoringUtilities();
      await this.testMonitoringEndpoints();
      this.generateRecommendations();
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Debug failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const debug = new MonitoringSystemDebugger();
  
  try {
    const results = await debug.runDebug();
    
    // Exit with appropriate code
    const totalTests = results.performanceMonitorTests.length + 
                      results.monitoringTests.length + 
                      results.endpointTests.length;
    const passedTests = results.performanceMonitorTests.filter(t => t.issues.length === 0).length +
                       results.monitoringTests.filter(t => t.issues.length === 0).length +
                       results.endpointTests.filter(t => t.issues.length === 0).length;
    const passRate = totalTests > 0 ? passedTests / totalTests : 0;
    
    if (passRate === 1) {
      console.log('🎉 Perfect monitoring system health!');
      process.exit(0);
    } else if (passRate >= 0.8) {
      console.log('⚠️ Good monitoring system with some issues');
      process.exit(0);
    } else {
      console.log('❌ Monitoring system needs significant fixes');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Monitoring system debug failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MonitoringSystemDebugger };