// Covers authentication, response headers AND body consumption. Some native
// transports do not reject promptly on abort, so the deadline also races them.
export async function withRequestDeadline<T>(
  milliseconds: number,
  operation: (signal: AbortSignal) => Promise<T>,
  callerSignal?: AbortSignal | null,
): Promise<T> {
  const controller = new AbortController();
  let rejectAbort: (error: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    const error = new Error('Request timed out or was cancelled');
    error.name = 'AbortError';
    controller.abort();
    rejectAbort(error);
  };
  const timer = setTimeout(abort, milliseconds);
  callerSignal?.addEventListener('abort', abort, { once: true });
  try {
    if (callerSignal?.aborted) abort();
    return await Promise.race([
      aborted,
      Promise.resolve().then(() => {
        assertRequestActive(controller.signal);
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abort);
  }
}

export function assertRequestActive(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Request cancelled');
    error.name = 'AbortError';
    throw error;
  }
}
