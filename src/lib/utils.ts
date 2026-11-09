export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function uid(): string {
  return crypto.randomUUID();
}

export function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function errorMensaje(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const mapa: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
    'permission-denied': 'No tienes permiso para realizar esta acción.',
    unavailable: 'Sin conexión. El cambio se sincronizará cuando vuelva la señal.',
  };
  if (mapa[code]) return mapa[code];
  if (e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado.';
}

/** Elimina claves undefined (Firestore no las acepta). */
export function limpiar<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
