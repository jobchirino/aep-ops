// src/lib/auth.js
import { cache } from 'react';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE = 'aep_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días
const JWT_ALGORITHM = 'HS256';

// Solo se usa en desarrollo cuando falta AUTH_SECRET. En producción es obligatorio.
const DEV_FALLBACK_SECRET = 'aep-ops-dev-only-secret-change-me-2027-01-01';

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[auth] AUTH_SECRET no está configurado. Usando secreto de desarrollo.');
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  throw new Error('AUTH_SECRET no está configurado. Define una clave de al menos 32 caracteres.');
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    shortCode: user.shortCode,
    role: user.role,
  };
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

async function signSessionToken(user) {
  return new SignJWT({
    name: user.name,
    shortCode: user.shortCode,
    role: user.role,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
}

async function startSession(user) {
  const token = await signSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, getCookieOptions());
}

/**
 * Lee la cookie de sesión y devuelve el usuario de la base de datos.
 * Devuelve null si no hay sesión, el token es inválido o el usuario ya no existe.
 * Memoizada con cache() para deduplicar la lectura dentro de un mismo render.
 */
export const getCurrentUser = cache(async () => {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: [JWT_ALGORITHM],
    });

    if (!payload?.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: {
        id: true,
        name: true,
        email: true,
        shortCode: true,
        role: true,
      },
    });

    return user ?? null;
  } catch {
    return null;
  }
});

/**
 * Valida credenciales y crea la cookie de sesión HTTP-only.
 * Solo debe llamarse desde un Server Action o Route Handler (escribe cookies).
 */
export async function loginUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const plainPassword = String(password || '');

  if (!normalizedEmail || !plainPassword) {
    return { ok: false, error: 'Ingresa tu correo y contraseña.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    }

    const passwordMatches = await bcrypt.compare(plainPassword, user.passwordHash);
    if (!passwordMatches) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    }

    await startSession(user);

    return { ok: true, user: toSafeUser(user) };
  } catch (error) {
    console.error('[auth] Error al iniciar sesión:', error);
    return { ok: false, error: 'No se pudo iniciar sesión. Intenta de nuevo.' };
  }
}

/**
 * Acceso rápido para desarrollo: firma la sesión sin pedir contraseña.
 * Bloqueado por completo en producción.
 */
export async function devLogin(email) {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'El acceso rápido solo está disponible en desarrollo.' };
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: 'Selecciona una cuenta.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { ok: false, error: 'Usuario no encontrado. Ejecuta el seed de la base de datos.' };
    }

    await startSession(user);

    return { ok: true, user: toSafeUser(user) };
  } catch (error) {
    console.error('[auth] Error en acceso rápido:', error);
    return { ok: false, error: 'No se pudo iniciar sesión. Revisa la conexión a la base de datos.' };
  }
}

/**
 * Elimina la cookie de sesión.
 * Solo debe llamarse desde un Server Action o Route Handler (escribe cookies).
 */
export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, '', {
    ...getCookieOptions(),
    maxAge: 0,
  });
}
