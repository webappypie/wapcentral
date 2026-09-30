import { type ClassValue, clsx } from 'clsx';

/**
 * Combines multiple class names or conditional class expressions.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
