import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface ScanResult {
  file: string;
  absolutePath: string;
  compliant: boolean;
  errors: string[];
}

export async function runScannerSilent(): Promise<{ compliant: boolean, results: ScanResult[] }> {
  // Step A: Load Manifest
  const manifestPath = path.join(process.cwd(), 'ai-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Could not find ai-manifest.json in the current directory.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const allowedModels: string[] = manifest.allowedModels || [];

  // Step B: File Crawl
  const filesToScan: string[] = [];

  function crawl(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        crawl(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        filesToScan.push(fullPath);
      }
    }
  }

  crawl(path.join(process.cwd(), 'src'));
  crawl(path.join(process.cwd(), 'app')); // Next.js specific if outside src

  // Check if global middleware is protecting the routes
  let hasGlobalMiddleware = false;
  const possibleMiddlewarePaths = [
    path.join(process.cwd(), 'middleware.ts'),
    path.join(process.cwd(), 'src', 'middleware.ts')
  ];
  
  for (const mwPath of possibleMiddlewarePaths) {
    if (fs.existsSync(mwPath)) {
      const mwContent = fs.readFileSync(mwPath, 'utf-8');
      if (/@attestly\/compliance-core/.test(mwContent)) {
        hasGlobalMiddleware = true;
        break;
      }
    }
  }

  // Step C: File Analysis
  const results: ScanResult[] = [];
  
  // Regex patterns
  const aiImportRegex = /from\s+['"](ai|@ai-sdk\/.*|openai|@anthropic-ai\/sdk|@google\/generative-ai)['"]/g;
  const requireRegex = /require\(['"](ai|@ai-sdk\/.*|openai|@anthropic-ai\/sdk|@google\/generative-ai)['"]\)/g;
  const wrapperImportRegex = /@attestly\/compliance-core/;
  
  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check if it's an AI file
    const hasAiImport = aiImportRegex.test(content) || requireRegex.test(content);
    if (!hasAiImport) continue;

    const errors: string[] = [];

    // Check 1: Boundary Wrapping
    if (!hasGlobalMiddleware && !wrapperImportRegex.test(content)) {
      errors.push('Missing compliance wrapper. Wrap this route or add @attestly/compliance-core to middleware.ts');
    }

    // Check 2: Static Model Linter
    const modelMatches = content.matchAll(/(?:model\s*[:=]\s*['"]|(?:openai|anthropic|google|gemini)\s*\(\s*['"])(gpt-[a-z0-9-]+|claude-[a-z0-9-]+|gemini-[a-z0-9.-]+|o1-[a-z0-9-]+)['"]/gi);
    
    for (const match of modelMatches) {
      if (match[1]) {
        const foundModel = match[1].toLowerCase();
        if (!allowedModels.includes(foundModel)) {
          errors.push(`Unauthorized model found: '${foundModel}'. Must be one of: ${allowedModels.join(', ')}`);
        }
      }
    }

    results.push({
      file: path.relative(process.cwd(), file),
      absolutePath: path.resolve(file),
      compliant: errors.length === 0,
      errors
    });
  }

  return {
    compliant: results.every(r => r.compliant),
    results
  };
}

export async function runScanner() {
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

  p.intro(pc.bgGreen(pc.black(' Attestly Compliance Scanner ')));

  const spinner = p.spinner();
  spinner.start('Scanning workspace for AI integration...');

  try {
    const { compliant, results } = await runScannerSilent();
    spinner.stop('Scan complete.');

    if (results.length === 0) {
      p.log.info('No AI integrations found in the codebase.');
      p.outro(pc.green('Scan passed: 100% compliant.'));
      process.exit(0);
    } else {
      let hasViolations = false;
      for (const res of results) {
        if (res.compliant) {
          p.log.success(`${pc.green('✔')} ${res.file} - ${pc.dim('Compliant')}`);
        } else {
          hasViolations = true;
          p.log.error(`${pc.red('✖')} ${res.file}`);
          for (const err of res.errors) {
            p.log.message(`   ${pc.yellow('⚠')} ${err}`);
          }
        }
      }

      if (hasViolations) {
        p.note('Drift detected! Update your ai-manifest.json or fix the code to proceed.', 'Action Required');
        p.outro(pc.red('Scan failed: Compliance violations detected.'));
        process.exit(1);
      } else {
        p.outro(pc.green('Scan passed: 100% compliant.'));
        process.exit(0);
      }
    }
  } catch (err: any) {
    spinner.stop('Scan failed.');
    p.log.error(err.message);
    process.exit(1);
  }
}
