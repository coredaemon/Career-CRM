/**
 * Initial list of narrow legal specializations.
 * If a vacancy's PRIMARY focus is one of these areas and it is NOT confirmed
 * by the candidate's resume, the AI must:
 *   - set score ≤ 45
 *   - set should_apply = "no"
 *   - add the missing specialization to specialized_requirements_not_in_resume
 *
 * This list can be extended or overridden via accepted LearningObservations.
 */
export const NARROW_SPECIALIZATION_RULES: string[] = [
  "патентное право",
  "патентный поверенный",
  "интеллектуальная собственность как основной фокус",
  "товарные знаки",
  "антимонопольное право",
  "налоговое право как основной фокус",
  "банкротство как основной фокус",
  "M&A",
  "комплаенс",
  "персональные данные / privacy как основной фокус",
  "валютное регулирование",
  "банковское право",
  "ценные бумаги",
  "международное право",
  "санкционное право",
  "трудовое право как основной фокус",
  "госзакупки / 44-ФЗ / 223-ФЗ как основной фокус",
  "строительное право / девелопмент как основной фокус",
  "недвижимость / земля как основной фокус",
  "миграционное право",
  "медицинское право",
  "IT / IP / лицензирование ПО как основной фокус",
];
