'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loginUser, devLogin, logoutUser } from '@/lib/auth';

/**
 * Inicia sesión con correo y contraseña.
 * Firma: (prevState, formData) para usarse con useActionState.
 */
export async function signInAction(prevState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');

  const result = await loginUser(email, password);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Acceso rápido de desarrollo con un clic.
 */
export async function quickSignInAction(formData) {
  const email = formData.get('email');

  const result = await devLogin(email);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Cierra la sesión y vuelve a la pantalla de login.
 */
export async function signOutAction() {
  await logoutUser();
  revalidatePath('/', 'layout');
  redirect('/login');
}
