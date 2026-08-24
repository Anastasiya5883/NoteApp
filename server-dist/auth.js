import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64));
    return { hash: derivedKey.toString('hex'), salt };
}
export async function verifyPassword(password, salt, expectedHash) {
    const derivedKey = (await scrypt(password, salt, 64));
    const expected = Buffer.from(expectedHash, 'hex');
    return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}
export function createSessionToken() {
    return randomBytes(32).toString('hex');
}
export function hashSessionToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
