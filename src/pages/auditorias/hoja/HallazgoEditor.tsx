import { useCallback, useRef, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button, ErrorList, Field, Input, Select, Textarea } from '../../../components/ui';
import { RequisitoPicker } from '../../../components/shared/RequisitoPicker';
import { EscalaImpacto } from '../../../components/shared/EscalaImpacto';
import { AsistenteNormas } from '../../../components/shared/AsistenteNormas';
import { registrarAprendizaje } from '../../../services/aprendizaje';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { NIVELES, PLAZO_SEGUIMIENTO_DIAS, TIPOS_HALLAZGO } from '../../../lib/constants';
import { fmtFecha, hoyISO, sumarDias } from '../../../lib/dates';
import { cn, errorMensaje } from '../../../lib/utils';
import { validarHallazgoBase } from '../../../domain/hallazgoReglas';
import { actualizarDatosHallazgo, crearHallazgo, type HallazgoForm } from '../../../services/hallazgos';
import type { Auditoria, Hallazgo, TipoHallazgo } from '../../../types';

const colorNivel = { BAJA: 'border-emerald-600 bg-emerald-600 text-white', MEDIA: 'border-amber-500 bg-amber-400 text-ink', ALTA: 'border-red-600 bg-red-600 text-white' } as const;

/** Formulario de hallazgo en línea (dentro de la hoja de auditoría, sin ventanas emergentes). */
export function HallazgoEditor({ auditoria, hallazgo, numero, onCancel, onSaved, prefill, puntoTitulo }: {
  auditoria: Auditoria;
  hallazgo?: Hallazgo;
  /** Datos iniciales al levantar un hallazgo desde un punto del plan. */
  prefill?: Partial<HallazgoForm>;
  puntoTitulo?: string;
  numero: number;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const u = useUsuario();
  const notify = useToast();
  const { auditores, mapa } = useData();
  const [f, setF] = useState<HallazgoForm>(() =>
    hallazgo
      ? { tipo: hallazgo.tipo, requisitoIds: hallazgo.requisitoIds, descripcion: hallazgo.descripcion, nivel: hallazgo.nivel, fechaDeteccion: hallazgo.fechaDeteccion, fechaLimite: hallazgo.fechaLimite, auditorResponsableId: hallazgo.auditorResponsableId, checklistItemId: hallazgo.checklistItemId }
      : { tipo: 'NC', requisitoIds: [], descripcion: '', nivel: 'MEDIA', fechaDeteccion: auditoria.fechaRealizacion ?? hoyISO(), fechaLimite: null, auditorResponsableId: u.auditorId, checklistItemId: null, ...prefill },
  );
  const [errores, setErrores] = useState<string[]>([]);
  /** Versión del hallazgo al abrir el editor (detecta cambios de otro auditor al guardar). */
  const [baseEdicion] = useState(() => hallazgo?.actualizadoEn);
  const [loading, setLoading] = useState(false);
  const [reincidente, setReincidente] = useState(false);
  const sugeridas = useRef<string[]>([]);
  const onSugeridas = useCallback((c: string[]) => { sugeridas.current = c; }, []);
  /** Enseña al asistente (no bloquea el guardado). */
  const aprender = (id: string) =>
    registrarAprendizaje(
      u,
      { hallazgoId: id, auditoriaId: auditoria.id, descripcion: f.descripcion, tipo: f.tipo, requisitoIds: f.requisitoIds, anio: auditoria.anio, area: mapa.areas[auditoria.areaId]?.nombre ?? '', sucursal: mapa.sucursales[auditoria.sucursalId]?.nombre ?? '', sugeridas: sugeridas.current },
      mapa.requisitos,
    ).catch((e) => console.warn('[aprendizaje]', e));
  const set = <K extends keyof HallazgoForm>(k: K, v: HallazgoForm[K]) => setF((p) => ({ ...p, [k]: v }));

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
        notify(`Hallazgo #${hallazgo.correlativo} actualizado`);
        onSaved(hallazgo.id);
      } else {
        const id = await crearHallazgo(u, auditoria, f, mapa.requisitos);
        aprender(id);
        notify('Hallazgo agregado');
        onSaved(id);
      }
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-xl border-2 border-brand/70 bg-surface p-4 shadow-[0_0_0_4px_rgb(245_196_0/0.12)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-panel px-2 py-0.5 font-[family-name:var(--font-display)] text-sm font-bold text-brand">#{numero}</span>
        <b className="text-sm uppercase tracking-wide text-zinc-700">{hallazgo ? 'Editar hallazgo' : 'Nuevo hallazgo'}</b>
      {puntoTitulo && <span className="min-w-0 truncate rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700" title={puntoTitulo}>Plan: {puntoTitulo}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TIPOS_HALLAZGO) as TipoHallazgo[]).map((t) => (
              <button key={t} type="button" onClick={() => setF((p) => ({ ...p, tipo: t, fechaLimite: t === 'OM' ? null : p.fechaLimite }))} className={cn('rounded-lg border-2 px-3 py-2 text-sm font-semibold transition', f.tipo === t ? (t === 'NC' ? 'border-red-600 bg-red-50 text-red-800' : 'border-sky-600 bg-sky-50 text-sky-800') : 'border-zinc-200 text-zinc-500 hover:border-zinc-400')}>
                {t} · {TIPOS_HALLAZGO[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Nivel de impacto">
          <div className="grid grid-cols-3 gap-2">
            {NIVELES.map((n) => (
              <button key={n} type="button" onClick={() => set('nivel', n)} className={cn('rounded-lg border px-2 py-2 text-xs font-bold transition', f.nivel === n ? colorNivel[n] : 'border-zinc-200 text-zinc-500 hover:border-zinc-400')}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Descripción del hallazgo" className="md:col-span-2" hint="Requisito + evidencia objetiva + incumplimiento u oportunidad detectada.">
          <Textarea rows={f.descripcion.includes('\n') ? 9 : 4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} autoFocus />
        </Field>
        <div className="md:col-span-2 -mt-1">
          <AsistenteNormas
            texto={f.descripcion}
            auditoria={auditoria}
            hallazgoId={hallazgo?.id}
            onSugeridas={onSugeridas}
            onRedaccion={(t) => set('descripcion', t)}
            requisitoIds={f.requisitoIds}
            tipoActual={f.tipo}
            onAgregar={(ids) => set('requisitoIds', ids)}
            onTipo={(t) => setF((p) => ({ ...p, tipo: t, fechaLimite: t === 'OM' ? null : p.fechaLimite }))}
            onReincidencia={setReincidente}
          />
        </div>
        <div className="md:col-span-2 -mt-1">
          <EscalaImpacto texto={f.descripcion} tipo={f.tipo} nivel={f.nivel} reincidente={reincidente} onNivel={(n) => set('nivel', n)} />
        </div>
        <Field label={f.tipo === 'NC' ? 'Requisito / norma' : 'Requisito / norma (opcional)'} className="md:col-span-2" hint={f.tipo === 'OM' ? 'Una oportunidad de mejora no siempre se asocia a un requisito de la norma.' : undefined}>
          <RequisitoPicker value={f.requisitoIds} onChange={(v) => set('requisitoIds', v)} normas={auditoria.normas} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
          <Field label="Fecha de detección">
            <Input type="date" value={f.fechaDeteccion} onChange={(e) => set('fechaDeteccion', e.target.value)} />
          </Field>
          {f.tipo === 'NC' ? (
            <Field label="Fecha límite de seguimiento" hint={`Por defecto: ${PLAZO_SEGUIMIENTO_DIAS / 7} semanas desde la detección (${f.fechaDeteccion ? fmtFecha(sumarDias(f.fechaDeteccion, PLAZO_SEGUIMIENTO_DIAS)) : '—'}). Déjela vacía para usar ese plazo.`}>
              <Input type="date" value={f.fechaLimite ?? ''} onChange={(e) => set('fechaLimite', e.target.value || null)} />
            </Field>
          ) : (
            <Field label="Plazo">
              <p className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500">Sin plazo: el encargado del área decide si la ejecuta.</p>
            </Field>
          )}
          <Field label="Auditor que lo detectó">
            <Select value={f.auditorResponsableId ?? ''} onChange={(e) => set('auditorResponsableId', e.target.value || null)} placeholder="—" options={auditores.filter((x) => auditoria.participantes.includes(x.id)).map((x) => ({ value: x.id, label: x.nombre }))} />
          </Field>
        </div>
      </div>

      <div className="mt-3"><ErrorList errores={errores} /></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {!hallazgo && <span className="text-xs text-zinc-500">Las fotos de evidencia se agregan después de guardar.</span>}
        <div className="ml-auto flex gap-2">
          <Button onClick={onCancel} icon={<X className="h-4 w-4" />}>Cancelar</Button>
          <Button variant="primary" loading={loading} onClick={guardar} icon={<Save className="h-4 w-4" />}>
            {hallazgo ? 'Guardar cambios' : 'Guardar hallazgo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
