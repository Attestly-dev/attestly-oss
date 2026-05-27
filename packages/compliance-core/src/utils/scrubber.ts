import { AiManifest } from '../types';

const STANDARD_PII_REGEX = [
  // Emails
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // US SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // 16-digit Credit Cards (simple)
  /\b(?:\d[ -]*?){13,16}\b/g,
  // Generic API Keys (e.g., sk-..., AKIA...)
  /\b(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g
];

export function scrubPayload(
  text: string,
  config: AiManifest['piiScrubbing']
): string {
  if (config.level === 'off') {
    return text;
  }

  if (config.level === 'strict') {
    throw new Error('NotImplemented: Strict PII scrubbing is reserved for the Attestly backend ML engine.');
  }

  let scrubbed = text;
  const redactString = config.redactString ?? '[REDACTED]';

  if (config.level === 'standard') {
    for (const regex of STANDARD_PII_REGEX) {
      scrubbed = scrubbed.replace(regex, redactString);
    }
  }

  if (config.customRegex && config.customRegex.length > 0) {
    for (const pattern of config.customRegex) {
      try {
        const regex = new RegExp(pattern, 'g');
        scrubbed = scrubbed.replace(regex, redactString);
      } catch (e) {
        // Ignore invalid regex to prevent crashing the edge function
        console.warn('Invalid custom regex pattern in PII scrubber:', pattern);
      }
    }
  }

  return scrubbed;
}

export function scrubObject(
  obj: any,
  config: AiManifest['piiScrubbing']
): any {
  if (config.level === 'off') return obj;
  if (!obj) return obj;

  if (typeof obj === 'string') {
    return scrubPayload(obj, config);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, config));
  }

  if (typeof obj === 'object') {
    const scrubbedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      scrubbedObj[key] = scrubObject(value, config);
    }
    return scrubbedObj;
  }

  return obj;
}
