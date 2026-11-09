import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, PenLine, Pencil, Trash2, UserRound } from 'lucide-react';
import { Alerta, Button, Modal } from '../../../components/ui';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { esGestor } from '../../../domain/permisos';
import { eliminarHallazgo } from '../../../services/hallazgos';
import { errorMensaje } from '../../../lib/utils';
import { EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from '../../../components/shared/Badges';
import { EvidenciasPanel } from '../../../components/shared/EvidenciasPanel';
import { useData } from '../../../context/DataContext';
import { fmtFecha } from '../../../lib/dates';
import { cn } from '../../../lib/utils';
import type { Auditoria, Evidencia, Hallazgo } from '../../../types';

/** Hallazgo registrado, en formato de fila de formulario (lectura), con fotos y acceso al seguimiento. */
export function HallazgoItem({ h, auditoria, evidencias, editable, onEditar, editandoPor = null }: { h: Hallazgo; auditoria: Auditoria; evidencias: Evidencia[]; editable: boolean; onEditar: () => void; editandoPor?: string | null }) {
  const { mapa, hallazgos } = useData();
  const u = useUsuario();
  const notify = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  // Eliminar: solo con la auditoría abierta y sin informe emitido (después se anula), por gestores o quien lo creó
  const puedeEliminar = editable && (auditoria.informeVersion ?? 0) === 0 && (esGestor(u.rol) || h.creadoPor === u.id);
  const quien = (uid?: string) => (!uid ? null : uid === u.id ? 'ti' : mapa.usuarios[uid]?.nombre ?? 'otro usuario');
  const bloqueado = !!editandoPor;
  const posteriores = hallazgos.filter((x) => x.auditoriaId === h.auditoriaId && x.correlativo > h.correlativo).length;
  return (
    <>
    <article className={cn('group rounded-xl border bg-surface p-4 transition hover:border-zinc-400', h.anulado ? 'border-zinc-200 opacity-60' : 'border-zinc-200', h.tipo === 'NC' ? 'border-l-4 border-l-[var(--viz-nc)]' : 'border-l-4 border-l-[var(--viz-om)]')}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-zinc-900">#{h.correlativo}</span>
        <TipoBadge tipo={h.tipo} />
        <NivelBadge nivel={h.nivel} />
        <span className="flex-1" />
        <EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} />
        {bloqueado && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900" title="Otro integrante del equipo está editando este hallazgo">
            <PenLine className="h-3 w-3" /> {editandoPor} está editando…
          </span>
        )}
        {editable && !h.anulado && !bloqueado && (
          <button onClick={onEditar} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" title="Editar hallazgo" aria-label="Editar hallazgo">
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {puedeEliminar && !bloqueado && (
          <button onClick={() => setConfirmar(true)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Eliminar hallazgo" aria-label="Eliminar hallazgo">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">{h.descripcion}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {h.requisitoIds.map((id) => mapa.requisitos[id]).filter(Boolean).map((r) => (
          <span key={r.id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700" title={r.titulo}>
            {r.norma} {r.clausula}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <EvidenciasPanel compacto auditoria={auditoria} evidencias={evidencias} hallazgoId={h.id} editable={!h.anulado && auditoria.estado !== 'anulada'} />
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1" title={h.actualizadoPor && h.actualizadoPor !== h.creadoPor ? `Último cambio: ${quien(h.actualizadoPor)}` : undefined}>
            <UserRound className="h-3.5 w-3.5" /> Registrado por <b className="font-semibold text-zinc-700">{quien(h.creadoPor)}</b>
            {h.actualizadoPor && h.actualizadoPor !== h.creadoPor && <> · editado por <b className="font-semibold text-zinc-700">{quien(h.actualizadoPor)}</b></>}
          </span>
          <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Detectado {fmtFecha(h.fechaDeteccion)}</span>
          <PlazoBadge h={h} />
          <Link to={`/hallazgos/${h.id}`} className="inline-flex items-center gap-1 font-semibold text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline">
            Seguimiento <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
    <Modal
      open={confirmar}
      onClose={() => setConfirmar(false)}
      title={`Eliminar hallazgo #${h.correlativo}`}
      footer={
        <>
          <Button onClick={() => setConfirmar(false)}>Cancelar</Button>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            loading={borrando}
            onClick={async () => {
              setBorrando(true);
              try {
                await eliminarHallazgo(u, h, evidencias.map((e) => e.id), hallazgos.filter((x) => x.auditoriaId === h.auditoriaId));
                notify(`Hallazgo #${h.correlativo} eliminado`);
                setConfirmar(false);
              } catch (e) {
                notify(errorMensaje(e), 'error');
              } finally {
                setBorrando(false);
              }
            }}
          >
            Eliminar definitivamente
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-700">«{h.descripcion.replace(/\s+/g, ' ').slice(0, 160)}{h.descripcion.length > 160 ? '…' : ''}»</p>
      <div className="mt-3">
        <Alerta tipo="warn">
          Se borra el hallazgo{evidencias.length ? ` y sus ${evidencias.length} foto(s)` : ''}. No se puede deshacer.
          {posteriores > 0 && ` Los ${posteriores} hallazgo(s) siguientes se renumeran para no dejar saltos.`}
        </Alerta>
      </div>
    </Modal>
    </>
  );
}
