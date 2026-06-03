export type AnalysisMode = "fast" | "full" | "letters_only";

export const analysisModeLabels: Record<AnalysisMode, string> = {
  fast: "Быстрый анализ",
  full: "Полный анализ",
  letters_only: "Только письма для рекомендованных"
};

export function parseAnalysisMode(value: unknown): AnalysisMode {
  if (value === "full" || value === "letters_only") return value;
  return "fast";
}

export function analysisModeIncludesReviewer(mode: AnalysisMode) {
  return mode === "full";
}

export function analysisModeIncludesWriter(mode: AnalysisMode) {
  return mode === "full" || mode === "letters_only";
}

export function analysisModeIncludesAnalysis(mode: AnalysisMode) {
  return mode === "fast" || mode === "full";
}
