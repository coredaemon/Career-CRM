import Link from "next/link";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 ${className}`}>{children}</section>;
}

export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled,
  onClick
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] dark:text-black"
      : "border border-[var(--line)] bg-transparent hover:bg-[var(--soft)]";

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${styles}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] dark:text-black"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex min-h-56 flex-col justify-center">
      <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
    </Card>
  );
}

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "focus-ring min-h-10 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none";
