# @attestly/cli

The official CLI for [Attestly](https://attestly.dev), providing local developer tooling for AI compliance under the EU AI Act.

## Installation

```bash
npm install -g @attestly/cli
```

## Features

### 1. The Scaffolder (`init`)
Generates a strictly typed `ai-manifest.json` by walking you through an interactive terminal interview about your EU AI Act risk categories and system domains.

```bash
attestly init
```
*Note: Automatically enforces Annex III High-Risk classification for sensitive domains (Law Enforcement, Education, Employment, Critical Infrastructure, Essential Services, Biometrics, Migration, and Justice).*

### 2. The Static Scanner (`scan`)
Parses the local codebase to find unversioned AI models and unprotected API routes before the code is ever executed.

```bash
attestly scan
```

### 3. Attestly Studio (`studio`)
Spins up a local Vite-based dashboard on port 5050 that subscribes to Server-Sent Events, providing a real-time visual feed of compliance blocks and PII scrubbing.

```bash
attestly studio
```

### 4. Audit Log Verifier (`verify`)
Offline verifier for Attestly audit-log JSON exports. Re-derives the SHA-256 chain hash for every entry and verifies the Ed25519 signature.

```bash
attestly-audit verify path/to/attestly-audit-acme-2026-05-09.json
```

## License
MIT
