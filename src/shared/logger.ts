type LogContext = Record<string, unknown>;

const namespace = "[AutoFillUp]";

export const logger = {
  debug(message: string, context?: LogContext): void {
    console.debug(namespace, message, context ?? "");
  },
  info(message: string, context?: LogContext): void {
    console.info(namespace, message, context ?? "");
  },
  warn(message: string, context?: LogContext): void {
    console.warn(namespace, message, context ?? "");
  },
  error(message: string, context?: LogContext): void {
    console.error(namespace, message, context ?? "");
  }
};
