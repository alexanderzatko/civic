/**
 * Optimistic Profile identity after password register — the user already typed
 * their username, but Profile may mount before `GET /me` returns.
 */

type ProfileIdentitySeed = {
  username: string;
};

let seed: ProfileIdentitySeed | null = null;

export function seedProfileIdentity(username: string): void {
  const trimmed = username.trim();
  seed = trimmed ? { username: trimmed } : null;
}

/** Read and clear any pending seed (one-shot). */
export function takeProfileIdentitySeed(): ProfileIdentitySeed | null {
  const next = seed;
  seed = null;
  return next;
}
