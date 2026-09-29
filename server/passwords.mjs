import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Passwords are stored as "<salt>:<scrypt hash>" and can never be turned back into the
// original text. Shared by the API server and the reset-password command.
export const minPasswordLength = 6;

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored ?? '').split(':');
  if (!salt || !hash) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
