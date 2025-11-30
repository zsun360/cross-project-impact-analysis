export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

let currentLevel: LogLevel = 'info';

const levelOrder: Record<LogLevel, number> = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  off: 5,
};

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLevel];
}

// 可以根据需要扩一下，这已经够日常用了
type LogPrimitive = string | number | boolean | null | undefined;
type LogValue = LogPrimitive | Error | Record<string, unknown> | unknown[];

export const logger = {
  debug: (...args: LogValue[]): void => {
    if (shouldLog('debug')) {console.debug('[DEBUG]', ...args);}
  },
  info: (...args: LogValue[]): void => {
    if (shouldLog('info')) {console.log('[INFO]', ...args);}
  },
  warn: (...args: LogValue[]): void => {
    if (shouldLog('warn')) {console.warn('[WARN]', ...args);}
  },
  error: (...args: LogValue[]): void => {
    if (shouldLog('error')) {console.error('[ERROR]', ...args);}
  },
};
