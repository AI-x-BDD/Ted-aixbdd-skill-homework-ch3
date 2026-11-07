import { promisify } from "node:util";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const scrypt = promisify(scryptCallback);
const N = 131072;
const r = 8;
const p = 1;
const keylen = 64;
const maxmem = 256 * 1024 * 1024;
const options = { N, r, p, maxmem };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, keylen, options);
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
    maxmem,
  });
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

let dummyHashPromise;

export async function verifyDummy(password) {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("not-a-real-password");
  }
  await verifyPassword(password, await dummyHashPromise);
}
