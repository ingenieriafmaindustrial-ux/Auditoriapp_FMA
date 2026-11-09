import { useEffect, useMemo, useState } from 'react';
import { Crown, Lock, Save } from 'lucide-react';
import { Alerta, Button, CheckboxGroup, ErrorList, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ALCANCE_POR_DEFECTO, AUDITOR_LIDER_NOMBRE, NORMAS, OBJETIVO_POR_DEFECTO } from '../../lib/constants';
import { aniosDisponibles, anioActual, hoyISO } from '../../lib/dates';
import { cn, errorMensaje, normalizar } from '../../lib/utils';
import { conflictosIndependencia, validarAuditoria, type AuditoriaForm } from '../../domain/auditoriaReglas';
import { esLider } from '../../domain/permisos';
import { actualizarAuditoria, crearAuditoria } from '../../services/auditorias';
import { construirPlanAuditoria } from '../../domain/plan';
import type { Auditoria, Norma } from '../../types';

const vacio = (anio = anioActual()): AuditoriaForm => ({
  anio,
  sucursalId: '',
  areaId: '',
  objetivos: OBJETIVO_POR_DEFECTO,
  alcance: ALCANCE_POR_DEFECTO,
  normas: [...NORMAS],
  auditorLiderId: '',
  equipoIds: [],
  auditadosTexto: '',
  fechaPlanificada: hoyISO(),
  fechaRealizacion: null,
  auditoriaAnteriorId: null,
});

export function AuditoriaFormModal({ open, onClose, auditoria, onCreada, anioInicial, prefill }: { open: boolean; onClose: () => void; auditoria?: Auditoria; onCreada?: (id: string) => void; anioInicial?: number; /** Datos iniciales (p. ej. desde el programa anual). */ prefill?: Partial<AuditoriaForm> }) {
  const u = useUsuario();
  const notify = useToast();
  const { sucursales, areas, auditores, auditorias, hallazgos, mapa } = useData();
  const [f, setF] = useState<AuditoriaForm>(vacio());
  const [errores, setErrores] = useState<string[]>([]);
  /** Tras el primer intento de guardar, los campos faltantes se marcan en rojo (y se actualizan al completarlos). */
  const [intento, setIntento] = useState(false);
  const [forzar, setForzar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cambiarLider, setCambiarLider] = useState(false);
  const { usuarios } = useData();

  /** Auditor líder fijo: el auditor vinculado a la cuenta con rol auditor_lider, o "Ismael Arelluna" del catálogo. */
  const liderPorDefecto = useMemo(() => {
    const cuenta = usuarios.find((x) => x.rol === 'auditor_lider' && x.activo && x.auditorId);
    if (cuenta?.auditorId && mapa.auditores[cuenta.auditorId]) return cuenta.auditorId;
    return auditores.find((a) => normalizar(a.nombre) === normalizar(AUDITOR_LIDER_NOMBRE))?.id ?? '';
  }, [usuarios, auditores, mapa.auditores]);

  useEffect(() => {
    if (!open) return;
    setErrores([]);
    setIntento(false);
    setForzar(false);
    setMotivo('');
    setCambiarLider(false);
    if (auditoria) {
      const { anio, sucursalId, areaId, objetivos, alcance, normas, auditorLiderId, equipoIds, auditadosTexto, fechaPlanificada, fechaRealizacion, auditoriaAnteriorId } = auditoria;
      setF({ anio, sucursalId, areaId, objetivos, alcance, normas, auditorLiderId, equipoIds, auditadosTexto, fechaPlanificada, fechaRealizacion, auditoriaAnteriorId });
    } else {
      const base = { ...vacio(anioInicial), auditorLiderId: liderPorDefecto, equipoIds: [] as string[], ...(prefill ?? {}) };
      if (prefill?.areaId && !prefill.auditadosTexto) {
        const ar = mapa.areas[prefill.areaId];
        base.auditadosTexto = ar?.encargado ? (ar.cargoEncargado ? `${ar.encargado}, ${ar.cargoEncargado}` : ar.encargado) : '';
      }
      setF(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auditoria, liderPorDefecto, anioInicial, JSON.stringify(prefill ?? null)]);

  /** El líder revisa y aprueba; solo integra el equipo auditor (audita en terreno) si se marca. */
  const liderAudita = !!f.auditorLiderId && f.equipoIds.includes(f.auditorLiderId);
  const setLider = (id: string) =>
    setF((p) => {
      const auditaba = !!p.auditorLiderId && p.equipoIds.includes(p.auditorLiderId);
      const resto = p.equipoIds.filter((x) => x !== p.auditorLiderId && x !== id);
      return { ...p, auditorLiderId: id, equipoIds: auditaba && id ? [id, ...resto] : resto };
    });
  const toggleLiderAudita = () =>
    setF((p) => ({ ...p, equipoIds: liderAudita ? p.equipoIds.filter((x) => x !== p.auditorLiderId) : [p.auditorLiderId, ...p.equipoIds] }));

  const set = <K extends keyof AuditoriaForm>(k: K, v: AuditoriaForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const textoEncargado = (areaId: string) => {
    const ar = mapa.areas[areaId];
    if (!ar?.encargado) return '';
    return ar.cargoEncargado ? `${ar.encargado}, ${ar.cargoEncargado}` : ar.encargado;
  };

  /** Al cambiar el área, propone su encargado como auditado (sin pisar un texto escrito a mano). */
  const cambiarArea = (areaId: string) =>
    setF((p) => {
      const anterior = textoEncargado(p.areaId);
      const reemplazar = !p.auditadosTexto.trim() || p.auditadosTexto === anterior;
      return { ...p, areaId, auditadosTexto: reemplazar ? textoEncargado(areaId) : p.auditadosTexto };
    });
  const conflictos = useMemo(() => conflictosIndependencia(f, mapa.auditores), [f, mapa.auditores]);
  const activos = auditores.filter((a) => a.activo || [f.auditorLiderId, ...f.equipoIds].includes(a.id));

  // Sugerir auditoría anterior: última de la misma área y sucursal
  const anteriores = auditorias.filter((a) => a.id !== auditoria?.id && a.areaId === f.areaId && a.sucursalId === f.sucursalId && a.estado !== 'anulada');

  const faltan: Partial<Record<'sucursal' | 'area' | 'fecha' | 'lider' | 'equipo' | 'normas' | 'objetivos' | 'alcance', string>> = {};
  if (!f.sucursalId) faltan.sucursal = 'Selecciona la sucursal.';
  if (!f.areaId) faltan.area = 'Selecciona el área auditada.';
  if (!f.fechaPlanificada) faltan.fecha = 'Indica la fecha planificada.';
  if (!f.auditorLiderId) faltan.lider = 'Selecciona el auditor líder.';
  if (!f.equipoIds.filter(Boolean).length) faltan.equipo = 'Marca al menos un auditor (o haz clic en tu nombre si también auditas).';
  if (!f.normas.length) faltan.normas = 'Marca al menos una norma.';
  if (!f.objetivos.trim()) faltan.objetivos = 'Escribe los objetivos.';
  if (!f.alcance.trim()) faltan.alcance = 'Escribe el alcance.';
  const err = (k: keyof typeof faltan) => (intento ? faltan[k] ?? null : null);
  const nFaltan = Object.keys(faltan).length;

  async function guardar() {
    setIntento(true);
    if (nFaltan) {
      setErrores([]);
      // Lleva al primer campo que falta (queda con pulso rojo)
      window.setTimeout(() => document.querySelector('[data-campo-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
      return;
    }
    const datos: AuditoriaForm = { ...f, equipoIds: Array.from(new Set(f.equipoIds.filter(Boolean))) };
    const e = validarAuditoria(datos);
    if (conflictos.length && !forzar) e.push(`Independencia (RN-02): ${conflictos.map((c) => c.nombre).join(', ')} pertenece(n) al área auditada.`);
    if (conflictos.length && forzar && motivo.trim().length < 5) e.push('Indique el motivo para forzar la independencia.');
    setErrores(e);
    if (e.length) return;
    setLoading(true);
    try {
      const m = conflictos.length && forzar ? motivo.trim() : null;
      if (auditoria) {
        await actualizarAuditoria(u, auditoria, datos, m);
        notify('Auditoría actualizada');
      } else {
        // Plan de auditoría: plantilla del área + NC abiertas anteriores + temas recurrentes
        const plan = construirPlanAuditoria({
          area: mapa.areas[datos.areaId],
          hallazgosArea: hallazgos.filter((h) => h.areaId === datos.areaId),
          codigos: Object.fromEntries(auditorias.map((x) => [x.id, x.codigo])),
          requisitos: mapa.requisitos,
        });
        const id = await crearAuditoria(u, datos, m, plan);
        notify('Auditoría creada');
        onCreada?.(id);
      }
      onClose();
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  const opt = (l: { id: string; nombre: string }[]) => l.map((x) => ({ value: x.id, label: x.nombre }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={auditoria ? `Editar auditoría ${auditoria.codigo}` : 'Nueva auditoría'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={loading} onClick={guardar}>
            {auditoria ? 'Guardar cambios' : 'Crear auditoría'}
          </Button>
        </>
      }
    >
      {intento && nFaltan > 0 && (
        <div className="mb-3">
          <Alerta tipo="error">Falta{nFaltan > 1 ? 'n' : ''} <b>{nFaltan}</b> campo{nFaltan > 1 ? 's' : ''} obligatorio{nFaltan > 1 ? 's' : ''}, marcado{nFaltan > 1 ? 's' : ''} en rojo.</Alerta>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Año" hint={auditoria ? 'El año no se modifica (define el correlativo).' : 'El N° se asigna automáticamente.'}>
          <Select value={String(f.anio)} disabled={!!auditoria} onChange={(e) => set('anio', Number(e.target.value))} options={aniosDisponibles([f.anio]).map((y) => ({ value: String(y), label: String(y) }))} />
        </Field>
        <Field label="Fecha planificada" error={err('fecha')}>
          <Input type="date" value={f.fechaPlanificada} onChange={(e) => set('fechaPlanificada', e.target.value)} />
        </Field>
        <Field label="Sucursal" error={err('sucursal')}>
          <Select
            value={f.sucursalId}
            onChange={(e) => {
              const suc = e.target.value;
              const area = mapa.areas[f.areaId];
              setF((p) => ({ ...p, sucursalId: suc, ...(area?.sucursalId && area.sucursalId !== suc ? { areaId: '', auditadosTexto: '' } : {}) }));
            }}
            placeholder="Seleccione…"
            options={opt(sucursales.filter((s) => s.activo || s.id === f.sucursalId))}
          />
        </Field>
        <Field label="Área auditada" error={err('area')} hint={!auditoria && f.areaId ? (mapa.areas[f.areaId]?.plan?.length ? `Se cargará su plan de auditoría (${mapa.areas[f.areaId]!.plan!.length} puntos) + NC abiertas anteriores.` : 'Esta área no tiene plan cargado (Áreas → Plan).') : undefined}>
          <Select value={f.areaId} onChange={(e) => cambiarArea(e.target.value)} placeholder="Seleccione…" options={opt(areas.filter((s) => (s.activo || s.id === f.areaId) && (!f.sucursalId || !s.sucursalId || s.sucursalId === f.sucursalId)))} />
        </Field>
        <Field label="Auditor líder" error={err('lider')}>
          {cambiarLider || !f.auditorLiderId ? (
            <Select value={f.auditorLiderId} onChange={(e) => setLider(e.target.value)} placeholder="Seleccione…" options={opt(activos)} />
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
              <Crown className="h-4 w-4 text-brand" />
              <b className="flex-1 text-zinc-900">{mapa.auditores[f.auditorLiderId]?.nombre ?? '—'}</b>
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              {esLider(u.rol) && (
                <button type="button" className="text-xs text-zinc-500 underline hover:text-zinc-900" onClick={() => setCambiarLider(true)}>
                  Cambiar
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Jefe / encargado de área (auditado)">
          <Input value={f.auditadosTexto} onChange={(e) => set('auditadosTexto', e.target.value)} placeholder="Nombre y cargo" />
        </Field>
        <Field label="Equipo auditor" className="sm:col-span-2" error={err('equipo')}>
          <div className="flex flex-wrap items-center gap-2">
            {f.auditorLiderId && (
              <button
                type="button"
                onClick={toggleLiderAudita}
                aria-pressed={liderAudita}
                title={liderAudita ? 'El líder también audita. Clic para dejarlo solo como revisor.' : 'El líder solo revisa y aprueba. Clic si también audita en terreno.'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition',
                  liderAudita ? 'border-panel bg-panel text-white' : 'border-dashed border-zinc-400 bg-surface text-zinc-600 hover:border-zinc-600',
                )}
              >
                <Crown className="h-3 w-3 text-brand" /> {mapa.auditores[f.auditorLiderId]?.nombre} · {liderAudita ? 'líder y auditor' : 'líder (solo revisor)'}
              </button>
            )}
            <CheckboxGroup
              options={activos.filter((a) => a.id !== f.auditorLiderId).map((a) => ({ value: a.id, label: a.nombre }))}
              value={f.equipoIds.filter((x) => x !== f.auditorLiderId)}
              onChange={(v) => set('equipoIds', Array.from(new Set([...(liderAudita ? [f.auditorLiderId] : []), ...v].filter(Boolean))))}
            />
          </div>
        </Field>
        <Field label="Normas de referencia" className="sm:col-span-2" error={err('normas')}>
          <CheckboxGroup<Norma> options={NORMAS.map((n) => ({ value: n, label: n }))} value={f.normas} onChange={(v) => set('normas', v)} />
        </Field>
        <Field label="Objetivos" className="sm:col-span-2" error={err('objetivos')}>
          <Textarea value={f.objetivos} onChange={(e) => set('objetivos', e.target.value)} />
        </Field>
        <Field label="Alcance" className="sm:col-span-2" error={err('alcance')}>
          <Textarea value={f.alcance} onChange={(e) => set('alcance', e.target.value)} />
        </Field>
        <Field label="Auditoría anterior (para verificar sus acciones)" className="sm:col-span-2">
          <Select value={f.auditoriaAnteriorId ?? ''} onChange={(e) => set('auditoriaAnteriorId', e.target.value || null)} placeholder="Ninguna" options={anteriores.map((a) => ({ value: a.id, label: `${a.codigo} · ${mapa.areas[a.areaId]?.nombre ?? ''}` }))} />
        </Field>
      </div>

      {f.auditorLiderId && !liderAudita && mapa.auditores[f.auditorLiderId]?.areaOrigenId === f.areaId && f.areaId && (
        <div className="mt-3">
          <Alerta tipo="info">El auditor líder pertenece al área auditada: queda solo como <b>revisor</b> del informe y no audita en terreno.</Alerta>
        </div>
      )}
      {conflictos.length > 0 && (
        <div className="mt-4 space-y-2">
          <Alerta tipo="warn">
            <b>Independencia del auditor:</b> {conflictos.map((c) => c.nombre).join(', ')} tiene(n) como área de origen el área auditada.
          </Alerta>
          {esLider(u.rol) && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-panel" checked={forzar} onChange={(e) => setForzar(e.target.checked)} /> Forzar con motivo (queda registrado)
              </label>
              {forzar && <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo…" rows={2} />}
            </>
          )}
        </div>
      )}
      <div className="mt-4">
        <ErrorList errores={errores} />
      </div>
    </Modal>
  );
}
