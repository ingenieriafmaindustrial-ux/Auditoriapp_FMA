import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL, listaConId } from '../services/base';
import { esGestor } from '../domain/permisos';
import { useUsuario } from '../context/AuthContext';
import type { BitacoraEntry, ChecklistItem, Evidencia, InformeVersion } from '../types';

function useSub<T>(build: () => Query | null, key: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = build();
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      q,
      (s) => {
        setData(listaConId<T>(s));
        setLoading(false);
      },
      (e) => {
        console.error(key, e);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

export function useChecklist(auditoriaId: string) {
  const r = useSub<ChecklistItem>(() => collection(db, COL.auditorias, auditoriaId, 'checklist'), `checklist:${auditoriaId}`);
  return { ...r, data: [...r.data].sort((a, b) => a.orden - b.orden) };
}

export function useInformes(auditoriaId: string) {
  const r = useSub<InformeVersion>(() => collection(db, COL.auditorias, auditoriaId, 'informes'), `informes:${auditoriaId}`);
  return { ...r, data: [...r.data].sort((a, b) => b.version - a.version) };
}

/** Consulta con filtro de participantes cuando el rol es auditor (requerido por reglas). */
function scoped(col: string, auditoriaId: string, gestor: boolean, auditorId: string | null) {
  const base = [where('auditoriaId', '==', auditoriaId)];
  if (!gestor) {
    if (!auditorId) return null;
    base.push(where('participantes', 'array-contains', auditorId));
  }
  return query(collection(db, col), ...base);
}

export function useEvidencias(auditoriaId: string) {
  const u = useUsuario();
  const g = esGestor(u.rol);
  const r = useSub<Evidencia>(() => scoped(COL.evidencias, auditoriaId, g, u.auditorId), `evid:${auditoriaId}:${g}`);
  return { ...r, data: [...r.data].sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1)) };
}

export function useBitacora(auditoriaId: string) {
  const u = useUsuario();
  const g = esGestor(u.rol);
  const r = useSub<BitacoraEntry>(() => scoped(COL.bitacora, auditoriaId, g, u.auditorId), `bit:${auditoriaId}:${g}`);
  return { ...r, data: [...r.data].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) };
}
