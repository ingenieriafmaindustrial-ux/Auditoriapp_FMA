import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileUp } from 'lucide-react';
import { Alerta, Badge, Button, Modal } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { fmtFecha } from '../../lib/dates';
import { auditoriasConAreaCruzada, reactivarHistoricoPorAnio, importarHistorico, leerHistorico, planificar, repararAreasCruzadas, type DatosHistorico, type Progreso } from '../../services/historico';

/** Importación de auditorías de años anteriores desde el archivo historico_2024_2026.json (solo administrador TI). */
export function ImportarHistoricoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const u = useUsuario();
  const notify = useToast();
  const { sucursales, areas, auditores, requisitos, auditorias, hallazgos } = useData();
  const input = useRef<HTMLInputElement>(null);
  const [datos, setDatos] = useState<DatosHistorico | null>(null);
  const [archivo, setArchivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<{ auditorias: number; hallazgos: number } | null>(null);

  const catalogos = useMemo(() => ({ sucursales, areas, auditores, requisitos }), [sucursales, areas, auditores, requisitos]);
  const plan = useMemo(() => (datos ? planificar(datos, catalogos, auditorias) : null), [datos, catalogos, auditorias]);
  const pendientes = plan?.filas.filter((f) => !f.existente) ?? [];
  const totales = pendientes.reduce((t, f) => ({ nc: t.nc + f.nc, om: t.om + f.om, inf: t.inf + f.inferidos }), { nc: 0, om: 0, inf: 0 });
  const sinReq = [...new Set(pendientes.flatMap((f) => f.sinRequisito))];
  const cruzadas = useMemo(() => auditoriasConAreaCruzada(auditorias, areas), [auditorias, areas]);
  const [reparando, setReparando] = useState(false);
  const historicos = hallazgos.filter((h) => h.historico && !h.anulado);
  const aniosHist = [...new Set(historicos.map((h) => h.anio))].sort((a, b) => b - a);
  const [anioReact, setAnioReact] = useState<number | null>(null);
  const anioSel = anioReact ?? aniosHist[0] ?? null;
  const [conOM, setConOM] = useState(true);
  const [reactivando, setReactivando] = useState(false);
  const aReactivar = historicos.filter((h) => h.anio === anioSel && (conOM || h.tipo === 'NC'));
  const reactivar = async () => {
    if (anioSel === null) return;
    setReactivando(true);
    setError(null);
    try {
      const n = await reactivarHistoricoPorAnio(u, hallazgos, anioSel, conOM);
      notify(`${n} hallazgo(s) de ${anioSel} vuelven a seguimiento`);
    } catch (e) {
      setError(errorMensaje(e));
    } finally {
      setReactivando(false);
    }
  };
  const reparar = async () => {
    setReparando(true);
    setError(null);
    try {
      const r = await repararAreasCruzadas(u, auditorias, areas);
      notify(`Corregidas ${r.auditorias} auditorías (${r.hallazgos} hallazgos) a las áreas de su sucursal`);
    } catch (e) {
      setError(errorMensaje(e));
    } finally {
      setReparando(false);
    }
  };

  const elegir = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setResultado(null);
    try {
      setDatos(leerHistorico(await f.text()));
      setArchivo(f.name);
    } catch (e) {
      setDatos(null);
      setError(errorMensaje(e));
    }
  };

  const ejecutar = async () => {
    if (!plan) return;
    setTrabajando(true);
    setError(null);
    try {
      const r = await importarHistorico(u, plan, catalogos, setProgreso);
      setResultado(r);
      notify(`Importadas ${r.auditorias} auditorías con ${r.hallazgos} hallazgos`);
    } catch (e) {
      setError(`${errorMensaje(e)} — puedes volver a ejecutar: lo ya importado se omite y lo interrumpido se rehace.`);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={trabajando ? () => undefined : onClose}
      size="xl"
      title="Importar auditorías históricas"
      footer={
        <>
          <Button onClick={onClose} disabled={trabajando}>{resultado ? 'Cerrar' : 'Cancelar'}</Button>
          {!resultado && <Button variant="primary" loading={trabajando} disabled={!plan || !pendientes.length} onClick={ejecutar}>Importar {pendientes.length || ''} auditoría(s)</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Carga las auditorías 2024–2026 desde el archivo <b>historico_2024_2026.json</b>. Quedan <b>cerradas</b>, marcadas como <b>Importada</b>, con numeración correlativa de la app (el N° original del informe se conserva) y
          sus hallazgos como <b>histórico sin seguimiento</b>: tratados y fuera de alertas. Se pueden reactivar uno a uno. No se copian fotos ni se entrena el asistente.
        </p>
        {aniosHist.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-zinc-800">Reactivar seguimiento de hallazgos importados</p>
            <p className="mt-0.5 text-xs text-zinc-500">Para años cuyo tratamiento y medición de eficacia siguen pendientes. Las auditorías quedan cerradas; los hallazgos vuelven a aparecer como pendientes, con su tratamiento y verificación de eficacia.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select className="input w-auto" value={anioSel ?? ''} onChange={(e) => setAnioReact(Number(e.target.value))} aria-label="Año">
                {aniosHist.map((y) => (
                  <option key={y} value={y}>{y} · {historicos.filter((h) => h.anio === y).length} históricos</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={conOM} onChange={(e) => setConOM(e.target.checked)} /> Incluir OM
              </label>
              <Button size="sm" variant="primary" loading={reactivando} disabled={!aReactivar.length} onClick={reactivar}>
                Reactivar {aReactivar.length} hallazgo(s)
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void elegir(e.target.files?.[0]); e.target.value = ''; }} />
          <Button icon={<FileUp className="h-4 w-4" />} onClick={() => input.current?.click()} disabled={trabajando}>Elegir archivo…</Button>
          {archivo && <span className="text-sm text-zinc-600">{archivo}</span>}
        </div>
        {error && <Alerta tipo="error">{error}</Alerta>}
        {cruzadas.length > 0 && (
          <Alerta tipo="warn">
            <span className="flex flex-wrap items-center gap-3">
              <span>{cruzadas.length} auditoría(s) importada(s) quedaron con un área de otra sucursal (por ejemplo, Antofagasta con áreas de Santiago). La corrección crea las áreas en su sucursal y mueve auditorías y hallazgos; no cambia números ni contenido.</span>
              <Button size="sm" variant="primary" loading={reparando} onClick={reparar}>Corregir ahora</Button>
            </span>
          </Alerta>
        )}

        {resultado && <Alerta tipo="info"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Importación terminada: {resultado.auditorias} auditorías y {resultado.hallazgos} hallazgos.</span></Alerta>}

        {plan && !resultado && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className="bg-zinc-100 text-zinc-800">{pendientes.length} por importar</Badge>
              <Badge className="bg-emerald-50 text-emerald-800">{plan.filas.length - pendientes.length} ya importadas</Badge>
              <Badge className="bg-red-100 text-red-800">{totales.nc} NC</Badge>
              <Badge className="bg-sky-100 text-sky-800">{totales.om} OM</Badge>
            </div>
            {totales.inf > 0 && <Alerta tipo="warn">En {totales.inf} hallazgo(s) el informe original no marcaba NC/OM: el tipo se dedujo del texto y de los totales del informe. Quedan marcados para revisar.</Alerta>}
            {(plan.areasNuevas.length > 0 || plan.auditoresNuevos.length > 0 || plan.sucursalesNuevas.length > 0) && (
              <Alerta tipo="info">
                Se agregarán al catálogo{plan.sucursalesNuevas.length ? ` sucursales: ${plan.sucursalesNuevas.join(', ')}.` : ''}{plan.areasNuevas.length ? ` Áreas: ${plan.areasNuevas.map((a) => `${a.nombre} (${a.sucursal})`).join(', ')}.` : ''}{plan.auditoresNuevos.length ? ` Auditores históricos (inactivos, solo para mostrar su nombre): ${plan.auditoresNuevos.join(', ')}.` : ''}
              </Alerta>
            )}
            {sinReq.length > 0 && <Alerta tipo="warn">Estas cláusulas no existen en tu catálogo de requisitos y se omitirán: {sinReq.join(', ')}. Si son de ISO 14001, actualiza antes el catálogo a ISO 14001:2026 (Catálogos).</Alerta>}
            <div className="table-wrap max-h-80 overflow-auto">
              <table className="table">
                <thead>
                  <tr><th>Año</th><th>Sucursal</th><th>Área</th><th>Fecha</th><th>NC</th><th>OM</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {plan.filas.map((f) => (
                    <tr key={f.a.clave}>
                      <td>{f.a.anio}</td>
                      <td>{f.a.sucursal}</td>
                      <td>{f.a.area}</td>
                      <td>{fmtFecha(f.a.fechaRealizacion)}</td>
                      <td>{f.nc}</td>
                      <td>{f.om}</td>
                      <td>{f.existente ? <Badge className="bg-emerald-50 text-emerald-800">Ya importada</Badge> : f.incompleta ? <Badge className="bg-amber-50 text-amber-900">Se rehace</Badge> : <Badge className="bg-zinc-100 text-zinc-700">Nueva</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {trabajando && progreso && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round((progreso.hechas / Math.max(1, progreso.total)) * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-zinc-500">{progreso.hechas} de {progreso.total} · {progreso.mensaje}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
