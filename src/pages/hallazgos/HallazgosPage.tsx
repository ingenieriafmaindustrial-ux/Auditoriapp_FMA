import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react';
import { EmptyState, Input, PageHeader, Select, Spinner } from '../../components/ui';
import { Hojas } from '../../components/layout/SheetTabs';
import { EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from '../../components/shared/Badges';
import { useData } from '../../context/DataContext';
import { aniosDisponibles, anioActual } from '../../lib/dates';
import { cn, normalizar } from '../../lib/utils';
import { semaforoPlazo } from '../../domain/hallazgoReglas';
import type { Hallazgo } from '../../types';

const POR_GRUPO = 15;

/** Prioridad de orden dentro de cada área: vencidas → no tratadas → en seguimiento → tratadas → anuladas. */
function prioridad(h: Hallazgo) {
  if (h.anulado) return 5;
  if (semaforoPlazo(h) === 'vencido') return 0;
  return { no_tratada: 1, en_seguimiento: 2, tratada: 4 }[h.estado];
}

interface Grupo {
  id: string;
  area: string;
  sucursal: string;
  items: Hallazgo[];
  nc: number;
  om: number;
  abiertos: number;
  vencidos: number;
}

export default function HallazgosPage() {
  const nav = useNavigate();
  const { hallazgos, sucursales, mapa, cargando } = useData();
  const [anio, setAnio] = useState(String(anioActual()));
  const [vista, setVista] = useState<'abiertos' | 'vencidos' | 'tratados' | 'todos'>('abiertos');
  const [tipo, setTipo] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [q, setQ] = useState('');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [limite, setLimite] = useState<Record<string, number>>({});

  const anios = aniosDisponibles(hallazgos.map((h) => h.anio));

  const grupos = useMemo<Grupo[]>(() => {
    const nq = normalizar(q);
    const lista = hallazgos.filter((h) => {
      if (anio !== 'todos' && h.anio !== Number(anio)) return false;
      if (vista === 'abiertos' && (h.anulado || h.estado === 'tratada')) return false;
      if (vista === 'vencidos' && semaforoPlazo(h) !== 'vencido') return false;
      if (vista === 'tratados' && (h.anulado || h.estado !== 'tratada')) return false;
      if (tipo && h.tipo !== tipo) return false;
      const suc = mapa.areas[h.areaId]?.sucursalId ?? h.sucursalId;
      if (sucursal && suc !== sucursal) return false;
      if (nq && !normalizar(`${h.descripcion} ${mapa.auditorias[h.auditoriaId]?.codigo} #${h.correlativo} ${mapa.areas[h.areaId]?.nombre}`).includes(nq)) return false;
      return true;
    });
    const porArea = new Map<string, Hallazgo[]>();
    lista.forEach((h) => porArea.set(h.areaId, [...(porArea.get(h.areaId) ?? []), h]));
    return [...porArea.entries()]
      .map(([areaId, items]) => {
        const ar = mapa.areas[areaId];
        const abiertos = items.filter((h) => !h.anulado && h.estado !== 'tratada');
        return {
          id: areaId,
          area: ar?.nombre ?? 'Área sin catálogo',
          sucursal: mapa.sucursales[ar?.sucursalId ?? items[0].sucursalId]?.nombre ?? '',
          items: items.sort((a, b) => prioridad(a) - prioridad(b) || b.fechaDeteccion.localeCompare(a.fechaDeteccion)),
          nc: items.filter((h) => h.tipo === 'NC' && !h.anulado).length,
          om: items.filter((h) => h.tipo === 'OM' && !h.anulado).length,
          abiertos: abiertos.length,
          vencidos: items.filter((h) => semaforoPlazo(h) === 'vencido').length,
        };
      })
      .sort((a, b) => b.vencidos - a.vencidos || b.abiertos - a.abiertos || a.sucursal.localeCompare(b.sucursal) || a.area.localeCompare(b.area));
  }, [hallazgos, anio, vista, tipo, sucursal, q, mapa]);

  if (cargando) return <Spinner />;

  const total = grupos.reduce((acc, g) => acc + g.items.length, 0);
  const autoAbrir = !!q || grupos.length <= 2;
  const estaAbierta = (id: string) => abiertas[id] ?? autoAbrir;
  const todasAbiertas = grupos.length > 0 && grupos.every((g) => estaAbierta(g.id));
  const baseAnio = hallazgos.filter((h) => anio === 'todos' || h.anio === Number(anio));

  return (
    <div>
      <PageHeader title="Hallazgos / Seguimiento" subtitle={`${total} hallazgo(s) en ${grupos.length} área(s)`} />

      <Hojas
        activa={anio}
        onChange={setAnio}
        hojas={[...anios.map((y) => ({ key: String(y), label: String(y), badge: hallazgos.filter((h) => h.anio === y && !h.anulado).length || undefined })), { key: 'todos', label: 'Todos' }]}
      />

      <div className="mb-4 space-y-3 rounded-b-xl border border-t-0 border-zinc-300 bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {([
            ['abiertos', 'Abiertos', baseAnio.filter((h) => !h.anulado && h.estado !== 'tratada').length],
            ['vencidos', 'Vencidos', baseAnio.filter((h) => semaforoPlazo(h) === 'vencido').length],
            ['tratados', 'Tratados', baseAnio.filter((h) => !h.anulado && h.estado === 'tratada').length],
            ['todos', 'Todos', baseAnio.length],
          ] as const).map(([k, l, n]) => (
            <button key={k} type="button" onClick={() => setVista(k)} className={cn('chip', vista === k && '!border-panel !bg-panel !text-white')}>
              {k === 'vencidos' && <AlertTriangle className="h-3.5 w-3.5" />} {l} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input className="pl-9" placeholder="Buscar descripción, N° auditoría o área…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="NC y OM" options={[{ value: 'NC', label: 'Solo NC' }, { value: 'OM', label: 'Solo OM' }]} />
          <Select value={sucursal} onChange={(e) => setSucursal(e.target.value)} placeholder="Todas las sucursales" options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
        </div>
      </div>

      {grupos.length === 0 ? (
        <EmptyState title="No hay hallazgos con estos filtros" />
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
              onClick={() => setAbiertas(Object.fromEntries(grupos.map((g) => [g.id, !todasAbiertas])))}
            >
              {todasAbiertas ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
              {todasAbiertas ? 'Contraer todas' : 'Expandir todas'}
            </button>
          </div>

          <div className="space-y-2">
            {grupos.map((g) => {
              const abierta = estaAbierta(g.id);
              const max = limite[g.id] ?? POR_GRUPO;
              return (
                <section key={g.id} className={cn('overflow-hidden rounded-xl border bg-surface transition', abierta ? 'border-zinc-300 shadow-sm' : 'border-zinc-200')}>
                  <button
                    type="button"
                    onClick={() => setAbiertas((p) => ({ ...p, [g.id]: !abierta }))}
                    aria-expanded={abierta}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    {abierta ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                    <span className="min-w-0 flex-1">
                      <b className="text-base text-zinc-900">{g.area}</b>
                      {g.sucursal && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{g.sucursal}</span>}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-zinc-600">
                      <span className="flex items-center gap-1"><span className="chip-dot" style={{ background: 'var(--viz-nc)' }} /> <b className="text-zinc-900">{g.nc}</b> NC</span>
                      <span className="flex items-center gap-1"><span className="chip-dot" style={{ background: 'var(--viz-om)' }} /> <b className="text-zinc-900">{g.om}</b> OM</span>
                      <span><b className="text-zinc-900">{g.abiertos}</b> abiertos</span>
                      {g.vencidos > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 font-bold text-white">
                          <AlertTriangle className="h-3 w-3" /> {g.vencidos}
                        </span>
                      )}
                    </span>
                  </button>

                  {abierta && (
                    <div className="border-t border-zinc-100">
                      <ul className="divide-y divide-zinc-100">
                        {g.items.slice(0, max).map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => nav(`/hallazgos/${h.id}`)}
                              className={cn('grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 md:grid-cols-[7.5rem_3rem_1fr_4.5rem_8.5rem_7rem_1rem]', h.anulado && 'opacity-50')}
                            >
                              <span className="whitespace-nowrap text-xs font-semibold text-zinc-500 md:text-sm">{mapa.auditorias[h.auditoriaId]?.codigo ?? '—'} #{h.correlativo}</span>
                              <span className="hidden md:block"><TipoBadge tipo={h.tipo} /></span>
                              <span className="min-w-0">
                                <span className="block truncate text-zinc-800">{h.descripcion}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                                  <TipoBadge tipo={h.tipo} /> <EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} /> <PlazoBadge h={h} />
                                </span>
                              </span>
                              <span className="hidden md:block"><NivelBadge nivel={h.nivel} /></span>
                              <span className="hidden md:block"><EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} /></span>
                              <span className="hidden md:block"><PlazoBadge h={h} /></span>
                              <ChevronRight className="h-4 w-4 text-zinc-400" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {g.items.length > max && (
                        <button type="button" onClick={() => setLimite((p) => ({ ...p, [g.id]: max + POR_GRUPO }))} className="w-full border-t border-zinc-100 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                          Mostrar {Math.min(POR_GRUPO, g.items.length - max)} más · quedan {g.items.length - max}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
