import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import config from '../config';
import { setupInterceptors } from '../middleware/apiInterceptors';
import { logError } from '../utils/errorLogger';
import performance, { recordApiTiming, startSpan, finishSpan } from '../utils/performance';

// --- Circuit Breaker ---
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 30_000;
const circuit = { state: 'CLOSED' as CircuitState, failures: 0, lastFailureTime: 0 };

function isCircuitOpen(): boolean {
  if (circuit.state === 'OPEN') {
    if (Date.now() - circuit.lastFailureTime >= RECOVERY_TIMEOUT_MS) {
      circuit.state = 'HALF_OPEN';

      logError(new Error('Circuit breaker transitioning to HALF_OPEN'), {
        service: 'apiClient',
        action: 'circuit_half_open',
      });

      return false;
    }
    return true;
  }
  return false;
}

function recordSuccess(): void {
  if (circuit.state !== 'CLOSED') {
    logError(new Error('Circuit breaker CLOSED after success'), {
      service: 'apiClient',
      action: 'circuit_closed',
    });
  }
  circuit.failures = 0;
  circuit.state = 'CLOSED';
}

function recordFailure(): void {
  circuit.failures += 1;
  circuit.lastFailureTime = Date.now();

  if (circuit.failures >= FAILURE_THRESHOLD && circuit.state !== 'OPEN') {
    circuit.state = 'OPEN';

    logError(new Error('Circuit breaker OPENED due to multiple failures'), {
      service: 'apiClient',
      action: 'circuit_open',
      failures: circuit.failures,
    });
  }
}

// --- Retry ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

function shouldRetry(error: AxiosError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (!error.response) return true; // network error
  return error.response.status >= 500;
}

const delay = (attempt: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));

// --- Axios instance ---
const apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-Version': config.api.version,
  },
});

setupInterceptors(apiClient);

// --- Resilient request wrapper ---
export async function resilientRequest<T>(
  requestConfig: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  if (isCircuitOpen()) {
    const error = new Error('Service temporarily unavailable. Please try again later.');

    logError(error, {
      service: 'apiClient',
      action: 'circuit_block_request',
      url: requestConfig.url,
      method: requestConfig.method,
    });

    throw error;
  }

  let lastError: AxiosError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await delay(attempt - 1);

      const span = startSpan(`http ${requestConfig.method ?? 'request'} ${requestConfig.url}`);
      const started = Date.now();
      const response = await apiClient.request<T>(requestConfig);
      const duration = Date.now() - started;

      // record timings
      try {
        recordApiTiming(requestConfig.url, requestConfig.method, duration, response.status);
      } catch (e) {
        // ignore metric errors
      }

      finishSpan(span);

      recordSuccess();
      return response;
    } catch (err) {
      lastError = err as AxiosError;

      recordFailure();

      if (!shouldRetry(lastError, attempt)) break;
    }
  }

  // --- FINAL ERROR (THIS is where logging matters most) ---
  const message = lastError?.response
    ? `Request failed with status ${lastError.response.status}`
    : (lastError?.message ?? 'Network error');

  const finalError = new Error(message);

  logError(finalError, {
    service: 'apiClient',
    action: 'request_failed',
    url: requestConfig.url,
    method: requestConfig.method,
    attempts: MAX_RETRIES + 1,
    status: lastError?.response?.status,
  });

  throw finalError;
}

export const getCircuitState = () => circuit.state;

export default apiClient;
