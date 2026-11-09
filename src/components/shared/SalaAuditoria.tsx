import { Crown, DoorOpen, Eye, PenLine, Users } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { describirEdicion, enLinea } from '../../services/presencia';
import type { Auditoria, Presencia } from '../../types';

const hace = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

/** "Sala" de la auditoría: quién del equipo está conectado, qué está haciendo y a quién se espera. */
export function SalaAuditoria({ auditoria: a, lista }: { auditoria: Auditoria; lista: Presencia[] }) {
  const { mapa, usuarios } = useData();
  const u = useUsuario();
  const ahora = Date.now();
  const integrantes = [...new Set([...a.equipoIds, a.auditorLiderId].filter(Boolean))].map((auditorId) => {
    const cuenta = usuarios.find((x) => x.auditorId === auditorId && x.activo);
    const p = lista.find((x) => x.auditorId === auditorId || (!!cuenta && x.usuarioId === cuenta.id)) ?? null;
    return {
      auditorId,
      nombre: mapa.auditores[auditorId]?.nombre ?? cuenta?.nombre ?? 'Auditor',
      rol: a.equipoIds.includes(auditorId) ? (auditorId === a.auditorLiderId ? 'Líder y auditor' : 'Auditor') : 'Líder · revisor',
      lider: auditorId === a.auditorLiderId,
      auditaEnTerreno: a.equipoIds.includes(auditorId),
      cuenta,
      p,
      online: !!p && enLinea(p, ahora),
      yo: !!cuenta && cuenta.id === u.id,
    };
  });
  const idsEquipo = new Set(integrantes.map((i) => i.cuenta?.id).filter(Boolean));
  const observadores = lista.filter((p) => enLinea(p, ahora) && !idsEquipo.has(p.usuarioId));
  const equipo = integrantes.filter((i) => i.auditaEnTerreno);
  const dentro = equipo.filter((i) => i.online).length;
  const esperando = equipo.filter((i) => !i.online && i.cuenta);

  return (
    <section className="sala rounded-2xl border border-zinc-200 bg-surface p-3 sm:p-4" aria-label="Sala de auditoría" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel text-brand"><Users className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wide text-zinc-900">Sala de auditoría</p>
          <p className="text-xs text-zinc-500">
            {equipo.length === 0
              ? 'Sin auditores asignados'
              : dentro === equipo.length
                ? `Equipo auditor completo en la sala (${dentro}/${equipo.length})`
                : `${dentro} de ${equipo.length} auditor(es) en la sala${esperando.length ? ` · esperando a ${esperando.map((e) => e.nombre.split(' ')[0]).join(' y ')}` : ''}`}
          </p>
        </div>
        {dentro === equipo.length && equipo.length > 1 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-800">Auditoría en dúo</span>}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {integrantes.map((i) => {
          const que = i.online ? describirEdicion(i.p!.editando) : null;
          return (
            <li key={i.auditorId} className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2', i.online ? 'border-emerald-300 bg-emerald-50/60' : 'border-zinc-200 bg-zinc-50')}>
              <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-sm font-bold text-white">
                {i.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white', i.online ? 'sala-punto bg-emerald-500' : 'bg-zinc-300')} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-900">
                  {i.lider && <Crown className="h-3.5 w-3.5 shrink-0 text-brand" />}
                  {i.nombre}{i.yo && <span className="font-normal text-zinc-500"> (tú)</span>}
                </p>
                <p className="text-[11px] text-zinc-500">{i.rol}</p>
                <p className={cn('mt-0.5 flex items-center gap-1 text-xs', i.online ? 'text-emerald-800' : 'text-zinc-500')}>
                  {i.online ? (
                    que ? <><PenLine className="h-3 w-3" /> {que}</> : <><DoorOpen className="h-3 w-3" /> En la sala</>
                  ) : !i.cuenta ? (
                    'Sin cuenta en la app'
                  ) : i.p ? (
                    `Fuera de la sala · salió ${hace(i.p.ultimaSenal)}`
                  ) : i.auditaEnTerreno ? (
                    <span className="sala-esperando">Esperando a que entre</span>
                  ) : (
                    'Aún no entra'
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {observadores.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
          <Eye className="h-3 w-3" /> También viendo: {observadores.map((o) => (o.usuarioId === u.id ? 'tú' : o.nombre)).join(', ')}
        </p>
      )}
    </section>
  );
}
