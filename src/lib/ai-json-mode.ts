export function supportsJsonMode(provider: string): boolean {
  const id = provider.toLowerCase();
  if (id === "openai" || id === "deepseek" || id === "compatible") return true;
  return false;
}

export function isResponseFormatError(status: number, body: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lower = body.toLowerCase();
  return lower.includes("response_format") || lower.includes("json_object") || lower.includes("json mode");
}
