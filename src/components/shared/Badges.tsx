import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '../ui';
import { ESTADOS_AUDITORIA, ESTADOS_HALLAZGO } from '../../lib/constants';
import { plazoEfectivo, semaforoPlazo } from '../../domain/hallazgoReglas';
import { diasHasta, fmtFecha } from '../../lib/dates';
import type { EstadoAuditoria, EstadoHallazgo, Hallazgo, Nivel, TipoHallazgo } from '../../types';

export const TipoBadge = ({ tipo }: { tipo: TipoHallazgo }) => (
  <Badge className={tipo === 'NC' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'}>{tipo}</Badge>
);

export const NivelBadge = ({ nivel }: { nivel: Nivel }) => {
  const c = { BAJA: 'bg-emerald-100 text-emerald-800', MEDIA: 'bg-amber-100 text-amber-900', ALTA: 'bg-red-600 text-white' }[nivel];
  return <Badge className={c}>{nivel}</Badge>;
};

export const EstadoHallazgoBadge = ({ estado, anulado }: { estado: EstadoHallazgo; anulado?: boolean }) => {
  if (anulado) return <Badge className="bg-zinc-200 text-zinc-600 line-through">Anulado</Badge>;
  const c = { no_tratada: 'bg-red-50 text-red-700 ring-1 ring-red-200', en_seguimiento: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200', tratada: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' }[estado];
  return <Badge className={c}>{ESTADOS_HALLAZGO[estado]}</Badge>;
};

export const EstadoAuditoriaBadge = ({ estado }: { estado: EstadoAuditoria }) => {
  const c = {
    planificada: 'bg-zinc-100 text-zinc-700',
    en_ejecucion: 'bg-sky-100 text-sky-800',
    en_revision: 'bg-amber-100 text-amber-900',
    cerrada: 'bg-emerald-100 text-emerald-800',
    anulada: 'bg-zinc-200 text-zinc-500 line-through',
  }[estado];
  return <Badge className={c}>{ESTADOS_AUDITORIA[estado]}</Badge>;
};

export function PlazoBadge({ h }: { h: Pick<Hallazgo, 'fechaLimite' | 'estado' | 'anulado'> & { tipo?: Hallazgo['tipo']; fechaDeteccion?: string } }) {
  const s = semaforoPlazo(h);
  const limite = plazoEfectivo(h);
  if (h.tipo === 'OM' && s !== 'cerrado') return <span className="text-xs text-zinc-500">Sin plazo</span>;
  if (s === 'sin_fecha' && h.tipo === 'NC') return <span className="text-xs text-zinc-500">Sin fecha</span>;
  if (s === 'cerrado' || s === 'sin_fecha') return <span className="text-xs text-zinc-500">{fmtFecha(limite)}</span>;
  if (s === 'vencido')
    return (
      <Badge className="bg-red-600 text-white">
        <AlertTriangle className="h-3 w-3" /> Vencido {Math.abs(diasHasta(limite!))}d
      </Badge>
    );
  if (s === 'proximo')
    return (
      <Badge className="bg-amber-400 text-ink">
        <Clock className="h-3 w-3" /> Vence en {diasHasta(limite!)}d
      </Badge>
    );
  return <span className="text-xs text-zinc-600">{fmtFecha(limite)}</span>;
}
