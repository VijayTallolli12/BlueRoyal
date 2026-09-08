import winston from 'winston';
import { env } from '../../config/env';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: time, correlationId, ...metadata }) => {
  const cid = correlationId ? `[CID: ${correlationId}] ` : '';
  const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
  return `${time} ${level}: ${cid}${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    json(),
  ),
  defaultMeta: { service: 'blue-royal-hrms-api' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
    }),
  ],
});
