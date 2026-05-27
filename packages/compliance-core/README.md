# @attestly/compliance-core

A zero-latency, Web Standard-based SDK that strictly enforces AI compliance at the route boundary, *before* your API executes.

Built specifically to shift **EU AI Act Compliance**, **Model Version Locking**, and **PII Scrubbing** to the absolute left of your development cycle, without adding any overhead to your production environment.

## 🚀 Key Value Propositions

- **Zero-Dependency Core**: The SDK is incredibly lightweight and natively relies on Web Standard `Request` and `Response` objects. No heavy AST parsers or backend-bloat.
- **Zero-Latency (TTFB Protected)**: Validation runs entirely synchronously in milliseconds. In production, the wrapper acts as a near-zero-cost pass-through unless explicitly configured to intercept.
- **EU AI Act Shift-Left**: Catches Prohibited Practices (Article 5), auto-escalates Annex III High-Risk domains (like Law Enforcement, Biometrics, Healthcare, and Critical Infrastructure), and strictly enforces required metadata traceability according to EU regulations.
- **Vercel AI SDK First**: Out-of-the-box support for streaming UIs. It inspects the prompt, scrubs PII, and returns the native `DataStreamResponse` totally untouched so your Lighthouse scores remain pinned at 100.

## 📦 Installation

```bash
npm install @attestly/compliance-core
```

## 🛠 Setup & Initialization

Instead of hand-coding your manifest, use our interactive CLI to intelligently scan your local codebase and generate a compliant `ai-manifest.json`.

```bash
npx @attestly/cli init
```

The CLI will:
1. Scan your project for AI model strings (e.g., `gpt-4o`, `claude-3-opus`).
2. Ask you to classify your primary System Domain under the EU AI Act.
3. Automatically escalate the risk category if you select high-risk domains.
4. Output your locked-down `ai-manifest.json`.

## 💻 Usage

### The "One-Shot" AI Setup Prompt
Instead of reading docs, just copy and paste this prompt directly into **Cursor, GitHub Copilot, or ChatGPT** to have it auto-configure your entire repository:

> Please configure my codebase for EU AI Act Compliance using Attestly:
> 1. Run \`npm install @attestly/compliance-core\` and \`npm install -D @attestly/cli\`
> 2. I know \`npx @attestly/cli init\` is interactive, so please bypass it and directly create an \`ai-manifest.json\` at the root with my allowed AI models and set the euRiskCategory based on my system domain.
> 3. Directly create a global Next.js \`middleware.ts\` (or update my existing one) and inject the \`withAttestlyCompliance\` wrapper from \`@attestly/compliance-core\`.
> 4. Run \`npx @attestly/cli scan\` to verify my API routes are 100% compliant.

### Global Middleware (Recommended)
Instead of wrapping every single API route, drop the wrapper into your Next.js `middleware.ts`. The Attestly CLI scanner will automatically detect this and mark all your routes as protected!

```typescript
import { withAttestlyCompliance } from '@attestly/compliance-core';
import manifest from './ai-manifest.json';
import { NextResponse } from 'next/server';

export default withAttestlyCompliance(async (req) => {
  return NextResponse.next();
}, manifest as any);

export const config = {
  matcher: '/api/:path*',
};
```

### Per-Route Usage (Alternative)
Wrap your existing API routes in Next.js, Remix, or Hono. 

#### Standard API Route

```typescript
import { withAttestlyCompliance } from '@attestly/compliance-core';
import manifest from '../../ai-manifest.json';

async function handler(req: Request) {
  // Your standard LLM logic here...
  return new Response(JSON.stringify({ success: true }));
}

export const POST = withAttestlyCompliance(handler, manifest);
```

### Streaming API Route (Vercel AI SDK)

```typescript
import { withAttestlyStream } from '@attestly/compliance-core';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import manifest from '../../ai-manifest.json';

async function handler(req: Request) {
  const result = await streamText({
    model: openai('gpt-4-0613'),
    prompt: 'Hello world',
  });
  return result.toDataStreamResponse();
}

export const POST = withAttestlyStream(handler, manifest);
```

## 📊 Attestly Studio (Local Telemetry)

You don't need to deploy to test your compliance barriers! Spin up the Attestly Studio right inside your terminal to see a real-time, local dashboard of your AI traffic.

```bash
npx @attestly/cli studio
```

This launches a local dashboard at `http://localhost:5050`. 

- **Real-Time Feed**: Watch your local API requests stream in.
- **Inspector**: Click on a request to see the raw payload, the PII-scrubbed output, and any triggered EU AI Act violations.
- **Handoff**: Click the "Generate Trust Center" button to seamlessly hand off your local manifest to the Attestly SaaS platform to generate a public, SOC2-ready Trust Center!
