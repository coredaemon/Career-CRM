"use client";

import { BulkAiAnalyzeButton } from "@/components/bulk-ai-analyze-button";

export function BulkCreateLettersButton({ label = "Создать письма для рекомендованных" }: { label?: string }) {
  return <BulkAiAnalyzeButton label={label} defaultMode="letters_only" lettersOnlyDirect />;
}
