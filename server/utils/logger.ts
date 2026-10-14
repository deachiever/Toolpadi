export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'api_key',
  'apikey',
  'token',
  'authorization',
  'cookie',
  'x-admin-key',
  'insight_api_key',
  'payment_webhook_secret',
  'license_code_or_credential',
  'card_number',
  'cvv',
  'pin'
]);

function sanitize(obj: any, depth = 0): any {
  if (depth > 5) return '[Truncated]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some(k => lowerKey.includes(k));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val, depth + 1);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export const logger = {
  log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      environment: process.env.NODE_ENV || 'development',
      ...sanitize(meta)
    };

    if (process.env.NODE_ENV === 'production') {
      // Structured single-line JSON log for Cloud Run, Datadog, CloudWatch, or ELK
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(JSON.stringify(entry) + '\n');
    } else {
      // Human-readable dev output
      const prefix = {
        info: '\x1b[32m[INFO]\x1b[0m',
        warn: '\x1b[33m[WARN]\x1b[0m',
        error: '\x1b[31m[ERROR]\x1b[0m',
        debug: '\x1b[36m[DEBUG]\x1b[0m'
      }[level];
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(sanitize(meta))}` : '';
      console.log(`${prefix} ${message}${metaStr}`);
    }
  },

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  },

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  },

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  },

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }
};
