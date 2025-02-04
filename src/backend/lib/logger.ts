import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const { combine, printf, colorize, align } = winston.format;

// Custom format for console output
const consoleFormat = combine(
  colorize({ all: true }),
  align(),
  printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp.slice(11, 19);
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(args).length ? JSON.stringify(args, null, 2) : ''
    }`;
  })
);

// Custom format for file output (no colors)
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  align(),
  printf((info) => {
    const { timestamp, level, message, ...args } = info;
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(args).length ? JSON.stringify(args, null, 2) : ''
    }`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Ensure timestamp is a string
      const ts = (timestamp as string)?.slice(11, 19) || new Date().toISOString().slice(11, 19);
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${ts} [${level}]: ${message} ${metaStr}`;
    })
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Rotating file transport for all logs
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'magent-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat
    }),
    // Separate file for errors
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: fileFormat
    })
  ]
});

// Export a wrapper with typed methods
export const log = {
  info: (message: string, meta?: object) => logger.info(message, meta),
  error: (message: string, error?: unknown) => {
    const meta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : { error };
    logger.error(message, meta);
  },
  warn: (message: string, meta?: object) => logger.warn(message, meta),
  debug: (message: string, meta?: object) => logger.debug(message, meta),
  // Method to change log level at runtime
  setLevel: (level: string) => {
    logger.level = level;
    logger.info(`Log level changed to ${level}`);
  }
}; 
