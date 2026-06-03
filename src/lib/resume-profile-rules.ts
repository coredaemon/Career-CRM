export type LifecycleItem = {
  id: string;
  isActive?: boolean | null;
  isArchived?: boolean | null;
  status?: string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export function isVisibleInSearch<T extends LifecycleItem>(item: T): boolean {
  return !item.isArchived && item.status !== "archived";
}

export function sortActiveFirst<T extends LifecycleItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (Boolean(left.isActive) !== Boolean(right.isActive)) return left.isActive ? -1 : 1;
    if (Boolean(left.isArchived) !== Boolean(right.isArchived)) return left.isArchived ? 1 : -1;
    return timestamp(right.updatedAt || right.createdAt) - timestamp(left.updatedAt || left.createdAt);
  });
}

export function resumeTextChangePatch(previousText: string, nextText: string) {
  const changed = previousText.trim() !== nextText.trim();
  return {
    changed,
    aiSummaryStale: changed
  };
}

export function shouldArchiveResumeOnDelete(counts: { searchProfiles: number; applications: number; coverLetters: number }) {
  return counts.searchProfiles > 0 || counts.applications > 0 || counts.coverLetters > 0;
}

export function pickFallbackActiveProfile<T extends LifecycleItem>(profiles: T[], deletedProfileId: string): T | null {
  return sortActiveFirst(profiles.filter((profile) => profile.id !== deletedProfileId && isVisibleInSearch(profile)))[0] || null;
}

function timestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

