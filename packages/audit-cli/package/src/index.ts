#!/usr/bin/env node

import * as p from '@clack/prompts';
import { setTimeout } from 'timers/promises';
import fs from 'fs';
import path from 'path';
import { runScanner } from './scanner';
import { startStudioServer } from './server';
import pc from 'picocolors';

function detectModelsInCodebase(): string[] {
  const models = new Set<string>();
  const scanDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !['node_modules', '.git', 'dist', '.next'].includes(file)) {
        scanDir(fullPath);
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(file)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Look specifically for models wrapped in quotes (e.g. 'gpt-4o' or "claude-3-opus") 
          // or assigned to a model property (model: '...') to reduce overdetection in comments/docs.
          const matches = content.matchAll(/(?:model\s*[:=]\s*['"]|['"])(gpt-[a-z0-9-]+|claude-[a-z0-9-]+|gemini-[a-z0-9.-]+|o1-[a-z0-9-]+)['"]/gi);
          for (const match of matches) {
            if (match[1]) models.add(match[1].toLowerCase());
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  };
  
  scanDir(process.cwd());
  const uniqueModels = Array.from(models).sort();
  // Limit to avoid clack prompt rendering issues on Windows
  return uniqueModels.slice(0, 15);
}

async function main() {
  if (process.argv.includes('scan')) {
    await runScanner();
    return;
  }

  if (process.argv.includes('studio')) {
    startStudioServer();
    console.clear();
    p.intro(pc.bgGreen(pc.white(' Attestly Studio ')));
    p.log.success(`🚀 Attestly Studio running at ${pc.cyan('http://localhost:5050')}`);
    p.note('Listening for local AI telemetry events...');
    return;
  }

  console.clear();
  console.log(pc.green(`
   █████╗ ████████╗████████╗███████╗███████╗████████╗██╗  ██╗   ██╗
  ██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██║  ╚██╗ ██╔╝
  ███████║   ██║      ██║   █████╗  ███████╗   ██║   ██║   ╚████╔╝ 
  ██╔══██║   ██║      ██║   ██╔══╝  ╚════██║   ██║   ██║    ╚██╔╝  
  ██║  ██║   ██║      ██║   ███████╗███████║   ██║   ███████╗██║   
  ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚══════╝   ╚═╝   ╚══════╝╚═╝   
  `));
  console.log(pc.dim('  The AI Compliance Framework for Next.js and Node.js\n'));

  p.intro("Let's configure your AI compliance rules (ai-manifest.json)");

  const s = p.spinner();
  s.start('Scanning codebase for AI models...');
  const detectedModels = detectModelsInCodebase();
  s.stop(detectedModels.length > 0 
    ? `Scanner finished.` 
    : 'No models automatically detected.');

  let finalModels: string[] = [];

  if (detectedModels.length > 0) {
    const useDetected = await p.confirm({
      message: `We detected these models: ${detectedModels.join(', ')}.\nDo you want to use them?`,
      initialValue: true,
    });

    if (p.isCancel(useDetected)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    if (useDetected) {
      finalModels = detectedModels;
    }
  }

  if (finalModels.length === 0) {
    const modelsInput = await p.text({
      message: 'Which AI models will this project use? (Comma-separated, e.g., gpt-4-0613, claude-3-opus)',
      placeholder: 'gpt-4-0613',
      validate(value) {
        if (!value.trim()) return 'At least one model must be provided.';
      }
    });

    if (p.isCancel(modelsInput)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    finalModels = (modelsInput as string)
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);
  }

  const systemDomain = await p.select({
    message: 'What is the primary system domain?',
    options: [
      { value: 'general', label: 'General / Chat' },
      { value: 'law-enforcement', label: 'Law Enforcement' },
      { value: 'education', label: 'Education' },
      { value: 'employment', label: 'Employment' },
      { value: 'critical-infrastructure', label: 'Critical Infrastructure' },
      { value: 'biometrics', label: 'Biometrics' },
      { value: 'essential-services', label: 'Essential Services (Healthcare, Credit, etc.)' },
      { value: 'migration', label: 'Migration & Border Control' },
      { value: 'justice', label: 'Administration of Justice' },
    ],
  });

  if (p.isCancel(systemDomain)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  // Force 'high' risk if Annex III domain
  let euRiskCategory: string;

  if (
    systemDomain === 'law-enforcement' ||
    systemDomain === 'biometrics' ||
    systemDomain === 'education' ||
    systemDomain === 'employment' ||
    systemDomain === 'critical-infrastructure' ||
    systemDomain === 'essential-services' ||
    systemDomain === 'migration' ||
    systemDomain === 'justice'
  ) {
    p.note('Under Annex III of the EU AI Act, this domain is automatically classified as high-risk.');
    euRiskCategory = 'high';
  } else {
    const riskChoice = await p.select({
      message: 'Based on the EU AI Act, what is your estimated risk category?',
      options: [
        { value: 'minimal', label: 'Minimal Risk' },
        { value: 'limited', label: 'Limited Risk' },
        { value: 'high', label: 'High Risk' },
        { value: 'gpai', label: 'General Purpose AI (GPAI)' },
      ],
    });

    if (p.isCancel(riskChoice)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    euRiskCategory = riskChoice as string;
  }

  const enableScrubbing = await p.confirm({
    message: 'Enable standard PII scrubbing for outgoing prompts?',
    initialValue: true,
  });

  if (p.isCancel(enableScrubbing)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start('Generating ai-manifest.json...');
  await setTimeout(500);

  const manifest = {
    allowedModels: finalModels,
    requiredMetadata: euRiskCategory === 'high' ? ['sessionId', 'purpose'] : ['sessionId'],
    piiScrubbing: {
      level: enableScrubbing ? 'standard' : 'off'
    },
    euRiskCategory,
    systemDomain,
    prohibitedPractices: {
      realTimeBiometrics: false,
      socialScoring: false,
      emotionRecognition: false,
      manipulativeAI: false,
      untargetedScraping: false
    }
  };

  const outputPath = path.join(process.cwd(), 'ai-manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

  spinner.stop('Manifest created.');

  p.outro('✅ ai-manifest.json created successfully. Next step: Wrap your routes with withAttestlyCompliance().');
}

main().catch(console.error);
