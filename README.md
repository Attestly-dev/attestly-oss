# Attestly Open Source 🛡️

Welcome to the official open-source monorepo for [Attestly](https://attestly.dev). This repository contains the developer tools and SDKs designed to help you build AI systems that are compliant with global regulations, including the **EU AI Act**, and maintain high standards for privacy and security.

Our mission is to "shift-left" AI compliance, making it part of the development workflow rather than an afterthought.

---

## 📦 What's inside?

This monorepo contains the following packages:

### 1. [@attestly/compliance-core](./packages/compliance-core)
A zero-latency, Web Standard-based SDK that strictly enforces AI compliance at the route boundary.
- **EU AI Act Enforcement**: Synchronous detection of prohibited practices and high-risk domain escalation.
- **PII Scrubbing**: Automatic detection and masking of sensitive data in LLM prompts.
- **Model Locking**: Ensure only approved and versioned models are used in production.
- **Platform Agnostic**: Works with Next.js, Remix, Hono, and any environment supporting `Request`/`Response`.

### 2. [@attestly/cli](./packages/audit-cli)
The essential developer companion for local AI compliance auditing.
- **`attestly init`**: Interactive scaffolder for your `ai-manifest.json`.
- **`attestly scan`**: Static analyzer to find unversioned models and unprotected routes.
- **`attestly studio`**: Local real-time dashboard for inspecting AI traffic and compliance blocks.
- **`attestly-audit verify`**: Cryptographic verifier for Attestly audit logs.

### 3. [@attestly/studio-ui](./packages/studio-ui)
The shared UI components powering the Attestly local developer experience.

---

## 🚀 Quick Start

Get your project compliant in under 5 minutes.

### 1. Install the tools
```bash
npm install @attestly/compliance-core
npm install -D @attestly/cli
```

### 2. Initialize your Manifest
Run the interactive interview to classify your system and lock your models:
```bash
npx attestly init
```

### 3. Protect your Routes
Drop the compliance wrapper into your Next.js Middleware:
```typescript
import { withAttestlyCompliance } from '@attestly/compliance-core';
import manifest from './ai-manifest.json';
import { NextResponse } from 'next/server';

export default withAttestlyCompliance(async (req) => {
  return NextResponse.next();
}, manifest);

export const config = {
  matcher: '/api/:path*',
};
```

---

## 🛠 Contributing

We love contributions! Whether it's a new detector for a regional regulation, a bug fix, or a feature request, please feel free to open an issue or a pull request.

1. **Clone the repo**: `git clone https://github.com/Attestly-dev/attestly-oss.git`
2. **Install dependencies**: `npm install`
3. **Build the packages**: `npm run build`

Please see our [Contributing Guide](./CONTRIBUTING.md) (coming soon) for more details.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

## 🔗 Links

- **Main Website**: [attestly.dev](https://attestly.dev)
- **Documentation**: [docs.attestly.dev](https://docs.attestly.dev)
- **Support / Issues**: [GitHub Issues](https://github.com/Attestly-dev/attestly-oss/issues)
