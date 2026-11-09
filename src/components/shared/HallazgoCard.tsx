import { Link } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from './Badges';
import type { Hallazgo } from '../../types';

export function HallazgoCard({ h }: { h: Hallazgo }) {
  const { mapa } = useData();
  return (
    <Link to={`/hallazgos/${h.id}`} className="card flex flex-col gap-2 p-3 transition hover:border-zinc-400 hover:shadow">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-zinc-500">{mapa.auditorias[h.auditoriaId]?.codigo ?? '—'} #{h.correlativo}</span>
        <TipoBadge tipo={h.tipo} />
        <NivelBadge nivel={h.nivel} />
        <span className="flex-1" />
        <EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} />
      </div>
      <p className="line-clamp-3 text-sm text-zinc-800">{h.descripcion}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {mapa.areas[h.areaId]?.nombre} · {h.auditorResponsableId ? mapa.auditores[h.auditorResponsableId]?.nombre : 'Sin responsable'}
        </span>
        <PlazoBadge h={h} />
      </div>
    </Link>
  );
}
