import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CalendarCheck, CalendarClock, ClipboardList, Download, ExternalLink, FileSearch, MapPin, Pencil, PlayCircle, RotateCcw, Trash2, UserRound, Users } from 'lucide-react';
import { Badge, Button, Modal } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { esGestor } from '../../domain/permisos';
import { ESTADO_PROGRAMA, TIPO_PROGRAMA, asignadoA, type EventoAuditoria } from '../../domain/programa';
import { diasHasta, fmtFecha } from '../../lib/dates';
import { errorMensaje } from '../../lib/utils';
import { cancelarPrograma, eliminarPrograma, marcarRealizado } from '../../services/programa';
import { hoyISO } from '../../lib/dates';

function Bloque({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{icono} {titulo}</h4>
      {children}
    </section>
  );
}

/** Ficha de una auditoría del calendario: quién, cuándo, qué revisar y antecedentes del área. */
export function VistaPreviaModal({ evento, onClose, onCrear, onEditar, onPlanPdf }: {
  evento: EventoAuditoria | null;
  onClose: () => void;
  onCrear: (e: EventoAuditoria) => void;
  onEditar: (e: EventoAuditoria) => void;
  onPlanPdf: (e: EventoAuditoria) => void;
}) {
  const u = useUsuario();
  const notify = useToast();
  const { mapa, auditorias, hallazgos } = useData();
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  if (!evento) return null;

  const e = evento;
  const area = mapa.areas[e.areaId];
  const suc = mapa.sucursales[e.sucursalId];
  const est = ESTADO_PROGRAMA[e.estado];
  const dias = diasHasta(e.fecha);
  const cuando = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
  const gestor = esGestor(u.rol);
  const mia = asignadoA(e, u);
  const anterior = auditorias
    .filter((a) => a.areaId === e.areaId && a.estado === 'cerrada' && a.id !== e.auditoria?.id && (a.fechaRealizacion ?? a.fechaPlanificada) < e.fecha)
    .sort((a, b) => (b.fechaRealizacion ?? b.fechaPlanificada).localeCompare(a.fechaRealizacion ?? a.fechaPlanificada))[0];
  const hsAnt = anterior ? hallazgos.filter((h) => h.auditoriaId === anterior.id && !h.anulado) : [];
  const esEficacia = e.tipo === 'eficacia';
  // Eficacia: todos los hallazgos del año del área (NC y OM) que esperan su medición; resto: NC abiertas del área
  const pendientes = hallazgos.filter((h) => h.areaId === e.areaId && !h.anulado && h.estado !== 'tratada' && (esEficacia ? h.anio === e.anio : h.tipo === 'NC'));
  const totalAnio = esEficacia ? hallazgos.filter((h) => h.areaId === e.areaId && !h.anulado && h.anio === e.anio).length : 0;
  const maxLista = esEficacia ? 10 : 4;
  const puntos = area?.plan ?? [];

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setTrabajando(true);
    try {
      await fn();
      notify(ok);
      onClose();
    } catch (err) {
      notify(errorMensaje(err), 'error');
    } finally {
      setTrabajando(false);
      setConfirmar(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-panel px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-brand">{TIPO_PROGRAMA[e.tipo].label}</span>
          {area?.nombre ?? 'Área'} <span className="text-sm font-normal text-zinc-500">· {suc?.nombre}</span>
          <Badge className="ml-1 bg-zinc-100">
            <span className="inline-flex items-center gap-1.5" style={{ color: est.color }}><span className="h-2 w-2 rounded-full" style={{ background: est.color }} />{est.label}</span>
          </Badge>
          {mia && <Badge className="bg-brand text-ink">Te corresponde</Badge>}
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {gestor && e.programa && !confirmar && (
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmar(true)}>Eliminar</Button>
          )}
          {gestor && e.programa && confirmar && (
            <Button variant="danger" loading={trabajando} onClick={() => accion(() => eliminarPrograma(e.programa!), 'Programación eliminada')}>Confirmar eliminación</Button>
          )}
          <span className="flex-1" />
          {e.tipo === 'auditoria' && <Button icon={<Download className="h-4 w-4" />} onClick={() => onPlanPdf(e)}>Plan (PDF)</Button>}
          {gestor && e.programa && e.tipo !== 'auditoria' && (
            <>
              {!e.programa.realizadoEn && (
                <Button icon={e.programa.cancelado ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />} loading={trabajando} onClick={() => accion(() => cancelarPrograma(e.programa!, !e.programa!.cancelado), e.programa!.cancelado ? 'Programación reactivada' : 'Actividad cancelada')}>
                  {e.programa.cancelado ? 'Reactivar' : 'Cancelar'}
                </Button>
              )}
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEditar(e)}>Reprogramar</Button>
              {!e.programa.cancelado && (
                e.programa.realizadoEn ? (
                  <Button icon={<RotateCcw className="h-4 w-4" />} loading={trabajando} onClick={() => accion(() => marcarRealizado(e.programa!, null), 'Marcada como pendiente')}>Marcar pendiente</Button>
                ) : (
                  <Button variant="primary" icon={<CalendarCheck className="h-4 w-4" />} loading={trabajando} onClick={() => accion(() => marcarRealizado(e.programa!, hoyISO()), `${TIPO_PROGRAMA[e.tipo].label} registrada como realizada`)}>Marcar realizada</Button>
                )
              )}
            </>
          )}
          {gestor && e.programa && e.tipo === 'auditoria' && !e.auditoria && (
            <>
              <Button icon={e.programa.cancelado ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />} loading={trabajando} onClick={() => accion(() => cancelarPrograma(e.programa!, !e.programa!.cancelado), e.programa!.cancelado ? 'Programación reactivada' : 'Auditoría cancelada')}>
                {e.programa.cancelado ? 'Reactivar' : 'Cancelar'}
              </Button>
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEditar(e)}>Reprogramar</Button>
              {!e.programa.cancelado && <Button variant="primary" icon={<PlayCircle className="h-4 w-4" />} onClick={() => onCrear(e)}>Crear auditoría</Button>}
            </>
          )}
          {e.auditoria && (
            <Link to={`/auditorias/${e.auditoria.id}`} onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-ink hover:bg-brand-dark">
              <ExternalLink className="h-4 w-4" /> Abrir auditoría {e.auditoria.codigo}
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-zinc-50 px-4 py-3">
          <span className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-brand" /><b className="text-lg text-zinc-900">{fmtFecha(e.fecha)}</b></span>
          <span className="text-sm font-semibold" style={{ color: dias < 0 && e.estado === 'atrasada' ? 'var(--viz-critical)' : undefined }}>{cuando}</span>
          {e.auditoria && <span className="text-sm text-zinc-600">Auditoría {e.auditoria.codigo}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bloque titulo="Equipo auditor" icono={<Users className="h-3.5 w-3.5" />}>
            <p className="text-sm"><span className="text-zinc-500">Líder:</span> <b className="text-zinc-900">{mapa.auditores[e.liderId]?.nombre ?? '—'}</b></p>
            <p className="mt-1 text-sm"><span className="text-zinc-500">Equipo:</span> {e.equipoIds.length ? e.equipoIds.map((id) => mapa.auditores[id]?.nombre ?? '—').join(', ') : <span className="text-zinc-500">solo el líder</span>}</p>
          </Bloque>
          <Bloque titulo="Área auditada" icono={<MapPin className="h-3.5 w-3.5" />}>
            <p className="flex items-center gap-2 text-sm"><UserRound className="h-4 w-4 text-zinc-400" /> {area?.encargado || <span className="text-zinc-500">Sin encargado registrado</span>}</p>
            {area?.cargoEncargado && <p className="mt-0.5 pl-6 text-xs text-zinc-500">{area.cargoEncargado}</p>}
          </Bloque>
        </div>

        <Bloque titulo={`Plan del área · ${puntos.length} puntos`} icono={<ClipboardList className="h-3.5 w-3.5" />}>
          {puntos.length === 0 ? (
            <p className="text-sm text-zinc-500">El área aún no tiene plan de auditoría (Catálogos → Áreas).</p>
          ) : (
            <ol className="grid gap-x-6 gap-y-1 text-sm text-zinc-700 sm:grid-cols-2">
              {puntos.slice(0, 8).map((p, i) => (
                <li key={p.id} className="flex gap-2"><span className="w-5 shrink-0 text-right text-xs text-zinc-400">{i + 1}.</span><span className="min-w-0 truncate" title={p.titulo}>{p.titulo}</span></li>
              ))}
              {puntos.length > 8 && <li className="text-xs text-zinc-500 sm:col-span-2">y {puntos.length - 8} punto(s) más en el PDF del plan.</li>}
            </ol>
          )}
        </Bloque>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bloque titulo="Auditoría anterior" icono={<FileSearch className="h-3.5 w-3.5" />}>
            {anterior ? (
              <>
                <Link to={`/auditorias/${anterior.id}`} onClick={onClose} className="text-sm font-semibold underline">{anterior.codigo}</Link>
                <span className="ml-2 text-xs text-zinc-500">{fmtFecha(anterior.fechaRealizacion ?? anterior.fechaPlanificada)}</span>
                <p className="mt-1 text-sm text-zinc-700">{hsAnt.filter((h) => h.tipo === 'NC').length} NC · {hsAnt.filter((h) => h.tipo === 'OM').length} OM</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Sin auditorías anteriores registradas.</p>
            )}
          </Bloque>
          <Bloque titulo={esEficacia ? `Hallazgos ${e.anio} a medir · ${totalAnio - pendientes.length} de ${totalAnio} tratados` : 'NC pendientes a verificar'} icono={<Ban className="h-3.5 w-3.5" />}>
            {pendientes.length === 0 ? (
              <p className="text-sm text-zinc-500">{esEficacia ? 'Todos los hallazgos del año ya están tratados.' : 'El área no tiene NC abiertas.'}</p>
            ) : (
              <ul className="space-y-1">
                {pendientes.slice(0, maxLista).map((h) => (
                  <li key={h.id} className="truncate text-sm">
                    {esEficacia && <span className={`mr-1.5 rounded px-1 text-[10px] font-bold ${h.tipo === 'NC' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>{h.tipo}</span>}
                    <Link to={`/hallazgos/${h.id}`} onClick={onClose} className="font-semibold underline">{mapa.auditorias[h.auditoriaId]?.codigo} #{h.correlativo}</Link>
                    <span className="ml-2 text-zinc-600">{h.descripcion.slice(0, 70)}</span>
                  </li>
                ))}
                {pendientes.length > maxLista && <li className="text-xs text-zinc-500">y {pendientes.length - maxLista} más.</li>}
              </ul>
            )}
          </Bloque>
        </div>

        {e.tipo !== 'auditoria' && (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600">
            {TIPO_PROGRAMA[e.tipo].descripcion} Registra el resultado en cada NC (Hallazgos / Seguimiento) y luego marca esta actividad como realizada.
            {e.programa?.realizadoEn && <b className="mt-1 block text-zinc-800">Realizada el {fmtFecha(e.programa.realizadoEn)}.</b>}
          </p>
        )}

        {e.programa?.notas && (
          <Bloque titulo="Notas" icono={<Pencil className="h-3.5 w-3.5" />}>
            <p className="whitespace-pre-line text-sm text-zinc-700">{e.programa.notas}</p>
          </Bloque>
        )}
      </div>
    </Modal>
  );
}
