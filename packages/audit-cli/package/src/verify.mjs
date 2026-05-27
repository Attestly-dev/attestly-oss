// Pure-Node verifier for Attestly audit-log JSON exports.
// Re-derives the SHA-256 chain hash for each entry and verifies the
// Ed25519 signature on the canonical export header. Zero dependencies
// outside `node:crypto` so auditors can audit the verifier itself.

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Stable JSON: keys sorted, no whitespace, undefined skipped.
 * Mirrors `src/lib/audit/hash.ts`.
 */
export function canonicalJson(input) {
  if (input === null || typeof input !== "object")
    return JSON.stringify(input);
  if (Array.isArray(input)) {
    return "[" + input.map((v) => canonicalJson(v)).join(",") + "]";
  }
  const keys = Object.keys(input).sort();
  const parts = [];
  for (const k of keys) {
    const v = input[k];
    if (v === undefined) continue;
    parts.push(JSON.stringify(k) + ":" + canonicalJson(v));
  }
  return "{" + parts.join(",") + "}";
}

export function sha256Hex(s) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function computeChainHash(prevHash, body) {
  return sha256Hex((prevHash || "") + canonicalJson(body));
}

/**
 * Re-derive the canonical body that the server hashed for one log entry.
 * The server uses camelCase fields and the tenant/actor UUIDs that are
 * stored on the row, so an export must include `tenant_id` /
 * `actor_user_id` for offline verification to be possible.
 */
function bodyForEntry(entry) {
  if (entry.tenant_id === undefined) {
    throw new Error(
      `entry ${entry.id} is missing tenant_id — re-export with the latest API`,
    );
  }
  if (entry.actor_user_id === undefined) {
    throw new Error(
      `entry ${entry.id} is missing actor_user_id — re-export with the latest API`,
    );
  }
  return {
    id: entry.id,
    tenantId: entry.tenant_id,
    actorUserId: entry.actor_user_id,
    action: entry.action,
    target: entry.target ?? null,
    metadata: entry.metadata ?? {},
    prevHash: entry.prev_hash ?? null,
    createdAt: entry.created_at,
  };
}

/**
 * Verify the chain integrity of every entry in a parsed export.
 * Returns `{ ok: true, count }` on success; `{ ok: false, brokenAt, entryId }`
 * at the first mismatch.
 */
export function verifyChain(exportObj) {
  if (!exportObj || !Array.isArray(exportObj.log)) {
    return { ok: false, brokenAt: -1, entryId: null, reason: "no log array" };
  }
  // The server orders newest-first in the JSON export; chain verification
  // must run oldest-first (the genesis prev_hash is null/empty).
  const entries = [...exportObj.log].sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  let prev = "";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const body = bodyForEntry(e);
    const expected = computeChainHash(prev, body);
    if (expected !== e.chain_hash) {
      return {
        ok: false,
        brokenAt: i,
        entryId: e.id,
        reason: `chain_hash mismatch for entry ${e.id} (expected ${expected.slice(0, 16)}…, got ${(e.chain_hash || "").slice(0, 16)}…)`,
      };
    }
    prev = e.chain_hash;
  }
  return { ok: true, count: entries.length, headHash: prev };
}

/**
 * Verify the Ed25519 signature stamped onto the export header. Returns
 * `{ ok: true }` on success or `{ ok: false, reason }`.
 */
export function verifySignature(exportObj) {
  if (
    !exportObj ||
    typeof exportObj.signature !== "string" ||
    typeof exportObj.public_key_pem !== "string"
  ) {
    return { ok: false, reason: "export missing signature or public_key_pem" };
  }
  if ((exportObj.signature_alg ?? "ed25519") !== "ed25519") {
    return { ok: false, reason: `unknown signature_alg ${exportObj.signature_alg}` };
  }
  const headerPayload = JSON.stringify({
    tenant: exportObj.tenant,
    head_hash: exportObj.head_chain_hash,
    entries: exportObj.entries,
    generated_at: exportObj.generated_at,
  });
  let key;
  try {
    key = createPublicKey({ key: exportObj.public_key_pem, format: "pem" });
  } catch (err) {
    return {
      ok: false,
      reason: `public_key_pem is not a valid PEM key: ${err.message}`,
    };
  }
  const sig = Buffer.from(exportObj.signature, "base64url");
  // Ed25519 produces a fixed 64-byte signature.
  if (sig.length !== 64) {
    return {
      ok: false,
      reason: `signature is ${sig.length} bytes; expected 64 (Ed25519)`,
    };
  }
  const ok = cryptoVerify(null, Buffer.from(headerPayload, "utf8"), key, sig);
  return ok ? { ok: true } : { ok: false, reason: "signature did not verify" };
}

/**
 * Top-level orchestration: verify chain *and* signature, plus check that
 * the head hash recorded in the header matches what we re-derived.
 */
export function verifyExport(exportObj) {
  const chain = verifyChain(exportObj);
  if (!chain.ok) {
    return { ok: false, stage: "chain", details: chain };
  }
  if (
    exportObj.head_chain_hash &&
    exportObj.head_chain_hash !== chain.headHash
  ) {
    return {
      ok: false,
      stage: "head",
      details: {
        reason: `header head_chain_hash (${exportObj.head_chain_hash.slice(0, 16)}…) does not match re-derived head (${chain.headHash.slice(0, 16)}…)`,
      },
    };
  }
  const sig = verifySignature(exportObj);
  if (!sig.ok) {
    return { ok: false, stage: "signature", details: sig };
  }
  return { ok: true, count: chain.count, headHash: chain.headHash };
}
