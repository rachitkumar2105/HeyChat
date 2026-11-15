import argon2 from 'argon2';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Used when the username does not exist, so response time does not reveal which usernames are real.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password-just-timing-padding');
  await verifyPassword(await dummyHash, password);
}
