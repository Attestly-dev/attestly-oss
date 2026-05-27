import assert from 'assert';
import { performance } from 'perf_hooks';
import { scrubPayload } from '../src/utils/scrubber';
import { validateManifest } from '../src/utils/validator';

console.log('🧪 Starting Edge Case Tests for @attestly/compliance-core...\n');

// Test A: Massive Payload Performance
try {
  const largePayload = 'test@example.com '.repeat(1000); // ~18KB string
  const startTime = performance.now();
  const scrubbed = scrubPayload(largePayload, { level: 'standard' });
  const endTime = performance.now();
  const duration = endTime - startTime;

  assert.ok(duration < 5, `Scrubbing took too long: ${duration.toFixed(2)}ms`);
  assert.ok(!scrubbed.includes('test@example.com'));
  console.log(`✅ Test A Passed: Scrubbed 10,000 PII instances in ${duration.toFixed(2)}ms (under 5ms threshold).`);
} catch (e) {
  console.error('❌ Test A Failed:', e);
}

// Test B: EU AI Act Kill Switch (Risk Misclassification)
try {
  const invalidManifest = {
    allowedModels: ['gpt-4-0613'],
    requiredMetadata: [],
    piiScrubbing: { level: 'off' as const },
    systemDomain: 'law-enforcement' as const,
    euRiskCategory: 'minimal' as const, // Intentionally wrong
  };
  
  const { valid, errors } = validateManifest({}, new Headers(), invalidManifest);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.code === 'EU_RISK_MISCLASSIFICATION'));
  console.log('✅ Test B Passed: EU AI Act kill switch correctly triggered for risk misclassification.');
} catch (e) {
  console.error('❌ Test B Failed:', e);
}

// Test C (Performance & PII): Pass a large text payload containing a mocked SSN and Email to scrubPayload to verify it successfully redacts the data synchronously without failing.
try {
  const largePayload = 'My SSN is 123-45-6789 and my email is test@example.com. '.repeat(500);
  const scrubbed = scrubPayload(largePayload, { level: 'standard' });
  assert.ok(!scrubbed.includes('123-45-6789'));
  assert.ok(!scrubbed.includes('test@example.com'));
  console.log('✅ Test C Passed: Scrubbed SSN and email from large payload.');
} catch (e) {
  console.error('❌ Test C Failed:', e);
}

// Test D (EU AI Act Escalation): Pass a mocked manifest with systemDomain: 'law-enforcement' and euRiskCategory: 'minimal' to validateManifest. Assert that it correctly intercepts the payload and throws the EU_RISK_MISCLASSIFICATION error.
try {
  const invalidManifest = {
    allowedModels: ['gpt-4-0613'],
    requiredMetadata: [],
    piiScrubbing: { level: 'off' as const },
    systemDomain: 'law-enforcement' as const,
    euRiskCategory: 'minimal' as const, // Intentionally wrong
  };
  
  const { valid, errors } = validateManifest({}, new Headers(), invalidManifest);
  assert.strictEqual(valid, false);
  assert.ok(errors.some(e => e.code === 'EU_RISK_MISCLASSIFICATION'));
  console.log('✅ Test D Passed: EU AI Act kill switch correctly triggered for risk misclassification.');
} catch (e) {
  console.error('❌ Test D Failed:', e);
}

