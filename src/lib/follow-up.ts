import { formatVacancyTitleForFollowUp } from "@/lib/vacancy-application-queue";

export function buildFollowUpText(vacancy: {
  title: string;
  status: string;
  testStatus: string | null;
}) {
  const title = formatVacancyTitleForFollowUp(vacancy.title);

  if (vacancy.testStatus === "пройдено" || vacancy.testStatus === "отправлено") {
    return `Здравствуйте. Я прошёл тестирование по вакансии «${title}». Хотел уточнить, удалось ли его посмотреть и есть ли решение по дальнейшим этапам. Буду благодарен за обратную связь.`;
  }

  if (
    vacancy.status === "applied" ||
    vacancy.status === "waiting_response" ||
    vacancy.status === "no_response"
  ) {
    return `Здравствуйте. Недавно направлял отклик на вакансию «${title}». Хотел уточнить, актуальна ли ещё позиция и рассматривается ли моё резюме. Буду благодарен за обратную связь.`;
  }

  return `Здравствуйте. Хотел уточнить статус рассмотрения по вакансии «${title}». Буду благодарен за обратную связь.`;
}
