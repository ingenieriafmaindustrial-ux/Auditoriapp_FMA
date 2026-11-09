import { addDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarX, Plus } from 'lucide-react';
import { ESTADO_PROGRAMA, TIPO_PROGRAMA, asignadoA, iniciales, type EventoAuditoria } from '../../domain/programa';
import { hoyISO } from '../../lib/dates';
import type { Area, Auditor, Usuario } from '../../types';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function Ficha({ e, area, lider, mia, onClick, compacta = false }: { e: EventoAuditoria; area: string; lider: string; mia: boolean; onClick: () => void; compacta?: boolean }) {
  const est = ESTADO_PROGRAMA[e.estado];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${TIPO_PROGRAMA[e.tipo].label} · ${area} · ${est.label} · Líder: ${lider}`}
      className={'flex w-full cursor-pointer items-center gap-1.5 rounded-md border-l-[3px] text-left transition-transform duration-150 hover:-translate-y-px ' + (compacta ? 'min-h-7 px-1.5 py-0.5 text-[11px]' : 'min-h-12 px-3 py-2 text-sm') + (e.estado === 'cancelada' ? ' line-through opacity-60' : '') + (mia ? ' ring-1 ring-brand' : '')}
      style={{ background: est.fondo, borderColor: est.color }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-panel text-[9px] font-bold text-brand" aria-label={TIPO_PROGRAMA[e.tipo].label}>{TIPO_PROGRAMA[e.tipo].letra}</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">{area}</span>
      <span className="shrink-0 rounded bg-surface/70 px-1 text-[10px] font-semibold text-zinc-600">{iniciales(lider)}</span>
      {!compacta && <span className="shrink-0 text-xs" style={{ color: est.color }}>{est.label}</span>}
    </button>
  );
}

/** Vista mensual: grilla de 7 días en escritorio y agenda por día en el teléfono (fichas grandes, fáciles de tocar). */
export function CalendarioMes({ mes, eventos, areas, auditores, u, puedeProgramar, onSelect, onProgramarDia }: {
  mes: Date;
  eventos: EventoAuditoria[];
  areas: Record<string, Area>;
  auditores: Record<string, Auditor>;
  u: Usuario;
  puedeProgramar: boolean;
  onSelect: (e: EventoAuditoria) => void;
  onProgramarDia: (fecha: string) => void;
}) {
  const ini = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
  const fin = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
  const dias: Date[] = [];
  for (let d = ini; d <= fin; d = addDays(d, 1)) dias.push(d);
  const hoy = hoyISO();
  const porDia = (iso: string) => eventos.filter((e) => e.fecha === iso);
  const delMes = eventos.filter((e) => e.fecha.slice(0, 7) === format(mes, 'yyyy-MM'));
  const nombre = (e: EventoAuditoria) => areas[e.areaId]?.nombre ?? 'Área';

  return (
    <>
      {/* Escritorio / tablet: grilla mensual */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-zinc-200">
          {DIAS.map((d, i) => (
            <div key={d} className={'px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider ' + (i >= 5 ? 'text-zinc-400' : 'text-zinc-500')}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const iso = format(d, 'yyyy-MM-dd');
            const evs = porDia(iso);
            const fuera = !isSameMonth(d, mes);
            const finde = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={iso} className={'group/dia relative min-h-[7.5rem] border-b border-r border-zinc-100 p-1.5 ' + (fuera ? 'bg-zinc-50/60' : finde ? 'bg-zinc-50/40' : '')}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ' + (iso === hoy ? 'bg-brand text-ink' : fuera ? 'text-zinc-300' : 'text-zinc-700')}>{d.getDate()}</span>
                  {puedeProgramar && !fuera && (
                    <button type="button" onClick={() => onProgramarDia(iso)} aria-label={`Programar auditoría el ${iso}`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 opacity-0 transition-opacity duration-150 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:opacity-100 group-hover/dia:opacity-100">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map((e) => (
                    <Ficha key={e.id} e={e} area={nombre(e)} lider={auditores[e.liderId]?.nombre ?? '—'} mia={asignadoA(e, u)} onClick={() => onSelect(e)} compacta />
                  ))}
                  {evs.length > 3 && (
                    <button type="button" onClick={() => onSelect(evs[3])} className="w-full cursor-pointer rounded px-1.5 text-left text-[11px] font-semibold text-zinc-500 hover:text-zinc-900">+{evs.length - 3} más</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Teléfono: agenda del mes */}
      <div className="md:hidden">
        {delMes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-zinc-500">
            <CalendarX className="h-8 w-8 text-zinc-300" /> Sin auditorías este mes.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {[...new Set(delMes.map((e) => e.fecha))].map((iso) => {
              const d = new Date(`${iso}T12:00:00`);
              return (
                <li key={iso} className="flex gap-3 py-3">
                  <div className={'flex w-12 shrink-0 flex-col items-center rounded-lg py-1 ' + (iso === hoy ? 'bg-brand text-ink' : 'bg-zinc-100 text-zinc-700')}>
                    <span className="text-[10px] font-semibold uppercase">{format(d, 'EEE', { locale: es })}</span>
                    <span className="font-[family-name:var(--font-display)] text-xl font-bold leading-none">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {porDia(iso).map((e) => (
                      <Ficha key={e.id} e={e} area={nombre(e)} lider={auditores[e.liderId]?.nombre ?? '—'} mia={asignadoA(e, u)} onClick={() => onSelect(e)} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
