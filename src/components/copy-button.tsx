"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button variant="secondary" onClick={copy}>
      {copied ? "Скопировано" : label}
    </Button>
  );
}
