import { AiManifest } from '../types';

export interface ValidationError {
  code: string;
  message: string;
}

export function validateManifest(
  payload: any,
  headers: Headers,
  manifest: AiManifest
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // ---------------------------------------------------------
  // Existing Rules
  // ---------------------------------------------------------

  // Rule 1: Strict Model Locking
  if (payload && payload.model) {
    const model = String(payload.model);
    
    // Check against allowedModels
    if (!manifest.allowedModels.includes(model)) {
      errors.push({
        code: 'UNAUTHORIZED_MODEL',
        message: `Model '${model}' is not in the allowedModels list.`
      });
    }

    // Enforce version/date suffixes regex
    const versionRegex = /-[0-9]+(-[0-9]+)*$/;
    if (!versionRegex.test(model)) {
      errors.push({
        code: 'INVALID_MODEL_VERSION',
        message: `Model '${model}' must contain a strict version or date suffix (e.g., 'gpt-4-0613').`
      });
    }
  }

  // Rule 2: Traceability
  for (const requiredKey of manifest.requiredMetadata) {
    const hasInPayload = payload && payload[requiredKey] !== undefined;
    const hasInHeader = headers.has(requiredKey) || headers.has(`x-${requiredKey}`);

    if (!hasInPayload && !hasInHeader) {
      errors.push({
        code: 'MISSING_REQUIRED_METADATA',
        message: `Missing required metadata: '${requiredKey}'.`
      });
    }
  }

  // ---------------------------------------------------------
  // EU AI Act Rules
  // ---------------------------------------------------------

  // Rule A (The Kill Switch): Prohibited Practices
  if (manifest.prohibitedPractices) {
    const practices = Object.entries(manifest.prohibitedPractices);
    for (const [practice, isEnabled] of practices) {
      if (isEnabled === true) {
        errors.push({
          code: 'EU_PROHIBITED_PRACTICE',
          message: `Under Article 5 of the EU AI Act, the practice '${practice}' is prohibited. Execution blocked.`
        });
      }
    }
  }

  // Rule B (Law Enforcement Escalation): Auto-classify high-risk domains
  if (
    manifest.systemDomain === 'law-enforcement' ||
    manifest.systemDomain === 'biometrics' ||
    manifest.systemDomain === 'education' ||
    manifest.systemDomain === 'employment' ||
    manifest.systemDomain === 'critical-infrastructure' ||
    manifest.systemDomain === 'essential-services' ||
    manifest.systemDomain === 'migration' ||
    manifest.systemDomain === 'justice'
  ) {
    if (manifest.euRiskCategory === 'minimal' || manifest.euRiskCategory === 'limited') {
      errors.push({
        code: 'EU_RISK_MISCLASSIFICATION',
        message: `Under Annex III of the EU AI Act, ${manifest.systemDomain} systems are automatically high-risk. Cannot be classified as ${manifest.euRiskCategory}.`
      });
    }
  }

  // Rule C (Conditional Traceability): High-Risk requires strict logging
  if (manifest.euRiskCategory === 'high') {
    const hasSession = (payload && payload.sessionId !== undefined) || headers.has('sessionId') || headers.has('x-sessionId');
    const hasUserId = (payload && payload.userId !== undefined) || headers.has('userId') || headers.has('x-userId');
    const hasPurpose = (payload && payload.purpose !== undefined) || headers.has('purpose') || headers.has('x-purpose');

    // We can check if these are in requiredMetadata or explicitly check payload/headers
    // Assuming 'sessionId' and 'userId' or 'purpose' are representative traces.
    // The instructions say: "If missing, push an error explaining that High-Risk systems require strict logging"
    // Let's enforce that at least some core traces exist or check requiredMetadata.
    // Given the prompt: "strictly verify that the payload or headers contain traceability metadata (e.g., sessionId, userId). If missing..."
    if (!hasSession && !hasUserId && !hasPurpose) {
      errors.push({
        code: 'MISSING_HIGH_RISK_TRACEABILITY',
        message: 'Under the EU AI Act, High-Risk systems require strict logging traceability. Missing metadata like sessionId, userId, or purpose.'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
