import assert from 'assert';
import { validateManifest } from '../src/utils/validator';
import { scrubPayload } from '../src/utils/scrubber';

// Define a test manifest
const manifest = {
  allowedModels: ['gpt-4-0613'],
  requiredMetadata: ['sessionId'],
  piiScrubbing: { level: 'standard' as const },
  euRiskCategory: 'high' as const,
  systemDomain: 'law-enforcement' as const,
  prohibitedPractices: { socialScoring: false }
};

console.log('🧪 Starting @attestly/compliance-core Integration Tests...\n');

// Test 1: Model Validation
try {
  const payload = { model: 'gpt-4', sessionId: '123' };
  const headers = new Headers();
  const { valid, errors } = validateManifest(payload, headers, manifest);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.code === 'UNAUTHORIZED_MODEL'));
  console.log('✅ Test 1 Passed: Unauthorized model (gpt-4) correctly blocked.');
} catch (e) {
  console.error('❌ Test 1 Failed:', e);
}

// Test 2: EU AI Act High-Risk Traceability
try {
  const payload = { model: 'gpt-4-0613' }; // Missing sessionId
  const headers = new Headers();
  const { valid, errors } = validateManifest(payload, headers, manifest);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.code === 'MISSING_HIGH_RISK_TRACEABILITY'));
  console.log('✅ Test 2 Passed: High-risk traceability rule correctly enforced.');
} catch (e) {
  console.error('❌ Test 2 Failed:', e);
}

// Test 3: Valid Request
try {
  const payload = { model: 'gpt-4-0613', sessionId: 'session-xyz' };
  const headers = new Headers();
  const { valid, errors } = validateManifest(payload, headers, manifest);
  assert.strictEqual(valid, true);
  assert.strictEqual(errors.length, 0);
  console.log('✅ Test 3 Passed: Valid request accepted.');
} catch (e) {
  console.error('❌ Test 3 Failed:', e);
}

// Test 4: PII Scrubbing
try {
  const prompt = "My email is test@example.com and my SSN is 123-45-6789.";
  const scrubbed = scrubPayload(prompt, { level: 'standard' });
  assert.ok(!scrubbed.includes('test@example.com'));
  assert.ok(!scrubbed.includes('123-45-6789'));
  assert.ok(scrubbed.includes('[REDACTED]'));
  console.log('✅ Test 4 Passed: PII (Email & SSN) successfully redacted.');
} catch (e) {
  console.error('❌ Test 4 Failed:', e);
}

console.log('\n🎉 All tests completed.');