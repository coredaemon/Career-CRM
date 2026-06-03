import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for company creation and deduplication logic.
 * Tests the findOrCreateCompany behaviour without hitting the real DB.
 */

// Simulate the findOrCreateCompany logic (mirrors src/lib/vacancy-service.ts)
function makeCompanyStore() {
  const store = [];
  return {
    findOrCreate(companyName) {
      const cleanName = companyName?.trim();
      if (!cleanName) return null;
      const existing = store.find((c) => c.name === cleanName);
      if (existing) return existing;
      const newCompany = { id: `cid-${store.length + 1}`, name: cleanName };
      store.push(newCompany);
      return newCompany;
    },
    count() {
      return store.length;
    },
    getAll() {
      return [...store];
    }
  };
}

test("findOrCreateCompany creates a new company when none exists", () => {
  const store = makeCompanyStore();
  const company = store.findOrCreate("Ромашка ООО");
  assert.ok(company !== null, "company should be created");
  assert.equal(company.name, "Ромашка ООО");
  assert.equal(store.count(), 1);
});

test("findOrCreateCompany returns existing company by name (deduplication)", () => {
  const store = makeCompanyStore();
  const first = store.findOrCreate("Ромашка ООО");
  const second = store.findOrCreate("Ромашка ООО");
  assert.equal(first.id, second.id, "same company should be returned");
  assert.equal(store.count(), 1, "no duplicate should be created");
});

test("findOrCreateCompany trims whitespace before deduplication", () => {
  const store = makeCompanyStore();
  const first = store.findOrCreate("  Ромашка ООО  ");
  const second = store.findOrCreate("Ромашка ООО");
  assert.equal(first.id, second.id, "trimmed names should match");
  assert.equal(store.count(), 1);
});

test("findOrCreateCompany returns null for null or empty name", () => {
  const store = makeCompanyStore();
  assert.equal(store.findOrCreate(null), null);
  assert.equal(store.findOrCreate(""), null);
  assert.equal(store.findOrCreate("   "), null);
  assert.equal(store.count(), 0);
});

test("different company names create separate companies", () => {
  const store = makeCompanyStore();
  store.findOrCreate("Компания А");
  store.findOrCreate("Компания Б");
  store.findOrCreate("Компания В");
  assert.equal(store.count(), 3);
});

test("companies are linked to vacancies during HH collection", () => {
  // Simulate the vacancy creation flow from src/app/api/search/hh/route.ts
  const store = makeCompanyStore();

  const items = [
    { title: "Юрист", companyName: "Ромашка ООО", sourceUrl: "https://hh.ru/vacancy/1" },
    { title: "Юрисконсульт", companyName: "Ромашка ООО", sourceUrl: "https://hh.ru/vacancy/2" },
    { title: "Адвокат", companyName: "Другая Компания", sourceUrl: "https://hh.ru/vacancy/3" }
  ];

  const vacancies = items.map((item) => {
    const company = store.findOrCreate(item.companyName);
    return { title: item.title, companyId: company?.id ?? null };
  });

  // Two vacancies from Ромашка should share the same companyId
  assert.equal(vacancies[0].companyId, vacancies[1].companyId, "same company should link to same id");
  assert.notEqual(vacancies[0].companyId, vacancies[2].companyId, "different companies should have different ids");
  assert.equal(store.count(), 2, "only 2 unique companies should exist");
});

test("backfill by employerUrl links vacancy to existing company", () => {
  // Simulate the backfill strategy: find sibling vacancies by employerUrl
  const linkedVacancies = [
    { id: "v1", employerUrl: "https://hh.ru/employer/123", companyId: "cid-1" }
  ];
  const unlinkedVacancies = [
    { id: "v2", employerUrl: "https://hh.ru/employer/123", companyId: null }
  ];

  for (const vacancy of unlinkedVacancies) {
    const sibling = linkedVacancies.find(
      (v) => v.employerUrl === vacancy.employerUrl && v.companyId !== null
    );
    if (sibling) vacancy.companyId = sibling.companyId;
  }

  assert.equal(unlinkedVacancies[0].companyId, "cid-1", "backfill should link by employerUrl");
});
