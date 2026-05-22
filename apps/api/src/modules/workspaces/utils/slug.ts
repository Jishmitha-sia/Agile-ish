import { randomUUID } from 'node:crypto';

/**
 * Derive a URL-safe slug from a workspace name.
 * Returns a fallback `ws-xxxxxx` if the input has no alphanumeric content
 * (e.g. all emojis), guaranteeing a valid 3-32 char slug.
 */
export const deriveSlug = (name: string): string => {
  const candidate = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return candidate.length >= 3 ? candidate : `ws-${randomUUID().slice(0, 6)}`;
};

/**
 * Find an unused slug by trying `base`, then `base-xxxx` on collision.
 * `tx` can be either the PrismaService or a transaction client.
 */
export const findAvailableSlug = async (
  tx: { workspace: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> } },
  base: string,
): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 4)}`;
    // eslint-disable-next-line no-await-in-loop -- intentional sequential probing
    const taken = await tx.workspace.findUnique({ where: { slug } });
    if (!taken) return slug;
  }
  return `ws-${randomUUID().slice(0, 8)}`;
};
