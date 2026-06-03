export type SkippedItemForLog = {
  errorCode: string;
  errorMessage: string;
  sourceUrl: string;
};

export function groupSkippedLogMessages(items: SkippedItemForLog[]) {
  const byCode = new Map<string, { count: number; urls: string[]; sampleMessage: string }>();

  for (const item of items) {
    const existing = byCode.get(item.errorCode);
    if (existing) {
      existing.count += 1;
      if (existing.urls.length < 5 && !existing.urls.includes(item.sourceUrl)) {
        existing.urls.push(item.sourceUrl);
      }
    } else {
      byCode.set(item.errorCode, {
        count: 1,
        urls: [item.sourceUrl],
        sampleMessage: item.errorMessage
      });
    }
  }

  const lines: string[] = [];
  for (const [code, group] of byCode) {
    if (code === "NOT_HH_VACANCY_URL") {
      lines.push(`Пропущены служебные ссылки hh: ${group.count}`);
    } else if (code === "SERVICE_PAGE" || code === "COOKIE_OR_NAVIGATION_PAGE") {
      lines.push(`Пропущены служебные страницы hh: ${group.count}`);
    } else {
      lines.push(`Пропущено невалидных страниц (${code}): ${group.count}`);
    }
  }

  return { summaryLines: lines, byCode };
}
