import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, ErrorList, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { RequisitoPicker } from '../../components/shared/RequisitoPicker';
import { EscalaImpacto } from '../../components/shared/EscalaImpacto';
import { AsistenteNormas } from '../../components/shared/AsistenteNormas';
import { registrarAprendizaje } from '../../services/aprendizaje';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { NIVELES, PLAZO_SEGUIMIENTO_DIAS, TIPOS_HALLAZGO } from '../../lib/constants';
import { fmtFecha, hoyISO, sumarDias } from '../../lib/dates';
import { cn, errorMensaje } from '../../lib/utils';
import { validarHallazgoBase } from '../../domain/hallazgoReglas';
import { actualizarDatosHallazgo, crearHallazgo, type HallazgoForm } from '../../services/hallazgos';
import type { Auditoria, Hallazgo, Nivel, TipoHallazgo } from '../../types';

export type HallazgoPrefill = Partial<Pick<HallazgoForm, 'tipo' | 'requisitoIds' | 'descripcion' | 'checklistItemId'>>;

export function HallazgoFormModal({ open, onClose, auditoria, hallazgo, prefill, onCreado }: {
  open: boolean;
  onClose: () => void;
  auditoria: Auditoria;
  hallazgo?: Hallazgo;
  prefill?: HallazgoPrefill;
  onCreado?: (id: string) => void;
}) {
  const u = useUsuario();
  const notify = useToast();
  const { auditores, mapa } = useData();
  const [f, setF] = useState<HallazgoForm>({ tipo: 'NC', requisitoIds: [], descripcion: '', nivel: 'MEDIA', fechaDeteccion: hoyISO(), fechaLimite: null, auditorResponsableId: u.auditorId, checklistItemId: null });
  const [errores, setErrores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseEdicion, setBaseEdicion] = useState<string | undefined>(undefined);

  // Se carga al abrir (no en cada cambio en vivo: así no se borra lo que el usuario está escribiendo)
  useEffect(() => {
    if (!open) return;
    setErrores([]);
    setBaseEdicion(hallazgo?.actualizadoEn);
    if (hallazgo) {
      const { tipo, requisitoIds, descripcion, nivel, fechaDeteccion, fechaLimite, auditorResponsableId, checklistItemId } = hallazgo;
      setF({ tipo, requisitoIds, descripcion, nivel, fechaDeteccion, fechaLimite, auditorResponsableId, checklistItemId });
    } else {
      setF({ tipo: 'NC', requisitoIds: [], descripcion: '', nivel: 'MEDIA', fechaDeteccion: hoyISO(), fechaLimite: null, auditorResponsableId: u.auditorId, checklistItemId: null, ...prefill });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hallazgo?.id]);

  const set = <K extends keyof HallazgoForm>(k: K, v: HallazgoForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const [reincidente, setReincidente] = useState(false);
  const sugeridas = useRef<string[]>([]);
  const onSugeridas = useCallback((c: string[]) => { sugeridas.current = c; }, []);
  const aprender = (id: string) =>
    registrarAprendizaje(
      u,
      { hallazgoId: id, auditoriaId: auditoria.id, descripcion: f.descripcion, tipo: f.tipo, requisitoIds: f.requisitoIds, anio: auditoria.anio, area: mapa.areas[auditoria.areaId]?.nombre ?? '', sucursal: mapa.sucursales[auditoria.sucursalId]?.nombre ?? '', sugeridas: sugeridas.current },
      mapa.requisitos,
    ).catch((e) => console.warn('[aprendizaje]', e));

  async function guardar() {
    const e = validarHallazgoBase(f);
    setErrores(e);
    if (e.length) return;
    setLoading(true);
    try {
      if (hallazgo) {
        const { checklistItemId: _c, ...datos } = f;
        void _c;
        await actualizarDatosHallazgo(u, hallazgo.id, datos, mapa.requisitos, baseEdicion);
        aprender(hallazgo.id);
        notify('Hallazgo actualizado');
      } else {
        const id = await crearHallazgo(u, auditoria, f, mapa.requisitos);
        aprender(id);
        notify('Hallazgo creado');
        onCreado?.(id);
      }
      onClose();
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={hallazgo ? `Editar hallazgo #${hallazgo.correlativo}` : `Nuevo hallazgo · ${auditoria.codigo}`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Save className="h-4 w-4" />} loading={loading} onClick={guardar}>{hallazgo ? 'Guardar' : 'Crear hallazgo'}</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TIPOS_HALLAZGO) as TipoHallazgo[]).map((t) => (
              <button key={t} type="button" onClick={() => setF((p) => ({ ...p, tipo: t, fechaLimite: t === 'OM' ? null : p.fechaLimite }))} className={cn('rounded-lg border-2 px-3 py-2 text-sm font-semibold', f.tipo === t ? (t === 'NC' ? 'border-red-600 bg-red-50 text-red-800' : 'border-sky-600 bg-sky-50 text-sky-800') : 'border-zinc-200 text-zinc-500')}>
                {t} · {TIPOS_HALLAZGO[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Requisito / norma" className="sm:col-span-2">
          <RequisitoPicker value={f.requisitoIds} onChange={(v) => set('requisitoIds', v)} normas={auditoria.normas} />
        </Field>
        <Field label="Descripción del hallazgo" className="sm:col-span-2" hint="Redacte: requisito + evidencia objetiva + incumplimiento/oportunidad.">
          <Textarea rows={f.descripcion.includes('\n') ? 9 : 5} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <AsistenteNormas texto={f.descripcion} auditoria={auditoria} hallazgoId={hallazgo?.id} onSugeridas={onSugeridas} onRedaccion={(t) => set('descripcion', t)} requisitoIds={f.requisitoIds} tipoActual={f.tipo} onAgregar={(ids) => set('requisitoIds', ids)} onTipo={(t) => setF((p) => ({ ...p, tipo: t, fechaLimite: t === 'OM' ? null : p.fechaLimite }))} onReincidencia={setReincidente} />
          <div className="mt-2"><EscalaImpacto texto={f.descripcion} tipo={f.tipo} nivel={f.nivel} reincidente={reincidente} onNivel={(n) => set('nivel', n)} /></div>
        </div>
        <Field label="Nivel (impacto / importancia)">
          <div className="grid grid-cols-3 gap-1.5">
            {NIVELES.map((n: Nivel) => (
              <button key={n} type="button" onClick={() => set('nivel', n)} className={cn('rounded-md border px-2 py-2 text-xs font-bold', f.nivel === n ? { BAJA: 'border-emerald-600 bg-emerald-600 text-white', MEDIA: 'border-amber-500 bg-amber-400 text-ink', ALTA: 'border-red-600 bg-red-600 text-white' }[n] : 'border-zinc-200 text-zinc-500')}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Auditor responsable">
          <Select value={f.auditorResponsableId ?? ''} onChange={(e) => set('auditorResponsableId', e.target.value || null)} placeholder="—" options={auditores.filter((x) => auditoria.participantes.includes(x.id)).map((x) => ({ value: x.id, label: x.nombre }))} />
        </Field>
        <Field label="Fecha de detección">
          <Input type="date" value={f.fechaDeteccion} onChange={(e) => set('fechaDeteccion', e.target.value)} />
        </Field>
        {f.tipo === 'NC' && (
          <Field label="Fecha límite de seguimiento" hint={`Por defecto: ${PLAZO_SEGUIMIENTO_DIAS / 7} semanas desde la detección (${f.fechaDeteccion ? fmtFecha(sumarDias(f.fechaDeteccion, PLAZO_SEGUIMIENTO_DIAS)) : '—'}). Déjela vacía para usar ese plazo.`}>
            <Input type="date" value={f.fechaLimite ?? ''} onChange={(e) => set('fechaLimite', e.target.value || null)} />
          </Field>
        )}
      </div>
      <div className="mt-4">
        <ErrorList errores={errores} />
      </div>
    </Modal>
  );
}
