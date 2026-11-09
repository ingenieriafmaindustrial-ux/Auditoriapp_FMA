import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Save, TriangleAlert } from 'lucide-react';
import { Alerta, Button, Modal, Select } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { leerPlanDocx } from '../../lib/planDocx';
import { claveAreaPlan, puntosPlanDesdeTextos } from '../../data/planesSeed';
import { guardarPlanArea } from '../../services/plan';
import type { Area } from '../../types';

interface Fila {
  archivo: string;
  proceso: string;
  puntos: string[];
  areaId: string;
  error?: string;
}

/** Importa uno o varios "Planes de auditoría" en Word: detecta el proceso, muestra los puntos y los asigna a su área. */
export function ImportarPlanesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useToast();
  const { areas, mapa } = useData();
  const input = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ver, setVer] = useState<number | null>(null);

  const etiqueta = (a: Area) => `${a.nombre}${a.sucursalId && mapa.sucursales[a.sucursalId] ? ` · ${mapa.sucursales[a.sucursalId].nombre}` : ''}${a.plan?.length ? ` (tiene ${a.plan.length})` : ''}`;
  const areaSugerida = (proceso: string, archivo: string) => {
    const clave = claveAreaPlan(proceso) ?? claveAreaPlan(archivo.replace(/\.docx$/i, '').replace(/^(plan de auditoria|programa)\s*-\s*/i, ''));
    const candidatas = areas.filter((a) => a.activo !== false && clave && claveAreaPlan(a.nombre) === clave);
    // Si hay la misma área en varias sucursales, se prefiere Santiago (alcance de los planes: casa matriz)
    return (candidatas.find((a) => /santiago/i.test(mapa.sucursales[a.sucursalId ?? '']?.nombre ?? '')) ?? candidatas[0])?.id ?? '';
  };

  const leer = async (files: FileList | null) => {
    if (!files?.length) return;
    setLeyendo(true);
    const nuevas: Fila[] = [];
    for (const f of Array.from(files)) {
      try {
        if (!/\.docx$/i.test(f.name)) throw new Error('Solo Word .docx (el PDF no se puede leer como lista)');
        const r = await leerPlanDocx(await f.arrayBuffer());
        nuevas.push({ archivo: f.name, proceso: r.proceso, puntos: r.puntos, areaId: areaSugerida(r.proceso, f.name) });
      } catch (e) {
        nuevas.push({ archivo: f.name, proceso: '', puntos: [], areaId: '', error: errorMensaje(e) });
      }
    }
    setFilas((prev) => [...prev.filter((p) => !nuevas.some((n) => n.archivo === p.archivo)), ...nuevas]);
    setLeyendo(false);
    if (input.current) input.current.value = '';
  };

  const validas = filas.filter((f) => !f.error && f.puntos.length && f.areaId);
  const repetidas = new Set(validas.map((f) => f.areaId).filter((id, i, l) => l.indexOf(id) !== i));
  const cerrar = () => { setFilas([]); setVer(null); onClose(); };

  const guardar = async () => {
    if (repetidas.size) return notify('Hay dos archivos asignados a la misma área', 'error');
    const conPlan = validas.filter((f) => mapa.areas[f.areaId]?.plan?.length).length;
    if (conPlan && !confirm(`${conPlan} área(s) ya tienen plan y se reemplazará. Las auditorías existentes no cambian (usa "Actualizar plan" en cada una). ¿Continuar?`)) return;
    setGuardando(true);
    try {
      for (const f of validas) await guardarPlanArea(f.areaId, puntosPlanDesdeTextos(f.puntos));
      notify(`Plan importado en ${validas.length} área(s)`);
      cerrar();
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={open}
      size="xl"
      onClose={cerrar}
      title={<span className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Importar planes de auditoría (Word)</span>}
      footer={
        <>
          <span className="mr-auto text-xs text-zinc-500">{validas.length} de {filas.length} archivo(s) listos</span>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={guardando} disabled={!validas.length} onClick={guardar}>Guardar planes</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-zinc-600">
        Selecciona uno o varios planes (.docx). Se lee la columna de <b>requisitos a auditar</b> («PLAN DE AUDITORÍA INTERNA»), punto por punto y en el mismo orden, y se asigna al área según el proceso.
      </p>
      <input ref={input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden onChange={(e) => void leer(e.target.files)} />
      <Button variant="dark" icon={<FileUp className="h-4 w-4" />} loading={leyendo} onClick={() => input.current?.click()}>Seleccionar archivos Word</Button>

      {filas.length > 0 && (
        <div className="table-wrap mt-4">
          <table className="tabla">
            <thead><tr><th>Archivo</th><th>Proceso detectado</th><th className="w-24">Puntos</th><th>Área destino</th></tr></thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.archivo} className={f.error ? 'bg-red-50' : ''}>
                  <td className="text-xs">{f.archivo}</td>
                  <td>{f.error ? <span className="flex items-center gap-1 text-xs text-red-700"><TriangleAlert className="h-3.5 w-3.5" />{f.error}</span> : f.proceso || '—'}</td>
                  <td>{!f.error && <button type="button" className="font-semibold text-violet-700 hover:underline" onClick={() => setVer(ver === i ? null : i)}>{f.puntos.length} {ver === i ? '▲' : '▼'}</button>}</td>
                  <td>
                    {!f.error && (
                      <Select
                        className={`text-sm ${repetidas.has(f.areaId) ? 'border-red-500' : ''}`}
                        value={f.areaId}
                        placeholder="Elegir área…"
                        options={areas.filter((a) => a.activo !== false).map((a) => ({ value: a.id, label: etiqueta(a) }))}
                        onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, areaId: e.target.value } : x)))}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ver !== null && filas[ver] && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-zinc-600"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {filas[ver].archivo} — puntos que se cargarán</p>
          <ol className="list-inside list-decimal columns-1 text-sm sm:columns-2">
            {filas[ver].puntos.map((p, k) => <li key={k}>{p}</li>)}
          </ol>
        </div>
      )}
      {repetidas.size > 0 && <div className="mt-3"><Alerta tipo="error">Dos archivos apuntan a la misma área. Corrige el área destino.</Alerta></div>}
    </Modal>
  );
}
