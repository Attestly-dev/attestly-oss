import type { ValidationError } from './validator';

export function createComplianceError(errors: ValidationError[]): Response {
  // Use the code from the first error as the primary telemetry code, 
  // or default to BLOCK_ENFORCED if none exists.
  const primaryCode = errors.length > 0 ? errors[0].code : 'BLOCK_ENFORCED';
  
  return new Response(
    JSON.stringify({
      error: 'AttestlyComplianceViolation',
      code: primaryCode,
      details: errors
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Attestly-Blocked': 'true'
      }
    }
  );
}
