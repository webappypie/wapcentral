import type { CircuitBreakerConfig, CircuitBreakerSnapshot, CircuitBreakerStatus } from '@wapcentral/types';

export interface CircuitState {
  status: CircuitBreakerStatus;
  failureCount: number;
  consecutiveSuccesses: number;
  lastFailureTime?: string | undefined;
  lastFailureReason?: string | undefined;
  openedAt?: number | undefined; // timestamp in ms
}

class CircuitBreakerManager {
  private readonly states = new Map<string, CircuitState>();

  private getStateInternal(key: string): CircuitState {
    let state = this.states.get(key);
    if (!state) {
      state = {
        status: 'closed',
        failureCount: 0,
        consecutiveSuccesses: 0,
      };
      this.states.set(key, state);
    }
    return state;
  }

  /**
   * Checks if an execution attempt is allowed for the given circuit key.
   * Handles automatic transition from OPEN to HALF_OPEN when recoveryTimeMs has elapsed.
   */
  canExecute(
    key: string,
    config: CircuitBreakerConfig,
  ): { allowed: boolean; status: CircuitBreakerStatus; reason?: string } {
    const state = this.getStateInternal(key);

    if (state.status === 'closed') {
      return { allowed: true, status: 'closed' };
    }

    if (state.status === 'open') {
      const now = Date.now();
      const elapsed = state.openedAt ? now - state.openedAt : Infinity;

      if (elapsed >= config.recoveryTimeMs) {
        // Cooldown period elapsed -> transition to half-open
        state.status = 'half_open';
        state.consecutiveSuccesses = 0;
        return { allowed: true, status: 'half_open' };
      }

      const remainingSec = Math.ceil((config.recoveryTimeMs - elapsed) / 1000);
      return {
        allowed: false,
        status: 'open',
        reason: `Circuit breaker is OPEN for '${key}'. Cooldown active (${remainingSec}s remaining).`,
      };
    }

    // HALF_OPEN: Allow one probe request through
    return { allowed: true, status: 'half_open' };
  }

  /**
   * Records a successful execution.
   * Resets failures and transitions HALF_OPEN back to CLOSED.
   */
  recordSuccess(key: string): void {
    const state = this.getStateInternal(key);
    state.consecutiveSuccesses += 1;
    state.failureCount = 0;
    state.status = 'closed';
    delete state.openedAt;
    delete state.lastFailureReason;
  }

  /**
   * Records a failed execution (or timeout).
   * Trips to OPEN if failureThreshold is exceeded, or returns from HALF_OPEN back to OPEN.
   */
  recordFailure(
    key: string,
    reason: string,
    config: CircuitBreakerConfig,
  ): { tripped: boolean; status: CircuitBreakerStatus } {
    const state = this.getStateInternal(key);
    state.failureCount += 1;
    state.consecutiveSuccesses = 0;
    state.lastFailureTime = new Date().toISOString();
    state.lastFailureReason = reason;

    if (state.status === 'half_open') {
      // Probe failed -> trip back to OPEN immediately
      state.status = 'open';
      state.openedAt = Date.now();
      return { tripped: true, status: 'open' };
    }

    if (state.failureCount >= config.failureThreshold) {
      state.status = 'open';
      state.openedAt = Date.now();
      return { tripped: true, status: 'open' };
    }

    return { tripped: false, status: 'closed' };
  }

  /**
   * Returns a snapshot of circuit breaker state for inspection and telemetry.
   */
  getSnapshot(key: string, config?: CircuitBreakerConfig): CircuitBreakerSnapshot {
    const state = this.getStateInternal(key);

    // If open and recovery time has passed, report half_open
    let currentStatus = state.status;
    if (state.status === 'open' && config && state.openedAt) {
      if (Date.now() - state.openedAt >= config.recoveryTimeMs) {
        currentStatus = 'half_open';
      }
    }

    return {
      status: currentStatus,
      failureCount: state.failureCount,
      consecutiveSuccesses: state.consecutiveSuccesses,
      ...(state.lastFailureTime ? { lastFailureTime: state.lastFailureTime } : {}),
      ...(state.lastFailureReason ? { lastFailureReason: state.lastFailureReason } : {}),
      ...(state.openedAt ? { openedAt: new Date(state.openedAt).toISOString() } : {}),
    };
  }

  /**
   * Manually resets a circuit breaker to CLOSED.
   */
  reset(key: string): void {
    this.states.delete(key);
  }

  /**
   * Clears all circuit breaker states (for test teardown).
   */
  resetAll(): void {
    this.states.clear();
  }
}

export const circuitBreaker = new CircuitBreakerManager();
