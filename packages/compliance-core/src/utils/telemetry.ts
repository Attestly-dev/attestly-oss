export interface TelemetryPayload {
  id: string;
  timestamp: string;
  model?: string;
  status: 'passed' | 'blocked';
  prompt?: string;
  scrubbedPrompt?: string;
  errors?: { code: string; message: string }[];
}

/**
 * Non-blocking ping to the local Attestly Studio.
 * Fails silently if the studio is not running.
 */
export function pingStudio(data: TelemetryPayload) {
  // Only attempt to ping if in development environment
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Fire and forget, no await to prevent TTFB degradation
  fetch('http://localhost:5050/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {
    // Silently ignore if studio isn't running
  });
}
