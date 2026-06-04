export type AIRetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitterRatio?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (event: AIRetryEvent) => void;
};

export type AIRetryEvent = {
  attempt: number;
  delayMs: number;
  error: unknown;
};

const DEFAULT_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_FACTOR = 2;
const DEFAULT_JITTER_RATIO = 0.2;

export async function withExponentialBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: AIRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const factor = options.factor ?? DEFAULT_FACTOR;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const shouldRetry = options.shouldRetry ?? isRetryableAIError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delayMs = computeBackoffDelay({
        attempt,
        initialDelayMs,
        maxDelayMs,
        factor,
        jitterRatio,
      });

      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export function isRetryableAIError(error: unknown) {
  const status = getErrorStatus(error);

  if (status !== undefined) {
    return status === 429 || status >= 500;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("etimedout")
    );
  }

  return false;
}

function computeBackoffDelay({
  attempt,
  initialDelayMs,
  maxDelayMs,
  factor,
  jitterRatio,
}: {
  attempt: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitterRatio: number;
}) {
  const base = Math.min(maxDelayMs, initialDelayMs * factor ** attempt);
  const jitter = base * jitterRatio * Math.random();
  return Math.round(base + jitter);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  for (const key of ["status", "statusCode", "code"]) {
    if (key in error) {
      const value = (error as Record<string, unknown>)[key];
      const numberValue = typeof value === "number" ? value : Number(value);

      if (Number.isFinite(numberValue)) {
        return numberValue;
      }
    }
  }

  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

