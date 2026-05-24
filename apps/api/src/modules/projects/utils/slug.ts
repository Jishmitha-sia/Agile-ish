import { randomUUID } from 'node:crypto';

/**
 * Derive a URL-safe slug from a project name. Same shape as the workspace
 * helper but scoped to a workspace (uniqueness is per-workspace).
 */
export const deriveProjectSlug = (name: string): string => {
  const candidate = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return candidate.length >= 2 ? candidate : `proj-${randomUUID().slice(0, 6)}`;
};

/**
 * Derive an issue-identifier prefix from a project name.
 *
 *   "Engineering"     → "ENG"
 *   "AI Engineering"  → "AIE"   (first letter of first three words)
 *   "Web"             → "WEB"   (first three letters)
 *   "Q2 Roadmap"      → "Q2R"
 *
 * Always 2–8 chars, uppercase, starts with a letter. Random fallback for
 * names with no usable alphanumerics.
 */
export const deriveIdentifierPrefix = (name: string): string => {
  const words = name
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // Multi-word: take the first letter of each (up to 4). Single-word: take
  // the first 3 characters.
  let candidate = '';
  if (words.length > 1) {
    candidate = words
      .slice(0, 4)
      .map((w) => w[0] ?? '')
      .join('');
  } else if (words.length === 1) {
    candidate = (words[0] ?? '').slice(0, 3);
  }

  if (/^[A-Z][A-Z0-9]{1,7}$/.test(candidate)) return candidate;
  // Fallback — guarantees the prefix shape requirements even if the name
  // is all symbols or starts with a digit.
  return `PRJ${randomUUID().replace(/-/g, '').slice(0, 3).toUpperCase()}`;
};

/**
 * Find an unused slug within a workspace by trying `base`, then `base-xxxx`.
 * Mirrors the workspace slug probe — sequential by design.
 */
export const findAvailableProjectSlug = async (
  tx: {
    project: {
      findFirst: (args: {
        where: { workspaceId: string; slug: string };
      }) => Promise<unknown>;
    };
  },
  workspaceId: string,
  base: string,
): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`;
    // eslint-disable-next-line no-await-in-loop -- intentional sequential probing
    const taken = await tx.project.findFirst({ where: { workspaceId, slug } });
    if (!taken) return slug;
  }
  return `proj-${randomUUID().slice(0, 8)}`;
};

/**
 * Find an unused identifier prefix within a workspace by trying `base`,
 * then `base + 2`, `base + 3`, … `base + 9`, then a random fallback.
 */
export const findAvailableIdentifierPrefix = async (
  tx: {
    project: {
      findFirst: (args: {
        where: { workspaceId: string; identifierPrefix: string };
      }) => Promise<unknown>;
    };
  },
  workspaceId: string,
  base: string,
): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    // eslint-disable-next-line no-await-in-loop -- intentional sequential probing
    const taken = await tx.project.findFirst({
      where: { workspaceId, identifierPrefix: candidate },
    });
    if (!taken) return candidate;
  }
  return `PRJ${randomUUID().replace(/-/g, '').slice(0, 3).toUpperCase()}`;
};
