/**
 * Phase 15A Performance Testing Suite - Load Testing with Stubbed Scenarios
 * Performance testing with mocked high-volume scenarios (NO real load testing)
 * Based on Python implementation performance patterns
 */

import request from 'supertest';
import express from 'express';
import { Server } from '../../../src/server';
import { getLogger } from '../../../src/utils/logger';

const logger = getLogger('PerformanceTesting');

describe('Phase 15A - Performance Testing with Stubbed Scenarios', () => {
  let server: express.Application;
  
  beforeAll(async () => {
    // Set up performance testing environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    const serverManager = new Server();
    server = await serverManager.createServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Stubbed High-Volume Request Scenarios', () => {
    it('should handle stubbed burst traffic on health endpoint', async () => {
      logger.info('Testing stubbed burst traffic scenario');

      const concurrentRequests = 50;
      const startTime = process.hrtime.bigint();

      // Simulate burst traffic to health endpoint
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(server).get('/health').expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body).toMatchObject({
          status: 'healthy',
          service: 'claude-wrapper'
        });
      });

      // Should handle burst traffic efficiently (under 5 seconds)
      expect(totalTimeMs).toBeLessThan(5000);

      logger.info(`Handled ${concurrentRequests} concurrent requests in ${totalTimeMs.toFixed(2)}ms`);
    });

    it('should handle stubbed sustained load on models endpoint', async () => {
      logger.info('Testing stubbed sustained load scenario');

      const requestsPerBatch = 10;
      const numberOfBatches = 5;
      const delayBetweenBatches = 100; // ms

      const allResponseTimes: number[] = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchStartTime = process.hrtime.bigint();

        const batchRequests = Array.from({ length: requestsPerBatch }, () =>
          request(server).get('/v1/models').expect(200)
        );

        const batchResponses = await Promise.all(batchRequests);
        const batchEndTime = process.hrtime.bigint();
        const batchTimeMs = Number(batchEndTime - batchStartTime) / 1000000;

        allResponseTimes.push(batchTimeMs);

        // Verify all responses are valid
        batchResponses.forEach(response => {
          expect(response.body).toMatchObject({
            object: 'list',
            data: expect.any(Array)
          });
        });

        logger.debug(`Batch ${batch + 1}/${numberOfBatches} completed in ${batchTimeMs.toFixed(2)}ms`);

        // Delay between batches to simulate sustained load
        if (batch < numberOfBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      // Analyze performance consistency
      const averageResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      const maxResponseTime = Math.max(...allResponseTimes);
      const minResponseTime = Math.min(...allResponseTimes);

      // Performance should be consistent
      expect(averageResponseTime).toBeLessThan(2000); // Under 2 seconds average
      expect(maxResponseTime).toBeLessThan(3000); // No batch should take more than 3 seconds
      expect(maxResponseTime - minResponseTime).toBeLessThan(1500); // Reasonable variance

      logger.info(`Sustained load test completed - Avg: ${averageResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms, Min: ${minResponseTime.toFixed(2)}ms`);
    });

    it('should handle stubbed mixed endpoint load testing', async () => {
      logger.info('Testing stubbed mixed endpoint load scenario');

      const endpoints = [
        { method: 'GET', path: '/health', weight: 40 },
        { method: 'GET', path: '/v1/models', weight: 20 },
        { method: 'GET', path: '/v1/auth/status', weight: 20 },
        { method: 'GET', path: '/v1/sessions', weight: 10 },
        { method: 'POST', path: '/v1/compatibility', weight: 5, body: { model: 'claude-3-sonnet-20240229', messages: [{ role: 'user', content: 'test' }] } },
        { method: 'POST', path: '/v1/debug/request', weight: 5, body: { model: 'claude-3-sonnet-20240229', messages: [{ role: 'user', content: 'test' }] } }
      ];

      const totalRequests = 100;
      const requests: Promise<any>[] = [];

      // Generate weighted random requests
      for (let i = 0; i < totalRequests; i++) {
        const randomWeight = Math.random() * 100;
        let cumulativeWeight = 0;
        
        for (const endpoint of endpoints) {
          cumulativeWeight += endpoint.weight;
          if (randomWeight <= cumulativeWeight) {
            const req = endpoint.method === 'GET' 
              ? request(server)[endpoint.method.toLowerCase()](endpoint.path)
              : request(server)[endpoint.method.toLowerCase()](endpoint.path).send(endpoint.body || {});
            
            requests.push(req);
            break;
          }
        }
      }

      const startTime = process.hrtime.bigint();
      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // Categorize responses by status code
      const statusCodes = responses.reduce((acc, response) => {
        acc[response.status] = (acc[response.status] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Most requests should succeed (200-299)
      const successfulRequests = Object.entries(statusCodes)
        .filter(([status]) => parseInt(status) >= 200 && parseInt(status) < 300)
        .reduce((sum, [, count]) => sum + count, 0);

      expect(successfulRequests).toBeGreaterThan(totalRequests * 0.8); // At least 80% success
      expect(totalTimeMs).toBeLessThan(10000); // Should complete within 10 seconds

      logger.info(`Mixed load test completed: ${totalRequests} requests in ${totalTimeMs.toFixed(2)}ms`);
      logger.info(`Status code distribution:`, statusCodes);
    });

    it('should handle stubbed memory-intensive scenarios', async () => {
      logger.info('Testing stubbed memory-intensive scenario');

      // Simulate large payloads (but still reasonable for testing)
      const largeMessageContent = 'x'.repeat(10000); // 10KB message
      const largeRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: Array.from({ length: 10 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${largeMessageContent}`
        }))
      };

      const concurrentLargeRequests = 5;
      const requests = Array.from({ length: concurrentLargeRequests }, () =>
        request(server)
          .post('/v1/compatibility')
          .send(largeRequest)
          .expect(200)
      );

      const startTime = process.hrtime.bigint();
      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // Should handle large payloads without issues
      responses.forEach(response => {
        expect(response.body).toMatchObject({
          compatibility_report: expect.any(Object),
          claude_code_sdk_options: expect.any(Object)
        });
      });

      expect(totalTimeMs).toBeLessThan(15000); // Should complete within 15 seconds

      logger.info(`Memory-intensive test completed: ${concurrentLargeRequests} large requests in ${totalTimeMs.toFixed(2)}ms`);
    });

    it('should measure response time consistency under stubbed load', async () => {
      logger.info('Testing response time consistency under stubbed load');

      const numberOfSamples = 20;
      const responseTimes: number[] = [];

      for (let i = 0; i < numberOfSamples; i++) {
        const startTime = process.hrtime.bigint();
        await request(server).get('/v1/auth/status').expect(200);
        const endTime = process.hrtime.bigint();
        const responseTimeMs = Number(endTime - startTime) / 1000000;
        
        responseTimes.push(responseTimeMs);
        
        // Small delay to spread out requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Calculate statistics
      const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const max = Math.max(...responseTimes);
      const min = Math.min(...responseTimes);
      const variance = responseTimes.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / responseTimes.length;
      const standardDeviation = Math.sqrt(variance);

      // Log performance metrics
      logger.info(`Response time analysis over ${numberOfSamples} requests:`);
      logger.info(`Average: ${average.toFixed(2)}ms`);
      logger.info(`Median: ${median.toFixed(2)}ms`);
      logger.info(`95th percentile: ${p95.toFixed(2)}ms`);
      logger.info(`Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      logger.info(`Standard Deviation: ${standardDeviation.toFixed(2)}ms`);

      // Performance assertions
      expect(average).toBeLessThan(1000); // Average under 1 second
      expect(p95).toBeLessThan(2000); // 95% of requests under 2 seconds
      expect(standardDeviation).toBeLessThan(500); // Reasonable consistency
    });
  });

  describe('Stubbed Resource Utilization Scenarios', () => {
    it('should handle stubbed CPU-intensive validation scenarios', async () => {
      logger.info('Testing stubbed CPU-intensive validation scenario');

      // Create complex validation scenario
      const complexRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: Array.from({ length: 50 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Complex message ${i} with lots of content to validate: ${'test '.repeat(100)}`
        })),
        temperature: 0.8,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
        stream: false
      };

      const numberOfComplexRequests = 10;
      const startTime = process.hrtime.bigint();

      const requests = Array.from({ length: numberOfComplexRequests }, () =>
        request(server)
          .post('/v1/compatibility')
          .send(complexRequest)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // Verify all complex validations completed successfully
      responses.forEach(response => {
        expect(response.body.compatibility_report).toMatchObject({
          supported_parameters: expect.any(Array),
          unsupported_parameters: expect.any(Array),
          warnings: expect.any(Array),
          suggestions: expect.any(Array)
        });
      });

      expect(totalTimeMs).toBeLessThan(30000); // Should complete within 30 seconds

      logger.info(`CPU-intensive validation test completed: ${numberOfComplexRequests} complex requests in ${totalTimeMs.toFixed(2)}ms`);
    });

    it('should handle stubbed session management under load', async () => {
      logger.info('Testing stubbed session management under load scenario');

      const numberOfSessions = 20;
      const createdSessions: string[] = [];

      // Create multiple sessions concurrently
      const createStartTime = process.hrtime.bigint();
      const createRequests = Array.from({ length: numberOfSessions }, (_, i) =>
        request(server)
          .post('/v1/sessions')
          .send({
            system_prompt: `Load test session ${i}`,
            max_turns: 10,
            model: 'claude-3-sonnet-20240229'
          })
          .expect(201)
      );

      const createResponses = await Promise.all(createRequests);
      const createEndTime = process.hrtime.bigint();
      const createTimeMs = Number(createEndTime - createStartTime) / 1000000;

      // Collect session IDs
      createResponses.forEach(response => {
        createdSessions.push(response.body.id);
      });

      // List all sessions
      const listStartTime = process.hrtime.bigint();
      const listResponse = await request(server)
        .get('/v1/sessions')
        .expect(200);
      const listEndTime = process.hrtime.bigint();
      const listTimeMs = Number(listEndTime - listStartTime) / 1000000;

      expect(listResponse.body.data).toHaveLength(numberOfSessions);

      // Update sessions concurrently
      const updateStartTime = process.hrtime.bigint();
      const updateRequests = createdSessions.map(sessionId =>
        request(server)
          .patch(`/v1/sessions/${sessionId}`)
          .send({
            system_prompt: `Updated load test session`,
            max_turns: 15
          })
          .expect(200)
      );

      await Promise.all(updateRequests);
      const updateEndTime = process.hrtime.bigint();
      const updateTimeMs = Number(updateEndTime - updateStartTime) / 1000000;

      // Delete sessions concurrently
      const deleteStartTime = process.hrtime.bigint();
      const deleteRequests = createdSessions.map(sessionId =>
        request(server)
          .delete(`/v1/sessions/${sessionId}`)
          .expect(204)
      );

      await Promise.all(deleteRequests);
      const deleteEndTime = process.hrtime.bigint();
      const deleteTimeMs = Number(deleteEndTime - deleteStartTime) / 1000000;

      // Performance assertions
      expect(createTimeMs).toBeLessThan(10000); // Create sessions within 10 seconds
      expect(listTimeMs).toBeLessThan(1000); // List sessions within 1 second
      expect(updateTimeMs).toBeLessThan(5000); // Update sessions within 5 seconds
      expect(deleteTimeMs).toBeLessThan(5000); // Delete sessions within 5 seconds

      logger.info(`Session management under load completed:`);
      logger.info(`Create: ${createTimeMs.toFixed(2)}ms, List: ${listTimeMs.toFixed(2)}ms`);
      logger.info(`Update: ${updateTimeMs.toFixed(2)}ms, Delete: ${deleteTimeMs.toFixed(2)}ms`);
    });

    it('should validate performance degradation boundaries', async () => {
      logger.info('Testing performance degradation boundaries');

      const baselineRequests = 5;
      const loadTestRequests = 25;

      // Establish baseline performance
      const baselineStartTime = process.hrtime.bigint();
      const baselineRequestPromises = Array.from({ length: baselineRequests }, () =>
        request(server).get('/v1/models').expect(200)
      );
      await Promise.all(baselineRequestPromises);
      const baselineEndTime = process.hrtime.bigint();
      const baselineTimeMs = Number(baselineEndTime - baselineStartTime) / 1000000;
      const baselineAverage = baselineTimeMs / baselineRequests;

      // Test under higher load
      const loadTestStartTime = process.hrtime.bigint();
      const loadTestRequestPromises = Array.from({ length: loadTestRequests }, () =>
        request(server).get('/v1/models').expect(200)
      );
      await Promise.all(loadTestRequestPromises);
      const loadTestEndTime = process.hrtime.bigint();
      const loadTestTimeMs = Number(loadTestEndTime - loadTestStartTime) / 1000000;
      const loadTestAverage = loadTestTimeMs / loadTestRequests;

      // Calculate performance degradation
      const degradationRatio = loadTestAverage / baselineAverage;

      logger.info(`Baseline average: ${baselineAverage.toFixed(2)}ms per request`);
      logger.info(`Load test average: ${loadTestAverage.toFixed(2)}ms per request`);
      logger.info(`Performance degradation ratio: ${degradationRatio.toFixed(2)}x`);

      // Performance should not degrade significantly under reasonable load
      expect(degradationRatio).toBeLessThan(3.0); // No more than 3x degradation
      expect(loadTestAverage).toBeLessThan(2000); // Still under 2 seconds average

      logger.info('Performance degradation boundaries validated');
    });
  });

  describe('Stubbed Error Handling Performance', () => {
    it('should handle high-volume error scenarios efficiently', async () => {
      logger.info('Testing high-volume error scenarios performance');

      const errorScenarios = [
        { path: '/v1/chat/completions', body: {} }, // Missing required fields
        { path: '/v1/sessions', body: { max_turns: -1 } }, // Invalid values
        { path: '/v1/compatibility', body: { invalid: 'data' } }, // Invalid structure
        { path: '/v1/debug/request', body: null } // Null body
      ];

      const requestsPerScenario = 10;
      const allErrorRequests: Promise<any>[] = [];

      // Generate error requests
      errorScenarios.forEach(scenario => {
        for (let i = 0; i < requestsPerScenario; i++) {
          const req = request(server)
            .post(scenario.path)
            .send(scenario.body);
          allErrorRequests.push(req);
        }
      });

      const startTime = process.hrtime.bigint();
      const responses = await Promise.all(allErrorRequests);
      const endTime = process.hrtime.bigint();
      const totalTimeMs = Number(endTime - startTime) / 1000000;

      // Analyze error response distribution
      const statusCodeDistribution = responses.reduce((acc, response) => {
        acc[response.status] = (acc[response.status] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Should handle errors quickly without crashing
      expect(totalTimeMs).toBeLessThan(15000); // All errors handled within 15 seconds
      
      // Most should be 400-level errors (client errors)
      const clientErrors = Object.entries(statusCodeDistribution)
        .filter(([status]) => parseInt(status) >= 400 && parseInt(status) < 500)
        .reduce((sum, [, count]) => sum + count, 0);

      expect(clientErrors).toBeGreaterThan(allErrorRequests.length * 0.5); // At least 50% client errors

      logger.info(`Error handling performance test completed: ${allErrorRequests.length} error requests in ${totalTimeMs.toFixed(2)}ms`);
      logger.info('Error status distribution:', statusCodeDistribution);
    });
  });
});