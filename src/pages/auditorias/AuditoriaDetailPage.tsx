import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, CheckCircle2, Clock3, Crown, Download, Eye, FileCheck2, History, MoreHorizontal, PenLine, Pencil, Play, Plus, RotateCcw, Save, Send, Stamp, Trash2, Undo2 } from 'lucide-react';
import { PlanAuditoria } from './hoja/PlanAuditoria';
import { GuiaAuditoria } from '../../components/shared/GuiaAuditoria';
import { resumenPlan, vincularPlan } from '../../domain/plan';
import { EliminarAuditoriaModal } from '../../components/shared/EliminarAuditoriaModal';
import { BotonVolver } from '../../components/shared/BotonVolver';
import { Alerta, Button, EmptyState, ErrorList, Field, Input, Modal, Spinner, Textarea } from '../../components/ui';
import { EstadoAuditoriaBadge } from '../../components/shared/Badges';
import { EvidenciasPanel } from '../../components/shared/EvidenciasPanel';
import { MotivoModal } from '../../components/shared/MotivoModal';
import { HallazgoCard } from '../../components/shared/HallazgoCard';
import { VistaInforme } from '../../components/informe/VistaInforme';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBitacora, useEvidencias, useInformes } from '../../hooks/useAuditoriaData';
import { AYUDA_ESTADOS, NORMA_VERSION, PLAZO_SEGUIMIENTO_DIAS } from '../../lib/constants';
import { ahoraISO, fmtFecha, fmtFechaHora } from '../../lib/dates';
import { cn, errorMensaje } from '../../lib/utils';
import { hallazgoDescripcionEditable, transicionesDisponibles, validarEnvioRevisionSimple, type Transicion } from '../../domain/auditoriaReglas';
import { construirSnapshot } from '../../domain/informe';
import { esAdminTI, esGestor, puedeEmitirInforme } from '../../domain/permisos';
import { cambiarEstadoAuditoria, comenzarAuditoria, devolverConObservaciones, emitirInforme, enviarARevision, fijarPlazoSeguimiento, guardarAprobaciones, guardarNotas, ConflictoNotas } from '../../services/auditorias';
import { descargarInformeWord } from '../../services/informeExport';
import { AuditoriaFormModal } from './AuditoriaFormModal';
import { HallazgoEditor } from './hoja/HallazgoEditor';
import { HallazgoItem } from './hoja/HallazgoItem';
import { SalaAuditoria } from '../../components/shared/SalaAuditoria';
import { usePresencia } from '../../services/presencia';
import type { Aprobacion, EditandoEn, EstadoAuditoria, InformeSnapshot, RevisionDoc } from '../../types';

const ETAPAS: { key: Exclude<EstadoAuditoria, 'anulada'>; label: string }[] = [
  { key: 'planificada', label: 'Planificada' },
  { key: 'en_ejecucion', label: 'En curso' },
  { key: 'en_revision', label: 'Revisión líder' },
  { key: 'cerrada', label: 'Cerrada' },
];

const ETIQUETA_REV: Record<RevisionDoc['tipo'], string> = {
  envio: 'Enviada a revisión',
  observacion: 'Devuelta con observaciones',
  aprobacion: 'Aprobada por auditor líder',
  emision: 'Informe emitido',
  reapertura: 'Reabierta',
};
const TONO_REV: Record<RevisionDoc['tipo'], string> = {
  envio: 'bg-sky-100 text-sky-800',
  observacion: 'bg-amber-100 text-amber-900',
  aprobacion: 'bg-emerald-100 text-emerald-800',
  emision: 'bg-panel text-brand',
  reapertura: 'bg-red-100 text-red-800',
};

/** Bloque numerado de la hoja (formulario continuo, sin pestañas). */
function Bloque({ id, n, titulo, extra, children }: { id: string; n: number; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-44 rounded-2xl border border-zinc-200 bg-surface shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel font-[family-name:var(--font-display)] text-sm font-bold text-brand">{n}</span>
        <h2 className="flex-1 text-lg font-bold uppercase tracking-wide text-zinc-900">{titulo}</h2>
        {extra}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Dato({ label, children, ancho }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2 lg:col-span-4' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-zinc-900">{children || '—'}</dd>
    </div>
  );
}

export default function AuditoriaDetailPage() {
  const { id = '' } = useParams();
  const u = useUsuario();
  const notify = useToast();
  const { mapa, hallazgos, cargando } = useData();
  const a = mapa.auditorias[id];
  const evid = useEvidencias(id);
  const informes = useInformes(id);
  const bitacora = useBitacora(id);

  const [editarDatos, setEditarDatos] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [trans, setTrans] = useState<Transicion | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [notas, setNotas] = useState('');
  const [notasDirty, setNotasDirty] = useState(false);
  /** Texto de las notas cuando empecé a escribir (para detectar si otro auditor las cambió). */
  const [notasBase, setNotasBase] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoNotas | null>(null);
  const [editarNotasIgual, setEditarNotasIgual] = useState(false);
  const [jefe, setJefe] = useState('');
  const [emitir, setEmitir] = useState(false);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState('');
  const [preview, setPreview] = useState<InformeSnapshot | null>(null);
  const [comentarioRev, setComentarioRev] = useState('');
  const [menuAcc, setMenuAcc] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (a && !notasDirty) setNotas(a.notas ?? '');
  }, [a, notasDirty]);
  useEffect(() => {
    if (a) setJefe((j) => j || a.auditadosTexto || '');
  }, [a]);

  // Permite llegar directo a una sección (ej.: /auditorias/ID#hallazgos)
  useEffect(() => {
    if (cargando || !window.location.hash) return;
    const t = window.setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150);
    return () => window.clearTimeout(t);
  }, [cargando]);

  const hs = useMemo(() => hallazgos.filter((h) => h.auditoriaId === id).sort((x, y) => x.correlativo - y.correlativo), [hallazgos, id]);
  const borrador = useMemo(() => (a ? construirSnapshot({ ...a, notas }, hallazgos, evid.data, mapa) : null), [a, notas, hallazgos, evid.data, mapa]);

  // ---- Trabajo en equipo: presencia en la sala y qué está editando cada uno ----
  const [enNotas, setEnNotas] = useState(false);
  const hEditando = editando ? hs.find((h) => h.id === editando) : undefined;
  const editandoActual: EditandoEn = hEditando ? { tipo: 'hallazgo', id: hEditando.id, n: hEditando.correlativo } : nuevo ? { tipo: 'nuevo' } : enNotas || notasDirty ? { tipo: 'notas' } : null;
  const sala = usePresencia(a, u, editandoActual);
  const otroEnNotas = sala.editadoPorOtro((e) => e.tipo === 'notas');

  // Aviso cuando otro integrante registra un hallazgo
  const vistos = useRef<{ id: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (cargando) return;
    if (!vistos.current || vistos.current.id !== id) { vistos.current = { id, ids: new Set(hs.map((h) => h.id)) }; return; }
    hs.filter((h) => !vistos.current!.ids.has(h.id)).forEach((h) => {
      vistos.current!.ids.add(h.id);
      if (h.creadoPor !== u.id) notify(`${mapa.usuarios[h.creadoPor]?.nombre.split(' ')[0] ?? 'Otro auditor'} registró el hallazgo #${h.correlativo} (${h.tipo})`);
    });
  }, [hs, cargando, id, u.id, mapa.usuarios, notify]);

  if (cargando) return <Spinner />;
  if (!a || !borrador) return <EmptyState title="Auditoría no encontrada">Puede que no tengas acceso o que no exista.</EmptyState>;

  const activos = hs.filter((h) => !h.anulado);
  const nc = activos.filter((h) => h.tipo === 'NC').length;
  const om = activos.filter((h) => h.tipo === 'OM').length;
  const editableHallazgos = hallazgoDescripcionEditable(a.estado);
  const gestor = esGestor(u.rol);
  const anteriores = a.auditoriaAnteriorId ? hallazgos.filter((h) => h.auditoriaId === a.auditoriaAnteriorId && !h.anulado && h.estado !== 'tratada') : [];
  const evidGeneral = evid.data.filter((e) => !e.hallazgoId && !e.checklistItemId);
  const soyLider = !!u.auditorId && u.auditorId === a.auditorLiderId;
  const soyEquipo = !!u.auditorId && a.equipoIds.includes(u.auditorId);
  const puedeEmitir = puedeEmitirInforme(u, a) && (a.estado === 'en_revision' || a.estado === 'cerrada');
  const aprob = a.aprobaciones ?? [];
  const revisiones = a.revisiones ?? [];
  const ultimaRev = revisiones.at(-1);
  const participo = gestor || (!!u.auditorId && a.participantes.includes(u.auditorId));
  const esRevisor = u.rol === 'auditor_lider' || soyLider;
  const puedeEliminar = esAdminTI(u);

  /** Guarda mis notas sin pisar las de otro auditor; si hubo cambios ajenos muestra el conflicto. */
  const guardarMisNotas = async (texto = notas, base = notasBase) => {
    try {
      await guardarNotas(u, a, texto, base);
      setNotasDirty(false);
      setNotasBase(null);
      setConflicto(null);
      return true;
    } catch (e) {
      if (e instanceof ConflictoNotas) {
        setConflicto(e);
        document.getElementById('notas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      throw e;
    }
  };
  const guardarNotasSiCambio = async () => {
    if (notasDirty) await guardarMisNotas();
  };

  const comenzar = async () => {
    setLoading('comenzar');
    try {
      await comenzarAuditoria(u, a);
      notify('Auditoría en curso: ya puedes registrar hallazgos');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setLoading('');
    }
  };

  const enviar = async () => {
    setErrores([]);
    const e = validarEnvioRevisionSimple(activos.length, notas);
    if (e.length) {
      setErrores(e);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setLoading('enviar');
    try {
      await guardarNotasSiCambio();
      await enviarARevision(u, a, comentarioRev.trim());
      setComentarioRev('');
      notify(`Enviada a ${mapa.auditores[a.auditorLiderId]?.nombre ?? 'auditor líder'} para revisión`);
    } catch (err) {
      notify(errorMensaje(err), 'error');
    } finally {
      setLoading('');
    }
  };

  const devolver = async () => {
    setLoading('devolver');
    try {
      await devolverConObservaciones(u, a, comentarioRev.trim());
      setComentarioRev('');
      notify('Auditoría devuelta con observaciones');
    } catch (err) {
      notify(errorMensaje(err), 'error');
    } finally {
      setLoading('');
    }
  };

  const aprobarYEmitir = async () => {
    setLoading('emitir');
    try {
      await guardarNotasSiCambio();
      const apLider: Aprobacion = { rol: 'auditor_lider', nombre: mapa.auditores[a.auditorLiderId]?.nombre ?? u.nombre, usuarioId: u.id, fecha: ahoraISO() };
      const aprobaciones = [...aprob.filter((x) => x.rol !== 'auditor_lider'), apLider];
      await guardarAprobaciones(a, aprobaciones);
      const v = await emitirInforme(u, { ...a, aprobaciones }, { ...borrador, aprobaciones }, comentarioRev.trim());
      setComentarioRev('');
      notify(`Informe v${v} aprobado y emitido. Auditoría cerrada.`);
    } catch (err) {
      notify(errorMensaje(err), 'error');
    } finally {
      setLoading('');
    }
  };

  const ejecutar = async (t: Transicion, motivo?: string) => {
    setErrores([]);
    if (t.hacia === 'en_revision' && a.estado === 'en_ejecucion') {
      const e = validarEnvioRevisionSimple(activos.length, notas);
      if (e.length) return setErrores(e);
      if (notasDirty) {
        try { await guardarMisNotas(); } catch (err) { return notify(errorMensaje(err), 'error'); }
      }
    }
    try {
      await cambiarEstadoAuditoria(u, a, t.hacia, motivo);
      notify(t.etiqueta);
      setTrans(null);
    } catch (err) {
      notify(errorMensaje(err), 'error');
    }
  };

  const aprobar = async (ap: Aprobacion) => {
    const resto = aprob.filter((x) => !(x.rol === ap.rol && (ap.rol !== 'equipo' || x.usuarioId === ap.usuarioId)));
    try {
      await guardarAprobaciones(a, [...resto, ap]);
      notify('Aprobación registrada');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    }
  };

  const descargar = async (s: InformeSnapshot, clave: string) => {
    setLoading(clave);
    try {
      await descargarInformeWord(s, evid.data);
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setLoading('');
    }
  };

  const vinculosPlan = vincularPlan(a.plan ?? [], hs, mapa.requisitos);
  const resumenPlanHoja = resumenPlan(a.plan ?? [], vinculosPlan);
  const irHallazgo = (hid: string) => document.getElementById(`hallazgo-${hid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const pasos = [
    { id: 'datos', label: 'Datos', ok: true },
    { id: 'plan', label: `Plan (${resumenPlanHoja.revisados}/${resumenPlanHoja.total})`, ok: resumenPlanHoja.total > 0 && resumenPlanHoja.pendiente === 0 },
    { id: 'hallazgos', label: `Hallazgos (${activos.length})`, ok: activos.length > 0 },
    { id: 'notas', label: 'Notas y evidencia', ok: !!a.notas?.trim() || evidGeneral.length > 0 },
    { id: 'cierre', label: 'Revisión y cierre', ok: a.informeVersion > 0 },
  ];

  return (
    <div>
      <BotonVolver to="/auditorias" destino={`Auditorías ${a.anio}`} />

      {/* Encabezado de la hoja */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Hoja de auditoría interna</p>
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold uppercase text-zinc-900">
            N° {a.codigo} <EstadoAuditoriaBadge estado={a.estado} />
          </h1>
          <p className="text-sm text-zinc-500">{mapa.areas[a.areaId]?.nombre} · {mapa.sucursales[a.sucursalId]?.nombre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.estado === 'planificada' && participo && (
            <Button variant="primary" icon={<Play className="h-4 w-4" />} loading={loading === 'comenzar'} onClick={comenzar}>Comenzar auditoría</Button>
          )}
          <Button variant="dark" icon={<Download className="h-4 w-4" />} loading={loading === 'borrador'} onClick={() => descargar(borrador, 'borrador')}>
            Word
          </Button>
          {puedeEliminar && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmarEliminar(true)} title="Eliminar auditoría (solo administrador TI)">
              Eliminar
            </Button>
          )}
          {transicionesDisponibles(a.estado, u.rol).length > 0 && (
            <div className="relative">
              <Button icon={<MoreHorizontal className="h-4 w-4" />} onClick={() => setMenuAcc((v) => !v)} aria-label="Más acciones" />
              {menuAcc && (
                <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-surface py-1 text-sm shadow-xl" onMouseLeave={() => setMenuAcc(false)}>
                  {transicionesDisponibles(a.estado, u.rol).map((t) => (
                    <button key={t.hacia + t.etiqueta} className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50" onClick={() => { setMenuAcc(false); setTrans(t); }}>
                      {t.hacia === 'anulada' ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} {t.etiqueta}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Etapas del proceso */}
      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ETAPAS.map((e, i) => {
          const idx = ETAPAS.findIndex((x) => x.key === a.estado);
          const hecho = a.estado !== 'anulada' && i < idx;
          const actual = e.key === a.estado;
          return (
            <li key={e.key} title={AYUDA_ESTADOS[e.key]} className={cn('rounded-xl border px-3 py-2 transition', actual ? 'border-brand bg-brand/10' : hecho ? 'border-zinc-200 bg-surface' : 'border-dashed border-zinc-300 bg-transparent opacity-70')}>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-900">
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', hecho ? 'bg-panel text-brand' : actual ? 'bg-brand text-ink' : 'border border-zinc-300 text-zinc-500')}>{hecho ? '✓' : i + 1}</span>
                {e.label}
              </p>
              {actual && <p className="mt-1 text-xs text-zinc-600">{AYUDA_ESTADOS[e.key]}</p>}
            </li>
          );
        })}
      </ol>
      {a.estado === 'anulada' && a.anulacion && (
        <div className="mb-4"><Alerta tipo="error">Anulada por {a.anulacion.usuarioNombre} el {fmtFechaHora(a.anulacion.fecha)}. Motivo: {a.anulacion.motivo}</Alerta></div>
      )}
      <div className="mb-4 empty:hidden"><ErrorList errores={errores} /></div>

      {['planificada', 'en_ejecucion', 'en_revision'].includes(a.estado) && (
        <div className="mb-4"><SalaAuditoria auditoria={a} lista={sala.lista} /></div>
      )}

      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Índice fijo (navegación dentro de la misma hoja) */}
        <nav className="hidden lg:block" aria-label="Secciones de la hoja">
          <ol className="sticky top-44 space-y-1 text-sm">
            {pasos.map((p, i) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-zinc-600 hover:bg-surface hover:text-zinc-900">
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', p.ok ? 'bg-panel text-brand' : 'border border-zinc-300 text-zinc-500')}>{p.ok ? '✓' : i + 1}</span>
                  {p.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-5">
          {/* 1 · DATOS */}
          <Bloque id="datos" n={1} titulo="Datos de la auditoría" extra={gestor && a.estado !== 'anulada' && a.estado !== 'cerrada' && <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditarDatos(true)}>Editar</Button>}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato label="Auditor líder"><span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-brand" /> {mapa.auditores[a.auditorLiderId]?.nombre}</span></Dato>
              <Dato label="Equipo auditor">{a.equipoIds.map((x) => mapa.auditores[x]?.nombre).filter(Boolean).join(', ') || '—'}</Dato>
              <Dato label="Auditado (jefe / encargado)">{a.auditadosTexto}</Dato>
              <Dato label="Fecha">{fmtFecha(a.fechaRealizacion ?? a.fechaPlanificada)}</Dato>
              <Dato label="Normas de referencia" ancho>{a.normas.map((n) => NORMA_VERSION[n]).join(' · ')}</Dato>
              <Dato label="Objetivos" ancho>{a.objetivos}</Dato>
              <Dato label="Alcance" ancho>{a.alcance}</Dato>
            </dl>
          </Bloque>

          <GuiaAuditoria auditoria={a} hallazgos={hs} evidencias={evid.data} />

          {/* 2 · PLAN DE AUDITORÍA */}
          <Bloque id="plan" n={2} titulo="Plan de auditoría">
            <PlanAuditoria auditoria={a} hallazgos={hs} editable={editableHallazgos} onIrHallazgo={irHallazgo} />
          </Bloque>

          {/* 3 · HALLAZGOS */}
          <Bloque
            id="hallazgos"
            n={3}
            titulo="Hallazgos"
            extra={
              <span className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5"><span className="chip-dot" style={{ background: 'var(--viz-nc)' }} /> <b>{nc}</b> NC</span>
                <span className="flex items-center gap-1.5"><span className="chip-dot" style={{ background: 'var(--viz-om)' }} /> <b>{om}</b> OM</span>
              </span>
            }
          >
            <div className="space-y-3">
              {hs.length === 0 && !nuevo && <p className="text-sm text-zinc-500">Aún no hay hallazgos registrados en esta auditoría.</p>}
              {hs.map((h) =>
                editando === h.id ? (
                  <HallazgoEditor key={h.id} auditoria={a} hallazgo={h} numero={h.correlativo} onCancel={() => setEditando(null)} onSaved={() => setEditando(null)} />
                ) : (
                  <div key={h.id} id={`hallazgo-${h.id}`} className="scroll-mt-44">
                    <HallazgoItem h={h} auditoria={a} evidencias={evid.data.filter((e) => e.hallazgoId === h.id)} editable={editableHallazgos} editandoPor={sala.editadoPorOtro((e) => e.tipo === 'hallazgo' && e.id === h.id)?.nombre ?? null} onEditar={() => { setNuevo(false); setEditando(h.id); }} />
                  </div>
                ),
              )}
              {nuevo && <HallazgoEditor auditoria={a} numero={(a.contadorHallazgos ?? 0) + 1} onCancel={() => setNuevo(false)} onSaved={() => { setNuevo(false); if (a.estado === 'planificada' && participo) void comenzarAuditoria(u, a).catch(() => undefined); }} />}
              {editableHallazgos && !nuevo && (
                <button
                  type="button"
                  onClick={() => { setEditando(null); setNuevo(true); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 transition hover:border-brand hover:bg-brand/5 hover:text-zinc-900"
                >
                  <Plus className="h-4 w-4" /> Agregar hallazgo
                </button>
              )}
              {!editableHallazgos && a.estado !== 'anulada' && (
                <p className="text-xs text-zinc-500">Con la auditoría cerrada los hallazgos no se editan; su seguimiento continúa en cada hallazgo.</p>
              )}
            </div>

            {anteriores.length > 0 && (
              <details className="mt-5 rounded-xl border border-zinc-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                  Pendientes de la auditoría anterior {mapa.auditorias[a.auditoriaAnteriorId!]?.codigo} ({anteriores.length}) — verificar eficacia
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">{anteriores.map((h) => <HallazgoCard key={h.id} h={h} />)}</div>
              </details>
            )}
          </Bloque>

          {/* 3 · NOTAS Y EVIDENCIA GENERAL */}
          <Bloque id="notas" n={4} titulo="Notas y evidencia general">
            {otroEnNotas && !notasDirty && (
              <div className="mb-2">
                <Alerta tipo="info">
                  <span className="flex flex-wrap items-center gap-2">
                    <PenLine className="h-4 w-4" /> <b>{otroEnNotas.nombre}</b> está escribiendo en las notas. Espera a que guarde para no cruzar cambios.
                    {!editarNotasIgual && <button type="button" className="ml-auto text-xs underline" onClick={() => setEditarNotasIgual(true)}>Editar igual</button>}
                  </span>
                </Alerta>
              </div>
            )}
            <Field label="Notas del informe" hint="Situaciones relevantes, conformidades destacadas o aclaraciones del auditor.">
              <Textarea
                rows={4}
                value={notas}
                disabled={a.estado === 'anulada' || (!!otroEnNotas && !notasDirty && !editarNotasIgual)}
                onFocus={() => setEnNotas(true)}
                onBlur={() => setEnNotas(false)}
                onChange={(e) => {
                  if (!notasDirty) setNotasBase(a.notas ?? '');
                  setNotas(e.target.value);
                  setNotasDirty(true);
                }}
              />
            </Field>
            {a.notasActualizadasPor && a.notasActualizadasEn && (
              <p className="mt-1 text-[11px] text-zinc-500">Última edición: <b>{a.notasActualizadasPor === u.id ? 'tú' : mapa.usuarios[a.notasActualizadasPor]?.nombre ?? 'otro usuario'}</b> · {fmtFechaHora(a.notasActualizadasEn)}</p>
            )}
            {conflicto && (
              <div className="mt-2">
                <Alerta tipo="warn">
                  <p><b>{conflicto.porUid ? mapa.usuarios[conflicto.porUid]?.nombre ?? 'Otro auditor' : 'Otro auditor'}</b> guardó cambios en las notas mientras escribías. No se sobrescribió nada. Sus notas actuales:</p>
                  <p className="my-2 whitespace-pre-line rounded bg-white/70 p-2 text-xs text-zinc-700">{conflicto.actual || '(vacías)'}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={async () => {
                      const union = `${conflicto.actual.trim()}\n\n${notas.trim()}`.trim();
                      try { await guardarMisNotas(union, conflicto.actual); setNotas(union); notify('Notas combinadas y guardadas'); } catch (e) { notify(errorMensaje(e), 'error'); }
                    }}>Combinar (agregar lo mío al final)</Button>
                    <Button size="sm" onClick={async () => { try { await guardarMisNotas(notas, null); notify('Notas reemplazadas por las tuyas'); } catch (e) { notify(errorMensaje(e), 'error'); } }}>Reemplazar con lo mío</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setNotas(conflicto.actual); setNotasDirty(false); setNotasBase(null); setConflicto(null); }}>Descartar lo mío</Button>
                  </div>
                </Alerta>
              </div>
            )}
            {notasDirty && !conflicto && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} onClick={async () => { try { await guardarMisNotas(); notify('Notas guardadas'); } catch (e) { if (!(e instanceof ConflictoNotas)) notify(errorMensaje(e), 'error'); } }}>Guardar notas</Button>
              </div>
            )}
            <div className="mt-4">
              <span className="label">Fotografías generales (no asociadas a un hallazgo)</span>
              <EvidenciasPanel auditoria={a} evidencias={evidGeneral} editable={a.estado !== 'anulada'} />
            </div>
          </Bloque>

          {/* 4 · REVISIÓN, APROBACIÓN Y CIERRE */}
          <Bloque id="cierre" n={5} titulo="Revisión, aprobación y cierre" extra={<Button size="sm" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreview(borrador)}>Vista previa</Button>}>
            {/* Control de revisiones del documento */}
            <div>
              <span className="label">Control de revisiones del documento</span>
              {revisiones.length === 0 ? (
                <p className="text-sm text-zinc-500">Aún sin revisiones: el documento no ha sido enviado al auditor líder.</p>
              ) : (
                <ol className="relative space-y-3 border-l-2 border-zinc-200 pl-5">
                  {revisiones.map((r, i) => (
                    <li key={r.id} className="relative">
                      <span className={cn('absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', TONO_REV[r.tipo])}>{i + 1}</span>
                      <p className="text-sm">
                        <b className="text-zinc-900">{ETIQUETA_REV[r.tipo]}{r.version ? ` · v${r.version}` : ''}</b>
                        <span className="ml-2 text-xs text-zinc-500">{fmtFechaHora(r.fecha)} · {r.usuarioNombre}</span>
                      </p>
                      {r.comentario && <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-600">{r.comentario}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Acción según el estado */}
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              {(a.estado === 'planificada' || a.estado === 'en_ejecucion') && participo && (
                <div className="space-y-3">
                  {ultimaRev?.tipo === 'observacion' && (
                    <Alerta tipo="warn"><b>Observaciones del auditor líder:</b> {ultimaRev.comentario}</Alerta>
                  )}
                  {resumenPlanHoja.pendiente > 0 && (
                    <Alerta tipo="info">Quedan <b>{resumenPlanHoja.pendiente}</b> punto(s) del plan sin revisar. Puedes enviar igual; en el informe aparecerán como «sin revisar».</Alerta>
                  )}
                  <Field label="Comentario para el auditor líder (opcional)">
                    <Textarea rows={2} value={comentarioRev} onChange={(e) => setComentarioRev(e.target.value)} placeholder="Ej.: se corrigieron las observaciones de redacción del hallazgo #2" />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">Revisor: <b className="text-zinc-700">{mapa.auditores[a.auditorLiderId]?.nombre}</b> (auditor líder)</span>
                    <Button variant="primary" loading={loading === 'enviar'} icon={<span className="flex items-center gap-1"><Save className="h-4 w-4" /><Send className="h-4 w-4" /></span>} onClick={enviar}>
                      Guardar y enviar a auditor líder para revisión
                    </Button>
                  </div>
                </div>
              )}

              {a.estado === 'en_revision' && (
                esRevisor ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-700">Revisa la hoja completa (o usa <b>Vista previa</b>). Luego aprueba y emite el informe, o devuélvelo con observaciones.</p>
                    <Field label="Observaciones / comentario de revisión">
                      <Textarea rows={3} value={comentarioRev} onChange={(e) => setComentarioRev(e.target.value)} placeholder="Obligatorio para devolver; opcional al aprobar" />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button icon={<Undo2 className="h-4 w-4" />} loading={loading === 'devolver'} disabled={comentarioRev.trim().length < 5} onClick={devolver}>Devolver con observaciones</Button>
                      <Button variant="primary" icon={<Stamp className="h-4 w-4" />} loading={loading === 'emitir'} onClick={aprobarYEmitir}>Aprobar y emitir informe</Button>
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-zinc-700"><Clock3 className="h-4 w-4 text-amber-500" /> En revisión por <b>{mapa.auditores[a.auditorLiderId]?.nombre}</b>{ultimaRev ? ` desde el ${fmtFechaHora(ultimaRev.fecha)}` : ''}.</p>
                )
              )}

              {a.estado === 'cerrada' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm text-zinc-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Informe aprobado y emitido (<b>v{a.informeVersion}</b>). El seguimiento de los hallazgos continúa.</p>
                  {puedeEmitir && <Button icon={<Stamp className="h-4 w-4" />} onClick={() => setEmitir(true)}>Emitir nueva versión</Button>}
                  {(() => {
                    const ncSinPlazo = hs.filter((h) => h.tipo === 'NC' && !h.anulado && !h.fechaLimite && h.estado !== 'tratada').length;
                    if (!ncSinPlazo || !esGestor(u.rol)) return null;
                    return (
                      <Alerta tipo="warn">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{ncSinPlazo} NC sin fecha límite registrada. Hoy se controlan con el plazo calculado (auditoría + {PLAZO_SEGUIMIENTO_DIAS / 7} semanas); regístrelo para que quede en el informe y en el Excel.</span>
                          <Button size="sm" icon={<Clock3 className="h-3.5 w-3.5" />} loading={loading === 'plazo'} onClick={async () => {
                            setLoading('plazo');
                            try {
                              const n = await fijarPlazoSeguimiento(u, a, true);
                              notify(`Plazo registrado para ${n} NC (auditoría + ${PLAZO_SEGUIMIENTO_DIAS} días)`);
                            } catch (e) { notify(errorMensaje(e), 'error'); } finally { setLoading(''); }
                          }}>
                            Registrar plazo: auditoría + {PLAZO_SEGUIMIENTO_DIAS} días
                          </Button>
                        </div>
                      </Alerta>
                    );
                  })()}
                </div>
              )}
              {a.estado === 'anulada' && <p className="text-sm text-zinc-500">Auditoría anulada.</p>}
            </div>

            {/* Vistos buenos complementarios */}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(['equipo', 'jefe_area'] as const).map((rol) => {
                const lista = aprob.filter((x) => x.rol === rol);
                return (
                  <div key={rol} className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{rol === 'equipo' ? 'V°B° equipo auditor' : 'V°B° jefe / encargado de área'}</p>
                    {lista.map((x) => (
                      <p key={x.nombre + x.fecha} className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {x.nombre} <span className="text-xs text-zinc-500">{fmtFecha(x.fecha.slice(0, 10))}</span></p>
                    ))}
                    {a.estado !== 'anulada' && rol === 'equipo' && soyEquipo && !lista.some((x) => x.usuarioId === u.id) && (
                      <Button size="sm" className="mt-2" onClick={() => aprobar({ rol, nombre: mapa.auditores[u.auditorId!]?.nombre ?? u.nombre, usuarioId: u.id, fecha: ahoraISO() })}>Dar V°B°</Button>
                    )}
                    {a.estado !== 'anulada' && rol === 'jefe_area' && gestor && (
                      <div className="mt-2 flex gap-2">
                        <Input value={jefe} onChange={(e) => setJefe(e.target.value)} placeholder="Nombre y cargo" />
                        <Button size="sm" disabled={jefe.trim().length < 3} onClick={() => aprobar({ rol, nombre: jefe.trim(), usuarioId: null, fecha: ahoraISO() })}>V°B°</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {informes.data.length > 0 && (
              <ul className="mt-4 divide-y divide-zinc-100 text-sm">
                {informes.data.map((inf) => (
                  <li key={inf.id} className="flex flex-wrap items-center gap-2 py-2">
                    <FileCheck2 className="h-4 w-4 text-emerald-600" />
                    <b>Informe v{inf.version}</b>
                    <span className="flex-1 text-xs text-zinc-500">{fmtFechaHora(inf.emitidoEn)} · {inf.emitidoPorNombre}{inf.comentario ? ` · ${inf.comentario}` : ''}</span>
                    <Button size="sm" icon={<Eye className="h-3 w-3" />} onClick={() => setPreview(inf.snapshot)}>Ver</Button>
                    <Button size="sm" icon={<Download className="h-3 w-3" />} loading={loading === inf.id} onClick={() => descargar(inf.snapshot, inf.id)}>.docx</Button>
                  </li>
                ))}
              </ul>
            )}
          </Bloque>

          {/* Bitácora (colapsada) */}
          <details className="rounded-2xl border border-zinc-200 bg-surface p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-700">
              <History className="h-4 w-4" /> Bitácora de cambios ({bitacora.data.length})
            </summary>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {bitacora.data.map((b) => (
                <li key={b.id} className="border-l-2 border-brand pl-3 text-sm">
                  <span className="text-xs text-zinc-500">{fmtFechaHora(b.fecha)} · {b.usuarioNombre}</span>
                  <p className="text-zinc-800">{b.detalle}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <AuditoriaFormModal open={editarDatos} onClose={() => setEditarDatos(false)} auditoria={a} />
      <MotivoModal open={!!trans} titulo={trans?.etiqueta ?? ''} descripcion={trans?.hacia === 'anulada' ? 'La auditoría conserva su número pero queda anulada.' : 'La auditoría vuelve a revisión y podrá emitirse una nueva versión del informe.'} onClose={() => setTrans(null)} onConfirm={(m) => ejecutar(trans!, m)} />

      <EliminarAuditoriaModal auditoria={a} open={confirmarEliminar} onClose={() => setConfirmarEliminar(false)} onEliminada={() => nav('/auditorias')} nHallazgos={hs.length} />

      <Modal open={!!preview} onClose={() => setPreview(null)} size="xl" title="Vista previa del informe">
        {preview && <VistaInforme s={preview} />}
      </Modal>

      <Modal
        open={emitir}
        onClose={() => setEmitir(false)}
        title="Emitir informe"
        footer={
          <>
            <Button onClick={() => setEmitir(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={loading === 'emitir'}
              onClick={async () => {
                setLoading('emitir');
                try {
                  await guardarNotasSiCambio();
                  const v = await emitirInforme(u, a, borrador, comentario.trim());
                  notify(`Informe v${v} emitido`);
                  setEmitir(false);
                  setComentario('');
                } catch (e) {
                  notify(errorMensaje(e), 'error');
                } finally {
                  setLoading('');
                }
              }}
            >
              Emitir
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>Se congelará una copia inmutable del informe con los datos actuales.{a.estado === 'en_revision' && ' La auditoría quedará Cerrada.'}</p>
          {!aprob.some((x) => x.rol === 'auditor_lider') && <Alerta tipo="warn">Aún no hay aprobación del auditor líder.</Alerta>}
          <Field label="Comentario de la versión (opcional)">
            <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ej.: incorpora verificación de eficacia" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
