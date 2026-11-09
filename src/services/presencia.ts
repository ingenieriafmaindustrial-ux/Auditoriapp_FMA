// Presencia en la "sala" de una auditoría: quién del equipo está conectado y qué está editando.
// Un documento por usuario y auditoría (`presencia/{auditoriaId}__{uid}`), con latido cada 40 s.
import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL, listaConId, registrarBitacora } from './base';
import type { Auditoria, EditandoEn, Presencia, Usuario } from '../types';

const LATIDO_MS = 40_000;
/** Sin latido por más de este tiempo = fuera de la sala (cerró la pestaña, perdió conexión). */
export const EN_LINEA_MS = 100_000;
/** Si vuelve antes de esto, no se registra un nuevo "ingresó" en la bitácora. */
const REINGRESO_MS = 30 * 60_000;

export const idPresencia = (auditoriaId: string, uid: string) => `${auditoriaId}__${uid}`;
export const enLinea = (p: Presencia, ahora = Date.now()) => p.enSala && ahora - Date.parse(p.ultimaSenal) < EN_LINEA_MS;

export function describirEdicion(e: EditandoEn): string | null {
  if (!e) return null;
  if (e.tipo === 'hallazgo') return `editando el hallazgo #${e.n}`;
  if (e.tipo === 'nuevo') return 'registrando un hallazgo nuevo';
  return 'escribiendo las notas';
}

/**
 * Marca al usuario dentro de la sala mientras la página esté abierta y devuelve la presencia de todos.
 * Registra en la bitácora el ingreso (si venía de fuera) y la salida.
 */
export function usePresencia(a: Auditoria | undefined, u: Usuario, editando: EditandoEn) {
  const [lista, setLista] = useState<Presencia[]>([]);
  const [, setTick] = useState(0);
  const editRef = useRef<EditandoEn>(editando);
  editRef.current = editando;
  const participa = !!a && (u.rol !== 'auditor' || (!!u.auditorId && a.participantes.includes(u.auditorId)));
  // Solo mientras la auditoría está abierta (planificada, en curso o en revisión)
  const activa = !!a && participa && ['planificada', 'en_ejecucion', 'en_revision'].includes(a.estado);
  const aid = a?.id;

  // Suscripción a la sala
  useEffect(() => {
    if (!aid) return;
    return onSnapshot(
      query(collection(db, COL.presencia), where('auditoriaId', '==', aid)),
      (s) => setLista(listaConId<Presencia>(s)),
      (e) => console.error('[presencia]', e),
    );
  }, [aid]);

  // Re-evaluar "en línea" aunque no lleguen cambios
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 20_000);
    return () => window.clearInterval(t);
  }, []);

  // Entrar, latir y salir
  useEffect(() => {
    if (!activa || !a) return;
    const ref = doc(db, COL.presencia, idPresencia(a.id, u.id));
    let vivo = true;
    const base = () => ({ auditoriaId: a.id, usuarioId: u.id, auditorId: u.auditorId, nombre: u.nombre });
    const latir = () => {
      if (!vivo || document.visibilityState === 'hidden') return;
      void updateDoc(ref, { enSala: true, editando: editRef.current, ultimaSenal: ahoraISO() }).catch(() => undefined);
    };
    (async () => {
      const previo = await getDoc(ref).catch(() => null);
      const p = previo?.exists() ? (previo.data() as Presencia) : null;
      const venia = !!p && p.enSala && Date.now() - Date.parse(p.ultimaSenal) < REINGRESO_MS;
      const ahora = ahoraISO();
      const b = writeBatch(db);
      b.set(ref, { ...base(), enSala: true, editando: editRef.current, ultimaSenal: ahora, desde: venia ? p!.desde : ahora });
      if (!venia) registrarBitacora(b, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: 'Ingresó a la sala de auditoría' });
      await b.commit().catch((e) => console.error('[presencia]', e));
    })();
    const t = window.setInterval(latir, LATIDO_MS);
    const alVolver = () => document.visibilityState === 'visible' && latir();
    const alCerrar = () => void updateDoc(ref, { enSala: false, editando: null, ultimaSenal: ahoraISO() }).catch(() => undefined);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('pagehide', alCerrar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('pagehide', alCerrar);
      const b = writeBatch(db);
      b.set(ref, { ...base(), enSala: false, editando: null, ultimaSenal: ahoraISO() }, { merge: true });
      registrarBitacora(b, u, { entidad: 'auditoria', entidadId: a.id, auditoriaId: a.id, participantes: a.participantes, accion: 'editar', detalle: 'Salió de la sala de auditoría' });
      void b.commit().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, a?.id, u.id]);

  // Avisar de inmediato qué está editando (sin esperar el latido)
  const clave = JSON.stringify(editando);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; } // el ingreso ya lo escribe el efecto de entrada
    if (!activa || !a) return;
    void setDoc(doc(db, COL.presencia, idPresencia(a.id, u.id)), { auditoriaId: a.id, usuarioId: u.id, auditorId: u.auditorId, nombre: u.nombre, editando: editRef.current, ultimaSenal: ahoraISO(), enSala: true }, { merge: true }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const ahora = Date.now();
  const conectados = lista.filter((p) => enLinea(p, ahora));
  /** Otro usuario conectado que está editando lo indicado (bloqueo suave). */
  const editadoPorOtro = (pred: (e: NonNullable<EditandoEn>) => boolean) =>
    conectados.find((p) => p.usuarioId !== u.id && p.editando && pred(p.editando)) ?? null;
  return { lista, conectados, editadoPorOtro };
}
