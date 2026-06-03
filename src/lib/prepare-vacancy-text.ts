const COOKIE_NAV_PATTERNS = [
  /файлы cookie/gi,
  /мы используем cookie/gi,
  /принять все/gi,
  /настроить cookie/gi,
  /ищу работу/gi,
  /создать резюме/gi,
  /(?:^|\n)\s*войти\s*(?:$|\n)/gi,
  /(?:^|\n)\s*регистрация\s*(?:$|\n)/gi
];

const MAX_DESCRIPTION_LENGTH = 7000;
const MIN_USEFUL_LENGTH = 200;

export type PrepareVacancyTextResult = {
  text: string;
  ok: boolean;
  reason?: string;
};

export function prepareVacancyTextForAi(vacancy: { rawDescription?: string | null; title?: string | null }): PrepareVacancyTextResult {
  let text = vacancy.rawDescription?.trim() || "";
  if (!text && vacancy.title) {
    text = vacancy.title.trim();
  }

  for (const pattern of COOKIE_NAV_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  text = text.replace(/\s+/g, " ").trim();

  if (text.length > MAX_DESCRIPTION_LENGTH) {
    text = text.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  if (text.length < MIN_USEFUL_LENGTH) {
    return {
      text,
      ok: false,
      reason: "Текст вакансии слишком короткий или пустой для AI-анализа."
    };
  }

  return { text, ok: true };
}
