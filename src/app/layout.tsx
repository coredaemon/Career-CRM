import type { Metadata } from "next";
import Link from "next/link";
import { ProcessIndicator } from "@/components/process-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerOS",
  description: "Локальная AI-CRM для поиска работы"
};

const nav = [
  { href: "/", label: "Главная" },
  { href: "/onboarding", label: "Первый запуск" },
  { href: "/resumes", label: "Резюме" },
  { href: "/profiles", label: "Профили поиска" },
  { href: "/search", label: "Поиск вакансий" },
  { href: "/processes", label: "Процессы" },
  { href: "/vacancies", label: "Вакансии" },
  { href: "/vacancies/recommended", label: "Рекомендованные" },
  { href: "/companies", label: "Компании" },
  { href: "/applications", label: "Отклики" },
  { href: "/memory", label: "Память AI" },
  { href: "/settings/ai", label: "Настройки AI" }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-[var(--line)] bg-[var(--panel)] px-5 py-5 lg:min-h-screen lg:border-b-0 lg:border-r">
            <Link href="/" className="block">
              <div className="text-xl font-semibold tracking-normal">CareerOS</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Локальная AI-CRM для поиска работы</div>
            </Link>
            <nav className="mt-7 grid gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <ProcessIndicator />
          </aside>
          <main className="px-5 py-6 sm:px-8 lg:px-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
