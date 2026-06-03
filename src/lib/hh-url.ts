const HH_HOSTS = new Set(["hh.ru", "www.hh.ru", "spb.hh.ru", "m.hh.ru"]);

const DENY_PATH_PREFIXES = [
  "/search/vacancy",
  "/applicant/resumes",
  "/account/login",
  "/article",
  "/employer"
];

function parseHhUrl(url: string): URL | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (!HH_HOSTS.has(host) && !host.endsWith(".hh.ru")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractHhVacancyId(url: string): string | null {
  const parsed = parseHhUrl(url);
  if (!parsed) return null;

  const pathMatch = parsed.pathname.match(/\/vacancy\/(\d+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  if (parsed.pathname.includes("/applicant/vacancy_response")) {
    const vacancyId = parsed.searchParams.get("vacancyId");
    if (vacancyId && /^\d+$/.test(vacancyId)) return vacancyId;
  }

  return null;
}

function isDeniedPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return DENY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isHhVacancyUrl(url: string): boolean {
  const parsed = parseHhUrl(url);
  if (!parsed) return false;

  const id = extractHhVacancyId(url);
  if (!id) return false;

  if (isDeniedPath(parsed.pathname)) return false;

  // Must be a direct vacancy card path, not search/advanced/etc.
  if (!parsed.pathname.match(/^\/vacancy\/\d+/)) {
    // Allow applicant response page if vacancyId is present
    if (!parsed.pathname.includes("/applicant/vacancy_response")) return false;
  }

  return true;
}

export function normalizeHhVacancyUrl(url: string): string | null {
  const id = extractHhVacancyId(url);
  if (!id || !isHhVacancyUrl(url)) return null;
  return `https://hh.ru/vacancy/${id}`;
}
