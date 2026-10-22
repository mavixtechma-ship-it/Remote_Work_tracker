#!/usr/bin/env node
// Prints a js/auth-config.js user entry (salted PBKDF2-SHA256) for a password.
// Usage: node tools/hash-password.mjs <username> <role> [password]
// When no password is given, a random 14-character one is generated and printed once.
import { randomBytes, randomInt, pbkdf2Sync } from 'node:crypto';

const [username, role, given] = process.argv.slice(2);
if (!username || !['admin', 'viewer'].includes(role)) {
  console.error('Usage: node tools/hash-password.mjs <username> <admin|viewer> [password]');
  process.exit(1);
}
const ITERATIONS = 310000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_+=';
const password = given ?? Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');

if (!given) console.log(`password (store only in CREDENTIALS.md): ${password}`);
console.log(JSON.stringify({ username, role, iterations: ITERATIONS, salt: salt.toString('base64'), hash: hash.toString('base64') }, null, 2));
