// Registro automático de errores (opción B) y datos de contexto para "Reportar problema" (opción C).
// Guarda en Firestore (colección "errores") sin servicios externos. Un mismo error se agrupa por mes:
// se suma "veces" en vez de crear 50 registros. Nunca guarda contraseñas ni el contenido de los hallazgos.
// Sin conexión, Firestore deja la escritura en cola y la envía al reconectar.
import { arrayUnion, doc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { fijarReportadorErrores } from './utils';

export const VERSION_APP = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';

/** Errores esperables por acción del usuario: no se registran. */
const IGNORAR = new Set([
  'auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/too-many-requests',
  'auth/weak-password', 'auth/email-already-in-use', 'auth/invalid-email', 'auth/missing-password',
  'auth/network-request-failed', 'unavailable', 'aborted',
]);
const MENSAJES_IGNORADOS = [/ResizeObserver loop/i, /Failed to fetch dynamically imported module/i, /Load failed/i];
const MAX_POR_SESION = 25;

interface UsuarioError { id: string; nombre: string }
let usuario: UsuarioError | null = null;
let ultimaAccion = '';
let enviados = 0;
const vistos = new Set<string>();
export interface ErrorReciente { id: string; mensaje: string; fecha: string }
const recientes: ErrorReciente[] = [];

export function fijarUsuarioErrores(u: UsuarioError | null) {
  usuario = u;
}

/** Último botón o enlace presionado: indica qué intentaba hacer el usuario. */
export function ultimaAccionUsuario() {
  return ultimaAccion;
}
export function erroresRecientes(): ErrorReciente[] {
  return [...recientes];
}

/** Navegador y sistema en palabras simples (sin identificadores del equipo). */
export function dispositivo(): string {
  const ua = navigator.userAgent;
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const app = window.matchMedia?.('(display-mode: standalone)').matches ? ' · app instalada' : '';
  return `${nav} · ${so} · ${window.innerWidth}px${app}${navigator.onLine ? '' : ' · sin conexión'}`;
}

/** Ruta sin identificadores (para agrupar el mismo error en distintas auditorías). */
export function rutaGenerica(path = location.pathname): string {
  return path.split('/').map((s) => (s.length >= 15 && /^[A-Za-z0-9_-]+$/.test(s) ? ':id' : s)).join('/') || '/';
}

function hash(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

export type OrigenError = 'operacion' | 'pantalla' | 'promesa' | 'render';

/** Registra un error. Nunca lanza excepciones (un fallo al registrar no debe romper la app). */
export function registrarError(origen: OrigenError, e: unknown, extra = '') {
  try {
    const codigo = String((e as { code?: string })?.code ?? '');
    if (IGNORAR.has(codigo)) return;
    const mensaje = corta(e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e) ?? 'Error desconocido', 900);
    if (MENSAJES_IGNORADOS.some((r) => r.test(mensaje))) return;
    const stack = corta((e instanceof Error && e.stack) || '', 2500);
    const ruta = rutaGenerica();
    const firma = hash(`${origen}|${codigo}|${mensaje.slice(0, 200)}|${ruta}`);
    const mes = new Date().toISOString().slice(0, 7);
    const id = `${mes}_${firma}`;
    const fecha = new Date().toISOString();
    const previo = recientes.findIndex((r) => r.id === id);
    if (previo >= 0) recientes.splice(previo, 1);
    recientes.unshift({ id, mensaje, fecha });
    recientes.splice(5);
    console.error(`[FMA error ${origen}]`, e);
    if (!usuario || enviados >= MAX_POR_SESION) return;
    // En una misma sesión, cada error distinto se envía una vez por minuto como máximo
    const clave = `${id}|${Math.floor(Date.now() / 60000)}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    enviados++;
    void setDoc(
      doc(db, 'errores', id),
      {
        mes,
        origen,
        codigo,
        mensaje,
        ruta,
        detalle: corta(extra, 300),
        accion: corta(ultimaAccion, 120),
        stack,
        version: VERSION_APP,
        dispositivo: dispositivo(),
        usuarios: arrayUnion(usuario.nombre),
        ultimoUsuario: usuario.nombre,
        ultimaVez: fecha,
        veces: increment(1),
        revisado: false,
      },
      { merge: true },
    ).catch((err) => console.warn('[FMA] No se pudo registrar el error', err));
  } catch {
    /* nunca romper por registrar */
  }
}

// ---------- Captura global ----------
let instalado = false;
export function instalarCapturaErrores() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  fijarReportadorErrores((e) => registrarError('operacion', e));
  window.addEventListener('error', (ev) => registrarError('pantalla', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => registrarError('promesa', ev.reason));
  document.addEventListener(
    'click',
    (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest('button, a, [role="button"], [role="tab"]');
      if (!el) return;
      const txt = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) ultimaAccion = `"${corta(txt, 60)}" en ${rutaGenerica()}`;
    },
    true,
  );
}

/** Abre el formulario "Reportar problema" desde cualquier parte (toasts, pantalla de error, menú). */
export function abrirReporte(mensaje = '') {
  window.dispatchEvent(new CustomEvent('fma:reportar', { detail: mensaje }));
}
