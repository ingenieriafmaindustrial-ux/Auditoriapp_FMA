import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardList, ClipboardPaste, Copy, FileUp, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { RequisitoPicker } from '../../components/shared/RequisitoPicker';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { NORMAS } from '../../lib/constants';
import { GRUPOS_PLAN, nuevoIdPunto } from '../../domain/plan';
import { planSeedParaArea, puntosPlanDesdeTextos } from '../../data/planesSeed';
import { leerPlanDocx, puntosDesdeTexto } from '../../lib/planDocx';
import { guardarPlanArea } from '../../services/plan';
import type { Area, GrupoPlan, PuntoPlan } from '../../types';

/** Editor de la plantilla del plan de auditoría de un área. */
export function PlanAreaModal({ area, onClose }: { area: Area | null; onClose: () => void }) {
  const notify = useToast();
  const { areas, requisitos, mapa } = useData();
  const [puntos, setPuntos] = useState<PuntoPlan[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (area) setPuntos(area.plan ?? []);
  }, [area]);

  const idPorClave = useMemo(() => new Map(requisitos.map((r) => [`${r.norma}|${r.clausula}`, r.id])), [requisitos]);
  const seed = area ? planSeedParaArea(area.nombre) : null;
  if (!area) return null;

  const set = (i: number, cambio: Partial<PuntoPlan>) => setPuntos((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  const mover = (i: number, d: -1 | 1) =>
    setPuntos((ps) => {
      const n = [...ps];
      const j = i + d;
      if (j < 0 || j >= n.length) return ps;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const reemplazar = (textos: string[], origen: string) => {
    if (!textos.length) return notify('No se encontraron puntos', 'error');
    if (puntos.length && !confirm(`¿Reemplazar los ${puntos.length} puntos actuales por ${textos.length} puntos de ${origen}?`)) return;
    setPuntos(puntosPlanDesdeTextos(textos, `i${Date.now().toString(36)}-`));
  };
  const importarWord = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await leerPlanDocx(await f.arrayBuffer());
      reemplazar(r.puntos, `«${f.name}»`);
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      if (archivo.current) archivo.current.value = '';
    }
  };
  const suc = (a: Area) => (a.sucursalId ? mapa.sucursales[a.sucursalId]?.nombre ?? '' : '');

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={<span className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Plan de auditoría · {area.nombre}{suc(area) ? ` · ${suc(area)}` : ''}</span>}
      footer={
        <>
          <span className="mr-auto text-xs text-zinc-500">{puntos.length} punto(s). Los cambios aplican a las auditorías nuevas; las existentes conservan su plan.</span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={<Save className="h-4 w-4" />}
            loading={guardando}
            onClick={async () => {
              setGuardando(true);
              try {
                await guardarPlanArea(area.id, puntos.filter((p) => p.titulo.trim()).map((p) => ({ ...p, titulo: p.titulo.trim(), referencia: p.referencia?.trim() || null })));
                notify('Plan del área guardado');
                onClose();
              } catch (e) {
                notify(errorMensaje(e), 'error');
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar plan
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input ref={archivo} type="file" accept=".docx" hidden onChange={(e) => void importarWord(e.target.files?.[0])} />
        <Button size="sm" variant="dark" icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => archivo.current?.click()}>Importar desde Word</Button>
        <Button size="sm" icon={<ClipboardPaste className="h-3.5 w-3.5" />} onClick={() => setPegando((x) => !x)}>Pegar lista</Button>
        {seed && (
          <Button size="sm" icon={<ClipboardList className="h-3.5 w-3.5" />} onClick={() => (!puntos.length || confirm('¿Reemplazar los puntos actuales por el plan FMA 2026?')) && setPuntos(seed)}>
            Usar plan FMA 2026 ({seed.length})
          </Button>
        )}
        <Select
          className="w-72 text-sm"
          value=""
          placeholder="Copiar plan desde otra área…"
          options={areas.filter((a) => a.id !== area.id && a.plan?.length).map((a) => ({ value: a.id, label: `${a.nombre}${suc(a) ? ` · ${suc(a)}` : ''} (${a.plan!.length})` }))}
          onChange={(e) => {
            const o = areas.find((a) => a.id === e.target.value);
            if (o?.plan && (!puntos.length || confirm(`¿Reemplazar los puntos actuales por el plan de ${o.nombre}?`))) setPuntos(o.plan.map((p) => ({ ...p })));
          }}
        />
        <Copy className="h-4 w-4 text-zinc-400" />
      </div>

      {pegando && (
        <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="mb-1 text-xs text-zinc-600">Copia la lista desde el Word o Excel y pégala: <b>un punto por línea</b> (las viñetas se ignoran y las líneas cortadas se unen).</p>
          <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'PGI-09\nHCR\nRegistros de trabajo en terreno\n…'} />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" onClick={() => setPegando(false)}>Cerrar</Button>
            <Button size="sm" variant="primary" disabled={!texto.trim()} onClick={() => { reemplazar(puntosDesdeTexto(texto), 'la lista pegada'); setPegando(false); setTexto(''); }}>Usar {puntosDesdeTexto(texto).length} punto(s)</Button>
          </div>
        </div>
      )}

      {puntos.length === 0 && <p className="rounded-lg border-2 border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">Sin puntos. Importa el plan desde Word, pega la lista, usa el plan FMA 2026 o agrega puntos.</p>}

      <ol className="space-y-2">
        {puntos.map((p, i) => (
          <li key={p.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-center text-xs font-bold text-zinc-500">{i + 1}</span>
              <Input className="min-w-56 flex-1" value={p.titulo} onChange={(e) => set(i, { titulo: e.target.value })} placeholder="Punto a revisar" />
              <Select className="w-52 text-sm" value={p.grupo} onChange={(e) => set(i, { grupo: e.target.value as GrupoPlan })} options={(Object.keys(GRUPOS_PLAN) as GrupoPlan[]).map((g) => ({ value: g, label: GRUPOS_PLAN[g] }))} />
              <Input className="w-28" value={p.referencia ?? ''} onChange={(e) => set(i, { referencia: e.target.value })} placeholder="PGI-xx" />
              <span className="flex">
                <button type="button" aria-label="Subir" className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Bajar" className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30" disabled={i === puntos.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="Eliminar punto" className="p-1 text-zinc-400 hover:text-red-600" onClick={() => setPuntos((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
            <div className="mt-2 pl-8">
              <RequisitoPicker
                normas={[...NORMAS]}
                value={p.requisitos.map((k) => idPorClave.get(k)).filter((x): x is string => !!x)}
                onChange={(ids) => set(i, { requisitos: ids.map((id) => mapa.requisitos[id]).filter(Boolean).map((r) => `${r.norma}|${r.clausula}`) })}
              />
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-3" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPuntos((ps) => [...ps, { id: nuevoIdPunto(), titulo: '', grupo: 'operacion', requisitos: [], referencia: null }])}>
        Agregar punto
      </Button>
    </Modal>
  );
}
