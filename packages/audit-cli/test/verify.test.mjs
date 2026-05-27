// Black-box tests for the verifier. We synthesise an Ed25519 keypair,
// build a 3-entry chain by hand using the same canonical body the server
// uses, sign the canonical header, and check that:
//   1. a clean export verifies
//   2. tampering with metadata breaks the chain
//   3. tampering with the signature is caught
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { strict as assert } from "node:assert";
import {
  canonicalJson,
  computeChainHash,
  verifyExport,
} from "../src/verify.mjs";

function buildEntry({
  id,
  tenantId,
  actorUserId,
  action,
  target,
  metadata,
  prevHash,
  createdAt,
}) {
  const body = {
    id,
    tenantId,
    actorUserId,
    action,
    target: target ?? null,
    metadata: metadata ?? {},
    prevHash: prevHash ?? null,
    createdAt,
  };
  const chainHash = computeChainHash(prevHash ?? "", body);
  return {
    id,
    tenant_id: tenantId,
    actor_user_id: actorUserId,
    actor_email: "test@example.com",
    action,
    target: target ?? null,
    metadata: metadata ?? {},
    prev_hash: prevHash ?? null,
    chain_hash: chainHash,
    created_at: createdAt,
  };
}

function buildExport() {
  const tenantId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const e1 = buildEntry({
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    tenantId,
    actorUserId: userId,
    action: "settings.branding.update",
    target: "tenant-slug",
    metadata: { primaryColor: "#112233" },
    prevHash: null,
    createdAt: "2026-05-01T10:00:00.000Z",
  });
  const e2 = buildEntry({
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    tenantId,
    actorUserId: userId,
    action: "team.invite.create",
    target: "alice@example.com",
    metadata: { role: "approver" },
    prevHash: e1.chain_hash,
    createdAt: "2026-05-02T10:00:00.000Z",
  });
  const e3 = buildEntry({
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    tenantId,
    actorUserId: userId,
    action: "document.publish",
    target: "ai_trust_center",
    metadata: { version: 7 },
    prevHash: e2.chain_hash,
    createdAt: "2026-05-03T10:00:00.000Z",
  });

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey
    .export({ format: "pem", type: "spki" })
    .toString();

  const exportObj = {
    tenant: "acme",
    generated_at: "2026-05-09T18:00:00.000Z",
    entries: 3,
    head_chain_hash: e3.chain_hash,
    signature_alg: "ed25519",
    public_key_pem: publicKeyPem,
    log: [e3, e2, e1], // server returns newest-first
  };
  const headerPayload = JSON.stringify({
    tenant: exportObj.tenant,
    head_hash: exportObj.head_chain_hash,
    entries: exportObj.entries,
    generated_at: exportObj.generated_at,
  });
  exportObj.signature = cryptoSign(
    null,
    Buffer.from(headerPayload, "utf8"),
    privateKey,
  ).toString("base64url");
  return exportObj;
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

const ok = verifyExport(buildExport());
assert.equal(ok.ok, true, "clean export must verify");
assert.equal(ok.count, 3);

const tamperedMeta = clone(buildExport());
tamperedMeta.log[1].metadata = { role: "admin" }; // was "approver"
const r2 = verifyExport(tamperedMeta);
assert.equal(r2.ok, false, "metadata tampering must fail chain check");
assert.equal(r2.stage, "chain");

const tamperedSig = clone(buildExport());
const sigBuf = Buffer.from(tamperedSig.signature, "base64url");
sigBuf[0] = sigBuf[0] ^ 0x01;
tamperedSig.signature = sigBuf.toString("base64url");
const r3 = verifyExport(tamperedSig);
assert.equal(r3.ok, false, "signature tampering must fail signature check");
assert.equal(r3.stage, "signature");

// Canonical-JSON sanity: order of keys must not affect the digest.
assert.equal(
  canonicalJson({ b: 1, a: 2 }),
  canonicalJson({ a: 2, b: 1 }),
  "canonicalJson must be order-stable",
);

console.log("audit-cli verifier: 4/4 tests passed");
