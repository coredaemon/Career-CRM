import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { extractHhVacancyId, isHhVacancyUrl, normalizeHhVacancyUrl } from "@/lib/hh-url";
import { validateVacancyDraft, validationReasonToLog } from "@/lib/vacancy-validation";

export type HhSearchParams = {
  queries: string[];
  region?: string | null;
  limitPerQuery: number;
  totalLimit: number;
  onlyWithSalary?: boolean;
  searchPeriodDays?: number | null;
  workFormat?: string | null;
  onProgress?: (event: HhProgressEvent) => Promise<void> | void;
  shouldStop?: () => Promise<boolean> | boolean;
};

export type HhProgressEvent =
  | { type: "stage"; stage: string; message: string }
  | { type: "query"; query: string; queryIndex: number; totalQueries: number; message: string }
  | { type: "links"; foundLinks: number; message: string }
  | { type: "card"; sourceUrl: string; cardIndex: number; totalCards: number; title?: string; message: string }
  | { type: "skipped"; message: string }
  | { type: "error"; message: string };

export type HhVacancyDraft = {
  title: string;
  companyName?: string | null;
  sourceUrl: string;
  sourceVacancyId?: string | null;
  salaryText?: string | null;
  location?: string | null;
  workFormat?: string | null;
  rawDescription?: string | null;
  publishedAtText?: string | null;
  employerUrl?: string | null;
  isArchived?: boolean | null;
  testRequired?: boolean | null;
  extractionWarning?: string | null;
};

export type HhSkippedItem = {
  sourceUrl: string;
  status: "skipped_not_vacancy" | "skipped_invalid_description";
  errorCode: string;
  errorMessage: string;
};

export type HhSearchResult = {
  foundLinks: string[];
  vacancies: HhVacancyDraft[];
  skippedItems: HhSkippedItem[];
  errors: string[];
  stoppedByCaptcha: boolean;
  stoppedByUser: boolean;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function collectHhVacancies(params: HhSearchParams): Promise<HhSearchResult> {
  let context: BrowserContext | null = null;
  const foundLinks: string[] = [];
  const vacancies: HhVacancyDraft[] = [];
  const skippedItems: HhSkippedItem[] = [];
  const errors: string[] = [];
  let stoppedByCaptcha = false;
  let stoppedByUser = false;

  const emit = async (event: HhProgressEvent) => {
    await params.onProgress?.(event);
  };
  const shouldStop = async () => {
    const stopped = Boolean(await params.shouldStop?.());
    if (stopped) {
      stoppedByUser = true;
      await emit({ type: "stage", stage: "stopped", message: "Остановка запрошена пользователем." });
    }
    return stopped;
  };

  const skipLink = async (item: HhSkippedItem) => {
    skippedItems.push(item);
    await emit({ type: "skipped", message: item.errorMessage });
  };

  try {
    await emit({ type: "stage", stage: "preparing_browser", message: "Открываем браузер..." });
    context = await chromium.launchPersistentContext(path.join(process.cwd(), "browser-profile"), {
      headless: false,
      viewport: { width: 1280, height: 900 }
    });
    const page = context.pages()[0] || (await context.newPage());

    await emit({ type: "stage", stage: "opening_hh", message: "Открываем hh. Если нужен вход, выполните его вручную в браузере." });

    for (const [index, query] of params.queries.entries()) {
      if (foundLinks.length >= params.totalLimit || stoppedByCaptcha || (await shouldStop())) break;

      await emit({
        type: "query",
        query,
        queryIndex: index + 1,
        totalQueries: params.queries.length,
        message: `Запрос ${index + 1} из ${params.queries.length}: ${query}`
      });

      const searchUrl = buildSearchUrl(query, params);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await delay(1800);

      if (await isLoginHint(page)) {
        await emit({ type: "stage", stage: "manual_login", message: "hh может требовать ручной вход. Даю время войти в открытом браузере." });
        await delay(10000);
      }

      if (await isCaptchaPage(page)) {
        stoppedByCaptcha = true;
        const message = "hh показал капчу или защитную страницу. Сбор остановлен, продолжите позже вручную.";
        errors.push(message);
        await emit({ type: "error", message });
        break;
      }

      await emit({ type: "stage", stage: "collecting_links", message: "Собираем ссылки на вакансии..." });
      const links = await page.$$eval("a[href*='/vacancy/']", (anchors) =>
        Array.from(new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).href.split("?")[0]).filter(Boolean)))
      );

      let addedForQuery = 0;
      for (const link of links) {
        if (foundLinks.length >= params.totalLimit) break;

        if (!isHhVacancyUrl(link)) {
          await skipLink({
            sourceUrl: link,
            status: "skipped_not_vacancy",
            errorCode: "NOT_HH_VACANCY_URL",
            errorMessage: `Пропущена служебная ссылка hh: ${link}`
          });
          continue;
        }

        const canonical = normalizeHhVacancyUrl(link)!;
        if (!foundLinks.includes(canonical)) {
          foundLinks.push(canonical);
          addedForQuery += 1;
        }
        if (addedForQuery >= params.limitPerQuery) break;
      }

      await emit({ type: "links", foundLinks: foundLinks.length, message: `Найдено ссылок: ${foundLinks.length}` });
      await delay(1200);
    }

    const linksToOpen = foundLinks.slice(0, params.totalLimit);
    for (const [index, link] of linksToOpen.entries()) {
      if (vacancies.length >= params.totalLimit || stoppedByCaptcha || (await shouldStop())) break;

      if (!isHhVacancyUrl(link)) {
        await skipLink({
          sourceUrl: link,
          status: "skipped_not_vacancy",
          errorCode: "NOT_HH_VACANCY_URL",
          errorMessage: `Пропущена служебная ссылка hh: ${link}`
        });
        continue;
      }

      await emit({
        type: "card",
        sourceUrl: link,
        cardIndex: index + 1,
        totalCards: linksToOpen.length,
        message: `Открываем карточку ${index + 1} из ${linksToOpen.length}`
      });

      try {
        const vacancy = await openVacancyWithRetry(page, link);
        if (await isCaptchaPage(page)) {
          stoppedByCaptcha = true;
          const message = "hh показал капчу при открытии вакансии. Сбор остановлен.";
          errors.push(message);
          await emit({ type: "error", message });
          break;
        }

        const validation = validateVacancyDraft({ ...vacancy, source: "hh" });
        if (!validation.ok) {
          const logMsg = validationReasonToLog(validation.code, validation.reason);
          await skipLink({
            sourceUrl: link,
            status: "skipped_invalid_description",
            errorCode: validation.code || "UNKNOWN_BAD_PAGE",
            errorMessage: `${logMsg}${validation.reason ? `: ${validation.reason}` : ""}`
          });
          continue;
        }

        vacancies.push(vacancy);
        await emit({
          type: "card",
          sourceUrl: link,
          cardIndex: index + 1,
          totalCards: linksToOpen.length,
          title: vacancy.title,
          message: `Карточка собрана: ${vacancy.title}`
        });
        await delay(1500);
      } catch (error) {
        const message = `${link}: ${error instanceof Error ? error.message : "не удалось открыть вакансию"}`;
        errors.push(message);
        await emit({ type: "error", message });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Браузерный поиск остановлен с ошибкой.";
    errors.push(message);
    await emit({ type: "error", message });
  } finally {
    await context?.close().catch(() => undefined);
  }

  return { foundLinks, vacancies, skippedItems, errors, stoppedByCaptcha, stoppedByUser };
}

function buildSearchUrl(query: string, params: HhSearchParams) {
  const url = new URL("https://hh.ru/search/vacancy");
  const searchText = [query, params.region && !/^\d+$/.test(params.region) ? params.region : ""].filter(Boolean).join(" ");
  url.searchParams.set("text", searchText);
  url.searchParams.set("items_on_page", String(Math.min(Math.max(params.limitPerQuery, 1), 50)));
  if (params.region && /^\d+$/.test(params.region)) url.searchParams.set("area", params.region);
  if (params.onlyWithSalary) url.searchParams.set("only_with_salary", "true");
  if (params.searchPeriodDays) url.searchParams.set("search_period", String(params.searchPeriodDays));
  if (params.workFormat) url.searchParams.set("schedule", params.workFormat);
  return url.toString();
}

async function openVacancyWithRetry(page: Page, link: string) {
  try {
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
    await delay(1200);
    return await extractVacancy(page, link);
  } catch {
    await delay(1500);
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
    await delay(1200);
    return extractVacancy(page, link);
  }
}

async function isCaptchaPage(page: Page) {
  const text = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).toLowerCase();
  return text.includes("captcha") || text.includes("капча") || text.includes("подтвердите") || text.includes("проверка безопасности");
}

async function isLoginHint(page: Page) {
  const text = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).toLowerCase();
  return text.includes("войдите") || text.includes("войти") || text.includes("логин");
}

async function extractVacancy(page: Page, sourceUrl: string): Promise<HhVacancyDraft> {
  const normalizedUrl = normalizeHhVacancyUrl(sourceUrl) || sourceUrl;
  const bodyText = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
  const title = (await firstText(page, ["h1", "[data-qa='vacancy-title']"])) || "Вакансия hh";
  const companyName = await firstText(page, ["[data-qa='vacancy-company-name']", "a[href*='/employer/']"]);
  const salaryText = await firstText(page, ["[data-qa='vacancy-salary']", ".vacancy-title .bloko-header-section-2"]);
  const locationRaw = await firstText(page, ["[data-qa='vacancy-view-location']", "[data-qa='vacancy-view-raw-address']", "[data-qa='vacancy-view-location'] span"]);
  const employerUrl = await page.locator("a[href*='/employer/']").first().getAttribute("href").catch(() => null);
  const description =
    (await page.locator("[data-qa='vacancy-description']").innerText({ timeout: 5000 }).catch(() => "")) ||
    bodyText.slice(0, 8000);
  const workFormat = inferWorkFormat(bodyText);
  const publishedAtText = await firstText(page, ["[data-qa='vacancy-creation-time']", ".vacancy-creation-time"]);
  const isArchived = /вакансия в архиве|архивная вакансия/i.test(bodyText);
  const testRequired = /тестов|тестовое|тестирование|пройти тест/i.test(bodyText);
  const rawDescription = clean(description);
  const extractionWarning =
    !rawDescription || rawDescription.length < 300 ? "Не удалось извлечь полный текст вакансии. Проверьте карточку вручную." : null;

  return {
    title: clean(title) || "Вакансия hh",
    companyName: clean(companyName),
    sourceUrl: normalizedUrl,
    sourceVacancyId: extractHhVacancyId(normalizedUrl),
    salaryText: clean(salaryText),
    location: shortenLocation(clean(locationRaw)),
    workFormat,
    rawDescription,
    publishedAtText: clean(publishedAtText),
    employerUrl: employerUrl ? new URL(employerUrl, "https://hh.ru").toString() : null,
    isArchived,
    testRequired,
    extractionWarning
  };
}

async function firstText(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const text = await page.locator(selector).first().innerText({ timeout: 1500 }).catch(() => "");
    if (text.trim()) return text.trim();
  }
  return "";
}

function clean(value?: string | null) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function shortenLocation(value: string | null) {
  if (!value) return null;
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

function inferWorkFormat(text: string) {
  if (/удален|удалён|remote/i.test(text)) return "удалённо";
  if (/гибрид/i.test(text)) return "гибрид";
  if (/офис/i.test(text)) return "офис";
  return null;
}
