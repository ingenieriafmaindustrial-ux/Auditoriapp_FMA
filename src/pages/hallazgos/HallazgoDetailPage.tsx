import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Ban, Camera, CheckCheck, FileSearch, History, Pencil, RotateCcw, Wrench } from 'lucide-react';
import { BotonVolver } from '../../components/shared/BotonVolver';
import { Alerta, Badge, Button, EmptyState, Spinner } from '../../components/ui';
import { EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from '../../components/shared/Badges';
import { MotivoModal } from '../../components/shared/MotivoModal';
import { EvidenciasPanel } from '../../components/shared/EvidenciasPanel';
import { etiquetaRequisito } from '../../components/shared/RequisitoPicker';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBitacora, useEvidencias } from '../../hooks/useAuditoriaData';
import { fmtFecha, fmtFechaHora } from '../../lib/dates';
import { errorMensaje } from '../../lib/utils';
import { PLAZO_SEGUIMIENTO_DIAS, TIPOS_HALLAZGO } from '../../lib/constants';
import { plazoEfectivo } from '../../domain/hallazgoReglas';
import { hallazgoDescripcionEditable, seguimientoEditable } from '../../domain/auditoriaReglas';
import { esGestor, esLider } from '../../domain/permisos';
import { anularHallazgo, reactivarSeguimiento } from '../../services/hallazgos';
import { HallazgoFormModal } from './HallazgoFormModal';
import TratamientoTab from './tabs/TratamientoTab';
import EficaciaTab from './tabs/EficaciaTab';

function Seccion({ n, titulo, icon, children }: { n: number; titulo: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-surface shadow-sm">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel font-[family-name:var(--font-display)] text-sm font-bold text-brand">{n}</span>
        <h2 className="flex flex-1 items-center gap-2 text-lg font-bold uppercase tracking-wide text-zinc-900">{icon} {titulo}</h2>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Timeline({ pasos }: { pasos: { label: string; fecha: string | null; ok: boolean }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {pasos.map((p, i) => (
        <li key={p.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <span className={'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ' + (p.ok ? 'bg-panel text-brand' : 'bg-zinc-200 text-zinc-500')}>{i + 1}</span>
            <span className="text-xs leading-tight">
              <b className="block">{p.label}</b>
              <span className="text-zinc-500">{p.fecha ? fmtFecha(p.fecha) : 'pendiente'}</span>
            </span>
          </div>
          {i < pasos.length - 1 && <span className={'mx-3 h-0.5 w-8 ' + (p.ok ? 'bg-panel' : 'bg-zinc-200')} />}
        </li>
      ))}
    </ol>
  );
}

export default function HallazgoDetailPage() {
  const { id = '' } = useParams();
  const u = useUsuario();
  const notify = useToast();
  const { hallazgos, mapa, cargando } = useData();
  const h = hallazgos.find((x) => x.id === id);
  const a = h ? mapa.auditorias[h.auditoriaId] : undefined;
  const evid = useEvidencias(h?.auditoriaId ?? '_');
  const bit = useBitacora(h?.auditoriaId ?? '_');
  const [editar, setEditar] = useState(false);
  const [anular, setAnular] = useState(false);
  const [reactivando, setReactivando] = useState(false);

  if (cargando) return <Spinner />;
  if (!h || !a) return <EmptyState title="Hallazgo no encontrado">Puede que no tengas acceso o que no exista.</EmptyState>;

  const evidH = evid.data.filter((e) => e.hallazgoId === h.id || (h.checklistItemId && e.checklistItemId === h.checklistItemId));
  const editDesc = hallazgoDescripcionEditable(a.estado) && !h.anulado;
  const editSeg = seguimientoEditable(a.estado) && !h.anulado;
  const ultVer = [...h.verificaciones].sort((x, y) => (x.creadoEn < y.creadoEn ? 1 : -1))[0];
  const primeraImpl = h.acciones.map((x) => x.fechaImplementacion).filter(Boolean).sort()[0] ?? null;
  const ic = 'h-4 w-4';

  return (
    <div>
      <BotonVolver to={`/auditorias/${a.id}#hallazgos`} destino={`Auditoría ${a.codigo}`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Hallazgo {a.codigo} #{h.correlativo}</h1>
        <TipoBadge tipo={h.tipo} />
        <NivelBadge nivel={h.nivel} />
        <EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} />
        <PlazoBadge h={h} />
        {h.historico && <Badge className="bg-violet-100 text-violet-800">Histórico</Badge>}
      </div>

      {h.historico && !h.anulado && (
        <div className="mb-4">
          <Alerta tipo="info">
            <span className="flex flex-wrap items-center gap-3">
              <span>Hallazgo histórico importado de un informe anterior, sin seguimiento: figura como tratado y no genera alertas.{h.tipoInferido ? ' El tipo (NC/OM) se dedujo del informe; conviene revisarlo.' : ''}</span>
              {esGestor(u.rol) && (
                <Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={reactivando} onClick={async () => { setReactivando(true); try { await reactivarSeguimiento(u, h); notify('Seguimiento reactivado'); } catch (e) { notify(errorMensaje(e), 'error'); } finally { setReactivando(false); } }}>Reactivar seguimiento</Button>
              )}
            </span>
          </Alerta>
        </div>
      )}

      {h.anulado && h.anulacion && <div className="mb-4"><Alerta tipo="error">Anulado por {h.anulacion.usuarioNombre} ({fmtFechaHora(h.anulacion.fecha)}): {h.anulacion.motivo}</Alerta></div>}

      {/* Hoja única de seguimiento: todo en secuencia, sin pestañas */}
      <div className="space-y-5">
        <Seccion n={1} titulo="Hallazgo" icon={<FileSearch className={ic} />}>
          <div className="space-y-4">
            <Timeline
              pasos={[
                { label: 'Detección', fecha: h.fechaDeteccion, ok: true },
                { label: 'Implementación', fecha: primeraImpl, ok: !!primeraImpl },
                { label: 'Verificación', fecha: ultVer?.fecha ?? null, ok: h.estado === 'tratada' },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="label">Descripción</span>
                <p className="whitespace-pre-line text-sm">{h.descripcion}</p>
              </div>
              <div>
                <span className="label">Tipo</span>
                <p className="text-sm">{TIPOS_HALLAZGO[h.tipo]}</p>
              </div>
              <div>
                <span className="label">Requisitos</span>
                <ul className="text-sm">{h.requisitoIds.map((rid) => mapa.requisitos[rid]).filter(Boolean).map((r) => <li key={r.id}>{etiquetaRequisito(r)}</li>)}</ul>
              </div>
              <div>
                <span className="label">Área / sucursal</span>
                <p className="text-sm">{mapa.areas[h.areaId]?.nombre} · {mapa.sucursales[h.sucursalId]?.nombre}</p>
              </div>
              <div>
                <span className="label">Auditor responsable</span>
                <p className="text-sm">{h.auditorResponsableId ? mapa.auditores[h.auditorResponsableId]?.nombre : '—'}</p>
              </div>
              <div>
                <span className="label">Fecha detección</span>
                <p className="text-sm">{fmtFecha(h.fechaDeteccion)}</p>
              </div>
              <div>
                <span className="label">Fecha límite</span>
                <p className="text-sm">{h.tipo === 'OM' ? 'No aplica' : fmtFecha(plazoEfectivo(h))}{h.tipo === 'NC' && !h.fechaLimite && <span className="block text-[11px] text-zinc-500">Auditoría + {PLAZO_SEGUIMIENTO_DIAS / 7} semanas</span>}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {editDesc && <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditar(true)}>Editar</Button>}
              {esLider(u.rol) && !h.anulado && <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setAnular(true)}>Anular</Button>}
            </div>
            {!editDesc && !h.anulado && <p className="text-xs text-zinc-500">La descripción queda bloqueada con la auditoría cerrada; el seguimiento continúa (RN-09).</p>}
          </div>
        </Seccion>

        <Seccion n={2} titulo={h.tipo === 'NC' ? 'Tratamiento del área' : 'Mejora propuesta por el área'} icon={<Wrench className={ic} />}>
          <TratamientoTab h={h} editable={editSeg} />
        </Seccion>

        <Seccion n={3} titulo="Verificación de eficacia" icon={<CheckCheck className={ic} />}>
          <EficaciaTab h={h} editable={editSeg} />
        </Seccion>

        <Seccion n={4} titulo={`Evidencias (${evidH.length})`} icon={<Camera className={ic} />}>
          <EvidenciasPanel auditoria={a} evidencias={evidH} hallazgoId={h.id} editable={editSeg} />
        </Seccion>

        <details className="rounded-2xl border border-zinc-200 bg-surface p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-700"><History className={ic} /> Historial de cambios</summary>
          <ul className="mt-3 space-y-2">
            {bit.data.filter((b) => b.entidadId === h.id).map((b) => (
              <li key={b.id} className="border-l-2 border-brand pl-3 text-sm">
                <span className="text-xs text-zinc-500">{fmtFechaHora(b.fecha)} · {b.usuarioNombre}</span>
                <p>{b.detalle}</p>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <HallazgoFormModal open={editar} onClose={() => setEditar(false)} auditoria={a} hallazgo={h} />
      <MotivoModal
        open={anular}
        titulo="Anular hallazgo"
        descripcion="El hallazgo no se borra: queda anulado y fuera de las estadísticas."
        onClose={() => setAnular(false)}
        onConfirm={async (m) => {
          try {
            await anularHallazgo(u, h.id, m);
            notify('Hallazgo anulado');
            setAnular(false);
          } catch (e) {
            notify(errorMensaje(e), 'error');
          }
        }}
      />
    </div>
  );
}
