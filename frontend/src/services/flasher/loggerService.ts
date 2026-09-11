// loggerService.ts
// Real-time terminal logger for esptool-js and Web Serial streaming.

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'rx' | 'tx' | 'system';
}

export type LogListener = (entry: LogEntry | null, allLogs: LogEntry[]) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: LogListener[] = [];

  log(message: any) {
    this.addLog(message, 'info');
  }

  warn(message: any) {
    this.addLog(message, 'warn');
  }

  error(message: any) {
    this.addLog(message, 'error');
  }

  rx(message: string) {
    this.addLog(message, 'rx');
  }

  tx(message: string) {
    this.addLog(message, 'tx');
  }

  addLog(message: any, type: LogEntry['type'] = 'info') {
    const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry: LogEntry = { timestamp, message: msgStr, type };
    this.logs.push(logEntry);

    // Keep log buffer bounded to 1500 entries
    if (this.logs.length > 1500) {
      this.logs.shift();
    }

    this.listeners.forEach((callback) => callback(logEntry, this.logs));
  }

  clear() {
    this.logs = [];
    const clearEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: 'Console cleared',
      type: 'system',
    };
    this.logs.push(clearEntry);
    this.listeners.forEach((callback) => callback(clearEntry, this.logs));
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  subscribe(callback: LogListener): () => void {
    this.listeners.push(callback);
    callback(null, this.logs);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  // Terminal adapter for esptool-js IEspLoaderTerminal interface
  getTerminalAdapter() {
    return {
      clean: () => {
        this.clear();
      },
      writeLine: (data: string) => {
        this.log(data);
      },
      write: (data: string) => {
        if (data && data.trim()) {
          const cleaned = data.replace(/[\b\r]/g, '').trim();
          if (cleaned) {
            this.log(cleaned);
          }
        }
      },
    };
  }
}

export const logger = new LoggerService();
