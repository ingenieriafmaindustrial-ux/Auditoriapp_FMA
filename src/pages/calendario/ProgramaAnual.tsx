import { Plus } from 'lucide-react';
import { ESTADO_PROGRAMA, TIPO_PROGRAMA, asignadoA, iniciales, type EventoAuditoria } from '../../domain/programa';
import type { Area, Auditor, Sucursal, Usuario } from '../../types';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Programa anual: matriz área × mes. Cada auditoría es una ficha con el día y las iniciales del líder;
 * las celdas vacías permiten programar directamente (gestores).
 */
export function ProgramaAnual({ anio, grupos, eventos, auditores, u, puedeProgramar, verEneFeb, onSelect, onProgramar }: {
  anio: number;
  grupos: { sucursal: Sucursal | null; areas: Area[] }[];
  eventos: EventoAuditoria[];
  auditores: Record<string, Auditor>;
  u: Usuario;
  puedeProgramar: boolean;
  verEneFeb: boolean;
  onSelect: (e: EventoAuditoria) => void;
  onProgramar: (areaId: string, sucursalId: string, mes: number) => void;
}) {
  const meses = MESES.map((m, i) => ({ m, i })).filter(({ i }) => verEneFeb || i >= 2);
  const mesActual = new Date().getFullYear() === anio ? new Date().getMonth() : -1;
  const delArea = (areaId: string, mes: number) => eventos.filter((e) => e.areaId === areaId && Number(e.fecha.slice(5, 7)) - 1 === mes);

  if (!grupos.some((g) => g.areas.length)) return <p className="py-16 text-center text-sm text-zinc-500">No hay áreas para los filtros seleccionados.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-56 border-b border-zinc-200 bg-surface px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Área</th>
            {meses.map(({ m, i }) => (
              <th key={m} className={'border-b border-zinc-200 px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider ' + (i === mesActual ? 'text-zinc-900' : 'text-zinc-500')}>
                <span className={i === mesActual ? 'rounded-full bg-brand px-2 py-0.5 text-ink' : ''}>{m}</span>
              </th>
            ))}
            <th className="w-16 border-b border-zinc-200 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Total</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) =>
            g.areas.length === 0 ? null : (
              <FilasGrupo key={g.sucursal?.id ?? 'sin'} {...{ g, meses, mesActual, delArea, auditores, u, puedeProgramar, onSelect, onProgramar, anio }} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilasGrupo({ g, meses, mesActual, delArea, auditores, u, puedeProgramar, onSelect, onProgramar }: {
  g: { sucursal: Sucursal | null; areas: Area[] };
  meses: { m: string; i: number }[];
  mesActual: number;
  delArea: (areaId: string, mes: number) => EventoAuditoria[];
  auditores: Record<string, Auditor>;
  u: Usuario;
  puedeProgramar: boolean;
  onSelect: (e: EventoAuditoria) => void;
  onProgramar: (areaId: string, sucursalId: string, mes: number) => void;
  anio: number;
}) {
  return (
    <>
      <tr>
        <td colSpan={meses.length + 2} className="sticky left-0 bg-zinc-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700">
          {g.sucursal?.nombre ?? 'Sin sucursal'} <span className="font-normal normal-case tracking-normal text-zinc-500">· {g.areas.length} área(s)</span>
        </td>
      </tr>
      {g.areas.map((ar) => {
        const total = meses.reduce((n, { i }) => n + delArea(ar.id, i).filter((e) => e.estado !== 'cancelada').length, 0);
        return (
          <tr key={ar.id} className="group/fila">
            <td className="sticky left-0 z-10 border-b border-zinc-100 bg-surface px-3 py-2 font-medium text-zinc-800">
              <span className="block max-w-[13rem] truncate" title={ar.nombre}>{ar.nombre}</span>
            </td>
            {meses.map(({ m, i }) => {
              const evs = delArea(ar.id, i);
              return (
                <td key={m} className={'h-14 border-b border-l border-zinc-100 p-1 align-middle ' + (i === mesActual ? 'bg-brand/5' : '')}>
                  <div className="flex flex-col items-stretch gap-1">
                    {evs.map((e) => {
                      const est = ESTADO_PROGRAMA[e.estado];
                      const mia = asignadoA(e, u);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onSelect(e)}
                          title={`${TIPO_PROGRAMA[e.tipo].label} · ${ar.nombre} · ${e.fecha} · ${est.label} · Líder: ${auditores[e.liderId]?.nombre ?? '—'}`}
                          className={'flex min-h-8 cursor-pointer items-center justify-between gap-1 rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs font-semibold transition-transform duration-150 hover:-translate-y-px ' + (e.estado === 'cancelada' ? 'line-through opacity-60' : '') + (mia ? ' ring-1 ring-brand' : '')}
                          style={{ background: est.fondo, borderColor: est.color, color: 'var(--color-zinc-900)' }}
                        >
                          <span className="flex items-center gap-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-panel text-[9px] font-bold text-brand">{TIPO_PROGRAMA[e.tipo].letra}</span>
                            {e.fecha.slice(8, 10)}
                          </span>
                          <span className="rounded bg-surface/70 px-1 text-[10px] text-zinc-600">{iniciales(auditores[e.liderId]?.nombre)}</span>
                        </button>
                      );
                    })}
                    {puedeProgramar && evs.length < 3 && (
                      <button
                        type="button"
                        onClick={() => onProgramar(ar.id, ar.sucursalId ?? g.sucursal?.id ?? '', i)}
                        aria-label={`Programar ${ar.nombre} en ${m}`}
                        className="flex min-h-8 cursor-pointer items-center justify-center rounded-md border border-dashed border-transparent text-zinc-400 opacity-40 transition-all duration-150 hover:border-zinc-300 hover:text-zinc-700 hover:opacity-100 focus-visible:opacity-100 group-hover/fila:opacity-70"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              );
            })}
            <td className="border-b border-l border-zinc-100 px-2 text-center font-[family-name:var(--font-display)] text-lg font-bold text-zinc-900">{total || <span className="text-zinc-300">0</span>}</td>
          </tr>
        );
      })}
    </>
  );
}
