import assert from "node:assert/strict";
import test from "node:test";

const { listKeyByIndex } = await import("../src/lib/ui-list-keys.ts");

test("listKeyByIndex produces unique keys for duplicate lines", () => {
  const lines = ["same", "same", "same"];
  const keys = lines.map((_, index) => listKeyByIndex("log", index));
  assert.equal(new Set(keys).size, 3);
  assert.equal(keys[0], "log-0");
  assert.equal(keys[1], "log-1");
});
