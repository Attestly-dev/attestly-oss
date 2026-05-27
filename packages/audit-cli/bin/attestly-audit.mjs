#!/usr/bin/env node
// Tiny CLI shell around src/verify.mjs.
// Usage:
//   attestly-audit verify <export.json>
//   attestly-audit head   <export.json>

import { readFile } from "node:fs/promises";
import { argv, exit, stderr, stdout } from "node:process";
import { verifyExport, verifyChain } from "../src/verify.mjs";

function usage() {
  stderr.write(
    [
      "attestly-audit — offline verifier for Attestly audit-log JSON exports",
      "",
      "Usage:",
      "  attestly-audit verify <export.json>   Verify chain + Ed25519 signature",
      "  attestly-audit head   <export.json>   Print the re-derived head hash",
      "",
      "Exit codes: 0 on success, 1 on verification failure, 2 on usage error.",
      "",
    ].join("\n"),
  );
}

async function loadExport(path) {
  if (!path) {
    usage();
    exit(2);
  }
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    stderr.write(`error: could not read ${path}: ${err.message}\n`);
    exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    stderr.write(`error: ${path} is not valid JSON: ${err.message}\n`);
    exit(2);
  }
}

const [, , cmd, file] = argv;

if (!cmd || cmd === "-h" || cmd === "--help") {
  usage();
  exit(cmd ? 0 : 2);
}

const exportObj = await loadExport(file);

if (cmd === "verify") {
  const result = verifyExport(exportObj);
  if (result.ok) {
    stdout.write(
      `OK — ${result.count} entries, head ${result.headHash}\n` +
        `signature verified against tenant key (${exportObj.tenant ?? "?"})\n`,
    );
    exit(0);
  }
  stderr.write(
    `FAIL — stage: ${result.stage}\n` +
      `${result.details?.reason ?? JSON.stringify(result.details)}\n`,
  );
  exit(1);
}

if (cmd === "head") {
  const chain = verifyChain(exportObj);
  if (!chain.ok) {
    stderr.write(`FAIL — chain broken: ${chain.reason}\n`);
    exit(1);
  }
  stdout.write(`${chain.headHash}\n`);
  exit(0);
}

stderr.write(`unknown command: ${cmd}\n`);
usage();
exit(2);
