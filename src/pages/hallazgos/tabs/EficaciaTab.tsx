import { useState } from 'react';
import { CalendarCheck2, Save } from 'lucide-react';
import { Alerta, Button, Card, ErrorList, Field, Input, Select, Textarea } from '../../../components/ui';
import { NivelBadge } from '../../../components/shared/Badges';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fmtFecha, hoyISO } from '../../../lib/dates';
import { cn, errorMensaje } from '../../../lib/utils';
import { validarVerificacion } from '../../../domain/hallazgoReglas';
import { agregarVerificacion } from '../../../services/hallazgos';
import { marcarRealizado } from '../../../services/programa';
import { tipoDe } from '../../../domain/programa';
import { ventanaEficacia } from '../../../domain/eficacia';
import { esGestor } from '../../../domain/permisos';
import type { Hallazgo, ResultadoEficacia } from '../../../types';

export default function EficaciaTab({ h, editable }: { h: Hallazgo; editable: boolean }) {
  const u = useUsuario();
  const notify = useToast();
  const { auditorias, hallazgos, programa, mapa } = useData();
  const [fecha, setFecha] = useState(hoyISO());
  const [resultado, setResultado] = useState<ResultadoEficacia | null>(null);
  const [analisis, setAnalisis] = useState('');
  const [auditoriaId, setAuditoriaId] = useState(h.auditoriaId);
  const [errores, setErrores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const verifs = [...h.verificaciones].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  const puedeVerificar = editable && h.estado !== 'tratada' && !(h.tipo === 'OM' && h.cierreSinAccion);
  // Medición de eficacia programada para el área en el año del hallazgo (Calendario)
  const revision = programa.find((p) => tipoDe(p) === 'eficacia' && !p.cancelado && p.areaId === h.areaId && p.anio === h.anio) ?? null;
  const opcionesAuditoria = auditorias.filter((a) => a.id === h.auditoriaId || (a.auditoriaAnteriorId === h.auditoriaId && a.estado !== 'anulada'));

  async function registrar() {
    const e = validarVerificacion(h, { fecha, analisis });
    if (!resultado) e.push('Seleccione el resultado: eficaz o no eficaz.');
    setErrores(e);
    if (e.length || !resultado) return;
    setLoading(true);
    try {
      await agregarVerificacion(u, h.id, { fecha, resultado, analisis: analisis.trim(), auditoriaId, auditorId: u.auditorId });
      notify(resultado === 'eficaz' ? 'Verificación registrada: hallazgo tratado' : 'Verificación NO eficaz registrada');
      setAnalisis('');
      setResultado(null);
      // Si con esta verificación el área no deja hallazgos sin revisar en la ventana, la revisión programada queda realizada
      if (revision && !revision.realizadoEn && esGestor(u.rol)) {
        const desde = ventanaEficacia(h.anio).desde;
        const faltan = hallazgos.filter((x) => x.id !== h.id && x.areaId === h.areaId && x.anio === h.anio && !x.anulado && x.estado !== 'tratada' && !x.verificaciones.some((v) => v.fecha >= desde));
        if (!faltan.length) await marcarRealizado(revision, fecha).then(() => notify('Medición de eficacia del área marcada como realizada')).catch(() => undefined);
      }
    } catch (err) {
      setErrores([errorMensaje(err)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-zinc-600">Nivel de importancia del hallazgo: <NivelBadge nivel={h.nivel} /></p>

      {puedeVerificar && (
        <Card title="Registrar verificación de eficacia">
          <p className="mb-3 flex items-center gap-2 text-xs text-zinc-600">
            <CalendarCheck2 className="h-4 w-4 text-zinc-500" />
            {revision ? (
              <span>Revisión programada del área: <b>{new Date(`${revision.fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long' })} {fmtFecha(revision.fecha)}</b> · {mapa.auditores[revision.auditorLiderId]?.nombre ?? '—'}{revision.realizadoEn ? ' · realizada' : ''}</span>
            ) : (
              <span>El área aún no tiene medición de eficacia programada (Calendario → Programar eficacia).</span>
            )}
          </p>
          {h.acciones.some((a) => !a.implementada) && <div className="mb-3"><Alerta tipo="info">Hay acciones que el área aún no marca como implementadas. Puedes verificar igual: registra en el análisis lo que constataste en terreno.</Alerta></div>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fecha de verificación">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field label="Verificado en auditoría">
              <Select value={auditoriaId} onChange={(e) => setAuditoriaId(e.target.value)} options={opcionesAuditoria.map((a) => ({ value: a.id, label: a.codigo }))} />
            </Field>
            <Field label="Resultado">
              <div className="grid grid-cols-2 gap-1.5">
                {(['eficaz', 'no_eficaz'] as ResultadoEficacia[]).map((r) => (
                  <button key={r} type="button" onClick={() => setResultado(r)} className={cn('rounded-md border px-2 py-2 text-xs font-bold', resultado === r ? (r === 'eficaz' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-red-600 bg-red-600 text-white') : 'border-zinc-200 text-zinc-500')}>
                    {r === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Análisis de eficacia" className="sm:col-span-3" hint="Qué impacto han tenido las acciones: evidencia de que el problema no se repite.">
              <Textarea rows={4} value={analisis} onChange={(e) => setAnalisis(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ErrorList errores={errores} />
            <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={loading} onClick={registrar} className="ml-auto">Registrar verificación</Button>
          </div>
        </Card>
      )}

      <Card title={`Historial de verificaciones (${verifs.length})`}>
        {verifs.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no se ha verificado la eficacia.</p>
        ) : (
          <ul className="space-y-3">
            {verifs.map((v) => (
              <li key={v.id} className={cn('rounded-lg border-l-4 bg-zinc-50 p-3', v.resultado === 'eficaz' ? 'border-emerald-600' : 'border-red-600')}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <b className={v.resultado === 'eficaz' ? 'text-emerald-700' : 'text-red-700'}>{v.resultado === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ'}</b>
                  <span>{fmtFecha(v.fecha)}</span>
                  {v.auditoriaId && <span>· Auditoría {mapa.auditorias[v.auditoriaId]?.codigo}</span>}
                  {v.auditorId && <span>· {mapa.auditores[v.auditorId]?.nombre}</span>}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{v.analisis}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
