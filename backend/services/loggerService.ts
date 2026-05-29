import * as Sentry from '@sentry/react-native';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
// ─── Types ────────────────────────────────────────────────────────────────────

interface LogConfig {
  enableRemote?: boolean;
  remoteUrl?: string;
  isDevelopment?: boolean;
  sentryDsn?: string;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: number;
  maxFiles: number;
}

// ─── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableFile: false, // Disabled for React Native compatibility
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
};

// ─── Log Level Priority ───────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── Logger Service ───────────────────────────────────────────────────────────

class LoggerService {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private formatLog(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  // ─── Public Logging Methods ───────────────────────────────────────────────────

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, context, error);
  }

  // ─── Core Logging Method ──────────────────────────────────────────────────────

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Check if this log level should be processed
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

  private async sendToRemote(level: LogLevel, formattedLog: string, data?: unknown): Promise<void> {
    // Send to Sentry if it's an error or warning
    if (level === 'error') {
      Sentry.captureException(data instanceof Error ? data : new Error(formattedLog));
    } else if (level === 'warn') {
      Sentry.captureMessage(formattedLog, 'warning');
    }

    if (!this.config.enableRemote || !this.config.remoteUrl) return;
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    // Add to buffer
    this.addToBuffer(logEntry);

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }
  }

  debug(message: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatLog('debug', message, data);
    console.warn(formatted);
    this.sendToRemote('debug', formatted, data);
  // ─── Console Output ───────────────────────────────────────────────────────────

  private logToConsole(entry: LogEntry): void {
    const { level, message, timestamp, context, error } = entry;
    
    // Format the log message
    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    // Choose appropriate console method
    const consoleMethod = this.getConsoleMethod(level);
    if (context || error) {
      const additionalData: any = {};
      if (context) additionalData.context = context;
      if (error) additionalData.error = { message: error.message, stack: error.stack };
      
      consoleMethod(formattedMessage, additionalData);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  info(message: string, data?: unknown): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatLog('info', message, data);
    console.warn(formatted);
    this.sendToRemote('info', formatted, data);
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
        return console.error;
      default:
        return console.log;
    }
  }

  warn(message: string, data?: unknown): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatLog('warn', message, data);
    console.warn(formatted);
    this.sendToRemote('warn', formatted, data);
  // ─── Buffer Management ────────────────────────────────────────────────────────

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Trim buffer if it exceeds max size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  error(message: string, data?: unknown): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.formatLog('error', message, data);
    console.error(formatted);
    this.sendToRemote('error', formatted, data);
  // ─── Public Utility Methods ───────────────────────────────────────────────────

  /**
   * Get recent log entries from buffer
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel, count: number = 100): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.level === level)
      .slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

// ─── Child Logger ─────────────────────────────────────────────────────────────

class ChildLogger {
  constructor(
    private parent: LoggerService,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, additionalContext?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...additionalContext });
  }

  info(message: string, additionalContext?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...additionalContext });
  }

  warn(message: string, additionalContext?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...additionalContext });
  }

  error(message: string, additionalContext?: Record<string, unknown>, error?: Error): void {
    this.parent.error(message, { ...this.context, ...additionalContext }, error);
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const loggerService = new LoggerService();

export default loggerService;