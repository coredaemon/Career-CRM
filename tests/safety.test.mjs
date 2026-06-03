import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test(".gitignore protects local private data", async () => {
  const gitignore = await readFile(".gitignore", "utf8");
  const required = [
    ".env",
    ".env.local",
    ".env.*.local",
    "*.sqlite",
    "*.sqlite3",
    "prisma/dev.db",
    "/app_data/",
    "/local_data/",
    "/browser-profile/",
    "/storage/",
    "/uploads/",
    "/resumes/",
    "/memory/",
    "/knowledge/",
    "/exported/",
    "/logs/",
    "node_modules/",
    ".next/",
    "dist/",
    "build/"
  ];

  for (const pattern of required) {
    assert.match(gitignore, new RegExp(`^${escapeRegExp(pattern)}$`, "m"), `${pattern} must be ignored`);
  }
});

test(".env.example contains only safe templates", async () => {
  const envExample = await readFile(".env.example", "utf8");

  assert.equal(
    envExample.trim(),
    [
      "AI_PROVIDER=",
      "AI_BASE_URL=",
      "AI_API_KEY=",
      "AI_PRIMARY_MODEL=",
      "DEEPSEEK_API_KEY=",
      "OPENAI_API_KEY=",
      "AI_ANALYSIS_PROVIDER=deepseek",
      "AI_ANALYSIS_BASE_URL=https://api.deepseek.com/v1",
      "AI_ANALYSIS_MODEL=deepseek-v4-flash",
      "AI_FAST_MODEL=deepseek-v4-flash",
      "AI_WRITER_PROVIDER=openai",
      "AI_WRITER_BASE_URL=https://api.openai.com/v1",
      "AI_WRITER_MODEL=gpt-5.4-mini",
      "AI_REVIEWER_MODEL=gpt-5.4-mini",
      'DATABASE_URL="file:./dev.db"'
    ].join("\n")
  );
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
