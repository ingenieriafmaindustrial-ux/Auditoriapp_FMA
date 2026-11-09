import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck2, Info } from 'lucide-react';
import { Alerta, Button, EmptyState, Input, Modal, Select } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { fmtFecha, hoyISO } from '../../lib/dates';
import { MAX_EFICACIA_SEMANA, proponerEficacia, reglaEficacia, type PropuestaEficacia } from '../../domain/eficacia';
import { crearEficaciaLote } from '../../services/programa';
import type { ProgramaItem } from '../../types';

interface Fila extends PropuestaEficacia {
  incluir: boolean;
}

/**
 * Genera el programa de medición de eficacia del año: una revisión por área con hallazgos pendientes,
 * en noviembre–diciembre, lunes y jueves (máx. 2 por semana, 1 por día).
 */
export function PlanEficaciaModal({ open, onClose, anio }: { open: boolean; onClose: () => void; anio: number }) {
  const u = useUsuario();
  const notify = useToast();
  const { hallazgos, auditorias, programa, auditores, mapa } = useData();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const hoy = hoyISO();
    const desde = hoy.slice(0, 4) === String(anio) ? hoy : `${anio}-01-01`;
    const nombreSucursal = (id: string) => mapa.sucursales[id]?.nombre ?? '';
    // Si el líder original ya no está activo (p. ej. auditor histórico), se propone a quien programa
    const activo = (id: string) => !!id && mapa.auditores[id]?.activo;
    setFilas(proponerEficacia({ anio, hallazgos, auditorias, programa, areas: mapa.areas, nombreSucursal, desde }).map((p) => ({ ...p, liderId: activo(p.liderId) ? p.liderId : u.auditorId ?? '', incluir: true })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anio]);

  const setFila = (i: number, cambio: Partial<Fila>) => setFilas((l) => l.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const activos = auditores.filter((a) => a.activo);

  // Cada fila se valida contra el programa vigente + las demás filas seleccionadas
  const validacion = useMemo(
    () =>
      filas.map((f, i) => {
        if (!f.incluir) return { errores: [] as string[], avisos: [] as string[] };
        if (!f.fecha) return { errores: ['Sin cupo libre en la ventana: indique una fecha.'], avisos: [] };
        const simuladas: ProgramaItem[] = filas
          .filter((x, j) => j !== i && x.incluir && x.fecha)
          .map((x, j) => ({ id: `sim-${j}`, tipo: 'eficacia', anio, sucursalId: x.sucursalId, areaId: x.areaId, fecha: x.fecha!, auditorLiderId: x.liderId, equipoIds: [], notas: '', auditoriaId: null, cancelado: false, realizadoEn: null, creadoPor: '', creadoEn: '', actualizadoEn: '' }));
        const r = reglaEficacia(f.fecha, [...programa, ...simuladas]);
        return { errores: [...r.errores, ...(f.liderId ? [] : ['Asigne el auditor que hará la revisión.'])], avisos: r.avisos };
      }),
    [filas, programa, anio],
  );
  const seleccionadas = filas.filter((f) => f.incluir);
  const conError = validacion.filter((v) => v.errores.length).length;

  const notasDe = (f: Fila) => {
    const porAud = new Map<string, number[]>();
    f.hallazgos.forEach((h) => porAud.set(h.auditoriaId, [...(porAud.get(h.auditoriaId) ?? []), h.correlativo]));
    const refs = [...porAud.entries()].map(([id, cs]) => `${mapa.auditorias[id]?.codigo ?? '—'} #${cs.join(', #')}`).join('; ');
    return `Medición de eficacia de ${f.hallazgos.length} hallazgo(s) ${anio} (${f.nc} NC · ${f.om} OM): ${refs}.`;
  };

  const crear = async () => {
    if (conError || !seleccionadas.length) return;
    setGuardando(true);
    try {
      await crearEficaciaLote(u, seleccionadas.map((f) => ({ areaId: f.areaId, sucursalId: f.sucursalId, fecha: f.fecha!, liderId: f.liderId, notas: notasDe(f) })));
      notify(`${seleccionadas.length} medición(es) de eficacia programadas`);
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
      size="xl"
      title={`Programar medición de eficacia ${anio}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<CalendarCheck2 className="h-4 w-4" />} loading={guardando} disabled={!!conError || !seleccionadas.length} onClick={crear}>
            Programar {seleccionadas.length} revisión(es)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 ring-1 ring-zinc-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <p>
            Una revisión por área que cubre todos sus hallazgos pendientes de {anio}. Regla: <b>noviembre y diciembre</b>, solo <b>lunes y jueves</b>, máximo <b>{MAX_EFICACIA_SEMANA} por semana</b> y <b>1 por día</b>; se saltan feriados y días que ya tienen otra actividad. Las fechas se pueden ajustar antes de confirmar.
          </p>
        </div>

        {filas.length === 0 ? (
          <EmptyState title="Nada que programar">Todas las áreas con hallazgos pendientes de {anio} ya tienen su medición de eficacia programada, o no quedan hallazgos pendientes.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2 text-center">Pendientes</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filas.map((f, i) => {
                  const v = validacion[i];
                  const dia = f.fecha ? new Date(`${f.fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long' }) : '';
                  return (
                    <tr key={f.areaId} className={f.incluir ? '' : 'opacity-50'}>
                      <td className="px-3 py-2 align-top">
                        <input type="checkbox" className="mt-2 h-4 w-4 accent-[var(--color-brand)]" checked={f.incluir} onChange={(e) => setFila(i, { incluir: e.target.checked })} aria-label={`Incluir ${mapa.areas[f.areaId]?.nombre}`} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <b className="block">{mapa.areas[f.areaId]?.nombre ?? '—'}</b>
                        <span className="text-xs text-zinc-500">{mapa.sucursales[f.sucursalId]?.nombre}</span>
                      </td>
                      <td className="px-3 py-2 text-center align-top">
                        <span className="mt-1 inline-flex gap-1 text-xs font-semibold">
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">{f.nc} NC</span>
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">{f.om} OM</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input type="date" value={f.fecha ?? ''} min={`${anio}-11-01`} max={`${anio}-12-31`} onChange={(e) => setFila(i, { fecha: e.target.value || null })} disabled={!f.incluir} />
                        <span className="mt-0.5 block text-[11px] capitalize text-zinc-500">{dia}</span>
                        {[...v.errores, ...v.avisos].map((m) => (
                          <span key={m} className={`mt-1 flex items-start gap-1 text-[11px] ${v.errores.includes(m) ? 'text-red-700' : 'text-amber-700'}`}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {m}</span>
                        ))}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Select value={f.liderId} onChange={(e) => setFila(i, { liderId: e.target.value })} placeholder="Seleccione…" options={activos.map((a) => ({ value: a.id, label: a.nombre }))} disabled={!f.incluir} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {conError > 0 && <Alerta tipo="error">{conError} fila(s) no cumplen la regla. Ajuste la fecha o desmárquelas.</Alerta>}
        {filas.length > 0 && !conError && seleccionadas.length > 0 && (
          <p className="text-xs text-zinc-500">
            Primera revisión el {fmtFecha(seleccionadas.map((f) => f.fecha!).sort()[0])} · última el {fmtFecha(seleccionadas.map((f) => f.fecha!).sort().slice(-1)[0])}. Cada auditor la verá en su campana y en el banner del mes.
          </p>
        )}
      </div>
    </Modal>
  );
}
