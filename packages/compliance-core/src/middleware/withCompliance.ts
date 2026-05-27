import { AiManifest } from '../types';
import { createComplianceError } from '../utils/errors';
import { validateManifest } from '../utils/validator';
import { scrubObject } from '../utils/scrubber';
import { pingStudio } from '../utils/telemetry';

export type RequestHandler = (req: Request, ...args: any[]) => Promise<Response> | Response;

/**
 * A higher-order function that wraps a standard Web API Request handler
 * to enforce AI compliance according to the provided manifest.
 */
export function withAttestlyCompliance(
  handler: RequestHandler,
  manifest: AiManifest
): RequestHandler {
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
          prompt: payload ? JSON.stringify(payload, null, 2) : 'No JSON body',
          errors
        });
        return createComplianceError(errors);
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

    return handler(req, ...args);
  };
}
