import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerOS",
  description: "Local AI Career CRM"
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/resumes", label: "Resumes" },
  { href: "/profiles", label: "Profiles" },
  { href: "/vacancies", label: "Vacancies" },
  { href: "/companies", label: "Companies" },
  { href: "/applications", label: "Applications" },
  { href: "/memory", label: "AI Memory" },
  { href: "/settings/ai", label: "AI Settings" }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-[var(--line)] bg-[var(--panel)] px-5 py-5 lg:min-h-screen lg:border-b-0 lg:border-r">
            <Link href="/" className="block">
              <div className="text-xl font-semibold tracking-normal">CareerOS</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Local AI Career CRM</div>
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
          </aside>
          <main className="px-5 py-6 sm:px-8 lg:px-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
