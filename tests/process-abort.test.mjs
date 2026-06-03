import assert from "node:assert/strict";
import test from "node:test";

const {
  createProcessAbortController,
  abortProcess,
  getProcessAbortSignal,
  isAbortError
} = await import("../src/lib/process-abort-registry.ts");

test("abortProcess aborts signal", () => {
  const signal = createProcessAbortController("proc-1");
  assert.equal(signal.aborted, false);
  abortProcess("proc-1");
  assert.equal(getProcessAbortSignal("proc-1"), undefined);
});

test("isAbortError detects AbortError", () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  assert.equal(isAbortError(err), true);
});
