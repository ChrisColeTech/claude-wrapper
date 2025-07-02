/**
 * Winston logger configuration
 * Based on Python main.py logging setup
 */

import winston from 'winston';
import { config } from './env';

const logLevel = config.DEBUG_MODE ? 'debug' : (config.VERBOSE ? 'info' : 'warn');

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
