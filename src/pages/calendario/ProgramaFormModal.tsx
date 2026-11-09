import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Save, X } from 'lucide-react';
import { Alerta, Button, ErrorList, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { fmtFecha } from '../../lib/dates';
import { guardarPrograma, validarPrograma, type ProgramaForm } from '../../services/programa';
import type { ProgramaItem, TipoProgramado } from '../../types';
import { Segmentado } from '../../components/shared/Filtros';
import { TIPO_PROGRAMA, tipoDe } from '../../domain/programa';
import { cuposEficacia, reglaEficacia } from '../../domain/eficacia';
import { hoyISO } from '../../lib/dates';

const VACIO: ProgramaForm = { tipo: 'auditoria', sucursalId: '', areaId: '', fecha: '', auditorLiderId: '', equipoIds: [], notas: '' };

/** Programar (o reprogramar) la auditoría de un área: fecha, auditor líder y equipo. */
export function ProgramaFormModal({ open, onClose, item, inicial }: { open: boolean; onClose: () => void; item?: ProgramaItem | null; inicial?: Partial<ProgramaForm> }) {
  const u = useUsuario();
  const notify = useToast();
  const { sucursales, areas, auditores, programa, mapa } = useData();
  const [f, setF] = useState<ProgramaForm>(VACIO);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIntento(false);
    setF(item ? { tipo: tipoDe(item), sucursalId: item.sucursalId, areaId: item.areaId, fecha: item.fecha, auditorLiderId: item.auditorLiderId, equipoIds: item.equipoIds, notas: item.notas } : { ...VACIO, ...(inicial ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, JSON.stringify(inicial ?? null)]);

  const set = <K extends keyof ProgramaForm>(k: K, v: ProgramaForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const areasSuc = areas.filter((a) => a.activo && (!f.sucursalId || !a.sucursalId || a.sucursalId === f.sucursalId));
  const activos = auditores.filter((a) => a.activo);
  const anio = f.fecha ? Number(f.fecha.slice(0, 4)) : null;
  const regla = f.tipo === 'eficacia' ? reglaEficacia(f.fecha, programa, item?.id) : { errores: [], avisos: [] };
  const errores = [...validarPrograma(f), ...regla.errores];
  const sugeridas = f.tipo === 'eficacia' ? cuposEficacia(anio ?? new Date().getFullYear(), programa.filter((p) => p.id !== item?.id), hoyISO()).slice(0, 4) : [];

  const avisos = useMemo(() => {
    const w: string[] = [];
    const dup = programa.filter((p) => !p.cancelado && p.id !== item?.id && p.areaId === f.areaId && p.anio === anio && tipoDe(p) === f.tipo);
    if (f.areaId && dup.length) w.push(`El área ya tiene ${dup.length} ${TIPO_PROGRAMA[f.tipo].label.toLowerCase()}(es) programado(s) en ${anio}: ${dup.map((p) => fmtFecha(p.fecha)).join(', ')}.`);
    const conflicto = [f.auditorLiderId, ...f.equipoIds].map((id) => mapa.auditores[id]).filter((a) => a && a.areaOrigenId && a.areaOrigenId === f.areaId);
    if (conflicto.length) w.push(`Independencia (ISO 19011): ${conflicto.map((a) => a.nombre).join(', ')} pertenece al área auditada.`);
    const mismoDia = programa.filter((p) => !p.cancelado && p.id !== item?.id && p.fecha === f.fecha && [p.auditorLiderId, ...p.equipoIds].some((x) => x && [f.auditorLiderId, ...f.equipoIds].includes(x)));
    w.push(...regla.avisos);
    if (f.fecha && mismoDia.length && f.tipo !== 'eficacia') w.push(`Ese día el equipo ya tiene otra actividad programada (${mismoDia.map((p) => mapa.areas[p.areaId]?.nombre).join(', ')}).`);
    return w;
  }, [programa, item?.id, f, anio, mapa, regla.avisos.join('|')]);

  const guardar = async () => {
    setIntento(true);
    if (errores.length) return;
    setGuardando(true);
    try {
      await guardarPrograma(u, f, item ?? undefined);
      notify(item ? 'Programación actualizada' : `${TIPO_PROGRAMA[f.tipo].label} programada`);
      onClose();
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Reprogramar actividad' : 'Programar actividad'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={item ? <Save className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />} loading={guardando} onClick={guardar}>{item ? 'Guardar cambios' : 'Programar'}</Button></>}
    >
      <div className="space-y-4">
        {intento && errores.length > 0 && <ErrorList errores={errores} />}
        <div>
          <span className="label">Tipo de actividad</span>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Segmentado
              etiqueta="Tipo de actividad"
              valor={f.tipo}
              onChange={(v: TipoProgramado) => set('tipo', v)}
              opciones={(Object.keys(TIPO_PROGRAMA) as TipoProgramado[]).map((k) => ({ v: k, label: TIPO_PROGRAMA[k].label }))}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">{TIPO_PROGRAMA[f.tipo].descripcion}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sucursal">
            <Select value={f.sucursalId} onChange={(e) => setF((p) => ({ ...p, sucursalId: e.target.value, areaId: mapa.areas[p.areaId]?.sucursalId && mapa.areas[p.areaId]?.sucursalId !== e.target.value ? '' : p.areaId }))} placeholder="Seleccione…" options={sucursales.filter((s) => s.activo).map((s) => ({ value: s.id, label: s.nombre }))} />
          </Field>
          <Field label="Área a auditar">
            <Select value={f.areaId} onChange={(e) => set('areaId', e.target.value)} placeholder="Seleccione…" options={areasSuc.map((a) => ({ value: a.id, label: a.nombre }))} />
          </Field>
          <Field label="Fecha programada">
            <Input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
          </Field>
          <Field label="Auditor líder">
            <Select value={f.auditorLiderId} onChange={(e) => setF((p) => ({ ...p, auditorLiderId: e.target.value, equipoIds: p.equipoIds.filter((x) => x !== e.target.value) }))} placeholder="Seleccione…" options={activos.map((a) => ({ value: a.id, label: a.nombre }))} />
          </Field>
        </div>
        <Field label="Equipo auditor" hint="Quienes auditan en terreno. Recibirán el aviso en su campana.">
          <div className="space-y-2">
            <Select value="" onChange={(e) => e.target.value && set('equipoIds', [...f.equipoIds, e.target.value])} placeholder="Agregar auditor…" options={activos.filter((a) => a.id !== f.auditorLiderId && !f.equipoIds.includes(a.id)).map((a) => ({ value: a.id, label: a.nombre }))} />
            {f.equipoIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {f.equipoIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-sm text-zinc-800">
                    {mapa.auditores[id]?.nombre ?? '—'}
                    <button type="button" onClick={() => set('equipoIds', f.equipoIds.filter((x) => x !== id))} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-zinc-200" aria-label={`Quitar a ${mapa.auditores[id]?.nombre ?? 'auditor'}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="Notas (opcional)">
          <Textarea rows={2} value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Ej.: foco en controles operacionales de SST; coordinar con jefatura." />
        </Field>
        {f.tipo === 'eficacia' && (
          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600">
            <b>Regla de eficacia:</b> noviembre–diciembre, solo lunes y jueves, máximo 2 por semana y 1 por día.
            {sugeridas.length > 0 && (
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                Próximos cupos libres:
                {sugeridas.map((d) => (
                  <button key={d} type="button" onClick={() => set('fecha', d)} className={`rounded-full border px-2 py-0.5 font-semibold ${f.fecha === d ? 'border-ink bg-ink text-white' : 'border-zinc-300 hover:border-zinc-500'}`}>{fmtFecha(d)}</button>
                ))}
              </span>
            )}
          </div>
        )}
        {avisos.map((w) => (
          <Alerta key={w} tipo="warn"><span className="inline-flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}</span></Alerta>
        ))}
      </div>
    </Modal>
  );
}
