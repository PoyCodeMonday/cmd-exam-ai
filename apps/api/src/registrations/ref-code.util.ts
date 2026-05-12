import { randomInt } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateReferenceCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  return `REG-${suffix}`;
}

export const REFERENCE_CODE_REGEX = /^REG-[0-9A-HJ-NP-TV-Z]{6}$/;
