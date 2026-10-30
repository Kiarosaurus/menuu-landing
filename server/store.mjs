import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [salt, expected] = stored.split(":");

  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

export function publicUser(user) {
  if (!user) return null;
  const {
    id,
    name,
    email,
    role,
    kitchenId,
    studentCode,
    career,
    birthDate,
    bookingAllowed,
  } = user;

  return {
    id,
    name,
    email,
    role,
    kitchenId,
    studentCode: studentCode || null,
    career: career || null,
    birthDate: birthDate || null,
    bookingAllowed: bookingAllowed !== false,
  };
}
