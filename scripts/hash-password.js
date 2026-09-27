'use strict';

const crypto = require('node:crypto');

const password = process.argv.slice(2).join(' ').trim();

if (!password || password.length < 12) {
  console.error('Usage: node scripts/hash-password.js "a-strong-password-at-least-12-chars"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const N = 16384;
const r = 8;
const p = 1;
const keyLen = 64;
const derived = crypto.scryptSync(password, salt, keyLen, { N, r, p });

console.log(`scrypt$${N}$${r}$${p}$${salt}$${derived.toString('hex')}`);
