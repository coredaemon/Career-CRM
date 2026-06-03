export function extractJsonFromAiResponse(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (isValidJson(candidate)) return candidate;
  }

  if (isValidJson(trimmed)) return trimmed;

  const objectMatch = findFirstJsonObject(trimmed);
  if (objectMatch && isValidJson(objectMatch)) return objectMatch;

  return null;
}

function findFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function isValidJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function parseAiJsonResponse<T>(text: string): T {
  const extracted = extractJsonFromAiResponse(text);
  if (!extracted) {
    throw new Error("INVALID_AI_JSON");
  }
  return JSON.parse(extracted) as T;
}
