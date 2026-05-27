import { strict as assert } from "node:assert";
import { defineDetectors } from "../index.mjs";

const list = [{ key: "test", purpose: "x" }];
assert.strictEqual(
  defineDetectors(list),
  list,
  "defineDetectors must be the identity function",
);
console.log("sdk shim: 1/1 test passed");
