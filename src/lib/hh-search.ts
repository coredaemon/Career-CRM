import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

export type HhSearchParams = {
  queries: string[];
  region?: string | null;
  limitPerQuery: number;
  totalLimit: number;
  onlyWithSalary?: boolean;
  searchPeriodDays?: number | null;
  workFormat?: string | null;
};

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
};

export type HhSearchResult = {
  foundLinks: string[];
  vacancies: HhVacancyDraft[];
  errors: string[];
  stoppedByCaptcha: boolean;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function collectHhVacancies(params: HhSearchParams): Promise<HhSearchResult> {
  let context: BrowserContext | null = null;
  const foundLinks: string[] = [];
  const vacancies: HhVacancyDraft[] = [];
  const errors: string[] = [];
  let stoppedByCaptcha = false;

  try {
    context = await chromium.launchPersistentContext(path.join(process.cwd(), "browser-profile"), {
      headless: false,
      viewport: { width: 1280, height: 900 }
    });
    const page = context.pages()[0] || (await context.newPage());

    for (const query of params.queries) {
      if (foundLinks.length >= params.totalLimit || stoppedByCaptcha) break;

      const searchUrl = buildSearchUrl(query, params);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await delay(1500);

      if (await isCaptchaPage(page)) {
        stoppedByCaptcha = true;
        errors.push("hh показал капчу или защитную страницу. Сбор остановлен, продолжите позже вручную.");
        break;
      }

      const links = await page.$$eval("a[href*='/vacancy/']", (anchors) =>
        Array.from(new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).href.split("?")[0]).filter(Boolean)))
      );

      let addedForQuery = 0;
      for (const link of links) {
        if (foundLinks.length >= params.totalLimit) break;
        if (!foundLinks.includes(link)) {
          foundLinks.push(link);
          addedForQuery += 1;
        }
        if (addedForQuery >= params.limitPerQuery) break;
      }

      await delay(1200);
    }

    for (const link of foundLinks.slice(0, params.totalLimit)) {
      if (vacancies.length >= params.totalLimit || stoppedByCaptcha) break;
      try {
        await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60000 });
        await delay(1200);

        if (await isCaptchaPage(page)) {
          stoppedByCaptcha = true;
          errors.push("hh показал капчу при открытии вакансии. Сбор остановлен.");
          break;
        }

        vacancies.push(await extractVacancy(page, link));
        await delay(1600);
      } catch (error) {
        errors.push(`${link}: ${error instanceof Error ? error.message : "не удалось открыть вакансию"}`);
      }
    }
  } finally {
    await context?.close().catch(() => undefined);
  }

  return { foundLinks, vacancies, errors, stoppedByCaptcha };
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

async function isCaptchaPage(page: Page) {
  const text = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).toLowerCase();
  return text.includes("captcha") || text.includes("капча") || text.includes("подтвердите") || text.includes("проверка безопасности");
}

async function extractVacancy(page: Page, sourceUrl: string): Promise<HhVacancyDraft> {
  const bodyText = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
  const title = (await firstText(page, ["h1", "[data-qa='vacancy-title']"])) || "Вакансия hh";
  const companyName = await firstText(page, ["[data-qa='vacancy-company-name']", "[data-qa='bloko-header-2']", "a[href*='/employer/']"]);
  const salaryText = await firstText(page, ["[data-qa='vacancy-salary']", ".vacancy-title .bloko-header-section-2"]);
  const location = await firstText(page, ["[data-qa='vacancy-view-location']", "[data-qa='vacancy-view-raw-address']", "[data-qa='vacancy-view-location'] span"]);
  const employerUrl = await page.locator("a[href*='/employer/']").first().getAttribute("href").catch(() => null);
  const description =
    (await page.locator("[data-qa='vacancy-description']").innerText({ timeout: 5000 }).catch(() => "")) ||
    bodyText.slice(0, 8000);
  const workFormat = inferWorkFormat(bodyText);
  const publishedAtText = await firstText(page, ["[data-qa='vacancy-creation-time']", ".vacancy-creation-time"]);
  const isArchived = /вакансия в архиве|архивная вакансия/i.test(bodyText);
  const testRequired = /тестов|тестовое|тестирование|пройти тест/i.test(bodyText);

  return {
    title: clean(title) || "Вакансия hh",
    companyName: clean(companyName),
    sourceUrl,
    sourceVacancyId: sourceUrl.match(/vacancy\/(\d+)/)?.[1] || null,
    salaryText: clean(salaryText),
    location: clean(location),
    workFormat,
    rawDescription: clean(description),
    publishedAtText: clean(publishedAtText),
    employerUrl: employerUrl ? new URL(employerUrl, "https://hh.ru").toString() : null,
    isArchived,
    testRequired
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

function inferWorkFormat(text: string) {
  if (/удален|удалён|remote/i.test(text)) return "удалённо";
  if (/гибрид/i.test(text)) return "гибрид";
  if (/офис/i.test(text)) return "офис";
  return null;
}
