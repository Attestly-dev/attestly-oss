import { AiManifest } from '../types';
import { validateManifest } from '../utils/validator';
import { scrubObject } from '../utils/scrubber';
import { pingStudio } from '../utils/telemetry';

export type StreamHandler = (req: Request, ...args: any[]) => Promise<Response> | Response;

/**
 * A specialized wrapper for the Vercel AI SDK streams.
 * Performs a synchronous compliance check upfront and returns the native stream untouched.
 */
export function withAttestlyStream(
  handler: StreamHandler,
  manifest: AiManifest
): StreamHandler {
  return async (req: Request, ...args: any[]) => {
    let clonedReq = req.clone();
    let payload = null;

    try {
      if (clonedReq.headers.get('content-type')?.includes('application/json')) {
        payload = await clonedReq.json();
      }
    } catch (e) {
      // Ignore if body is not readable/json
    }

    if (process.env.NODE_ENV === 'development') {
      const { valid, errors } = validateManifest(payload, req.headers, manifest);

      if (!valid) {
        pingStudio({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          model: payload?.model,
          status: 'blocked',
          prompt: JSON.stringify(payload, null, 2),
          errors
        });
        const errorMessages = errors.map(e => `[${e.code}] ${e.message}`).join('\n');
        throw new Error(`Attestly Compliance Stream Check Failed: \n${errorMessages}`);
      }
    }

    if (payload && manifest.piiScrubbing.level !== 'off') {
      const scrubbedPayload = scrubObject(payload, manifest.piiScrubbing);
      
      pingStudio({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        model: payload?.model,
        status: 'passed',
        prompt: JSON.stringify(payload, null, 2),
        scrubbedPrompt: JSON.stringify(scrubbedPayload, null, 2)
      });

      const newReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(scrubbedPayload),
        // @ts-ignore
        duplex: 'half'
      });
      return handler(newReq, ...args);
    }

    pingStudio({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      model: payload?.model,
      status: 'passed',
      prompt: payload ? JSON.stringify(payload, null, 2) : 'No JSON body'
    });

    // Pass through the DataStreamResponse untouched
    return handler(req, ...args);
  };
}
