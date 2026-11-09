import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, where, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { byId } from '../lib/utils';
import { COL, listaConId } from '../services/base';
import { esGestor } from '../domain/permisos';
import { useUsuario } from './AuthContext';
import type { Area, Auditor, Auditoria, Hallazgo, ProgramaItem, Requisito, Sucursal, Usuario } from '../types';

/**
 * Suscripciones globales en tiempo real (volumen bajo: decenas/cientos de documentos).
 * Evita índices compuestos y permite filtrar en el cliente. Auditores: solo lo suyo.
 */
interface DataValue {
  cargando: boolean;
  sucursales: Sucursal[];
  areas: Area[];
  auditores: Auditor[];
  requisitos: Requisito[];
  usuarios: Usuario[];
  auditorias: Auditoria[];
  hallazgos: Hallazgo[];
  /** Programa anual de auditorías (visible para todos los usuarios activos). */
  programa: ProgramaItem[];
  mapa: {
    sucursales: Record<string, Sucursal>;
    areas: Record<string, Area>;
    auditores: Record<string, Auditor>;
    requisitos: Record<string, Requisito>;
    usuarios: Record<string, Usuario>;
    auditorias: Record<string, Auditoria>;
  };
}

const DataContext = createContext<DataValue | null>(null);

function useLive<T>(q: Query | null, deps: unknown[]): [T[], boolean] {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      q,
      (snap) => {
        setData(listaConId<T>(snap));
        setLoading(false);
      },
      (err) => {
        console.error('[DataContext]', err);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, loading];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const u = useUsuario();
  const gestor = esGestor(u.rol);
  const scope = gestor ? 'all' : u.auditorId ?? 'none';

  const [sucursales, l1] = useLive<Sucursal>(collection(db, COL.sucursales), []);
  const [areas, l2] = useLive<Area>(collection(db, COL.areas), []);
  const [auditores, l3] = useLive<Auditor>(collection(db, COL.auditores), []);
  const [requisitos, l4] = useLive<Requisito>(collection(db, COL.requisitos), []);
  const [usuarios] = useLive<Usuario>(collection(db, COL.usuarios), []);

  const qAud = gestor
    ? collection(db, COL.auditorias)
    : u.auditorId
      ? query(collection(db, COL.auditorias), where('participantes', 'array-contains', u.auditorId))
      : null;
  const qHal = gestor
    ? collection(db, COL.hallazgos)
    : u.auditorId
      ? query(collection(db, COL.hallazgos), where('participantes', 'array-contains', u.auditorId))
      : null;
  const [auditorias, l5] = useLive<Auditoria>(qAud, [scope]);
  const [hallazgos, l6] = useLive<Hallazgo>(qHal, [scope]);
  const [programa] = useLive<ProgramaItem>(collection(db, COL.programa), []);

  const value = useMemo<DataValue>(() => {
    const ord = <T extends { nombre: string }>(l: T[]) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return {
      cargando: l1 || l2 || l3 || l4 || l5 || l6,
      sucursales: ord(sucursales),
      areas: ord(areas),
      auditores: ord(auditores),
      requisitos: [...requisitos].sort((a, b) => a.orden - b.orden),
      usuarios: ord(usuarios),
      auditorias: [...auditorias].sort((a, b) => b.anio - a.anio || b.numero - a.numero),
      hallazgos: [...hallazgos].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)),
      programa: [...programa].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      mapa: {
        sucursales: byId(sucursales),
        areas: byId(areas),
        auditores: byId(auditores),
        requisitos: byId(requisitos),
        usuarios: byId(usuarios),
        auditorias: byId(auditorias),
      },
    };
  }, [sucursales, areas, auditores, requisitos, usuarios, auditorias, hallazgos, programa, l1, l2, l3, l4, l5, l6]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
