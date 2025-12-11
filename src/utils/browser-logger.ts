/**
 * Browser-compatible logger that mimics firebase-functions/logger
 * Uses console methods for browser environment
 */

export function debug(message: string, ...args: unknown[]): void {
  console.log(`[DEBUG] ${message}`, ...args);
}

export function info(message: string, ...args: unknown[]): void {
  console.info(`[INFO] ${message}`, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  console.warn(`[WARN] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}

export function log(message: string, ...args: unknown[]): void {
  console.log(`[LOG] ${message}`, ...args);
}
