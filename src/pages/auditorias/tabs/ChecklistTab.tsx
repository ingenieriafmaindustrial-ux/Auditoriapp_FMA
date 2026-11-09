import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { Alerta, Button, EmptyState, ErrorList, Field, Modal, Spinner, Textarea } from '../../../components/ui';
import { RequisitoPicker } from '../../../components/shared/RequisitoPicker';
import { EvidenciasPanel } from '../../../components/shared/EvidenciasPanel';
import { Hojas } from '../../../components/layout/SheetTabs';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useEvidencias } from '../../../hooks/useAuditoriaData';
import { RESULTADOS_CHECKLIST } from '../../../lib/constants';
import { cn, errorMensaje } from '../../../lib/utils';
import { checklistEditable, hallazgoDescripcionEditable, progresoChecklist } from '../../../domain/auditoriaReglas';
import { agregarItemsChecklist, actualizarItemChecklist, eliminarItemChecklist } from '../../../services/auditorias';
import { HallazgoFormModal, type HallazgoPrefill } from '../../hallazgos/HallazgoFormModal';
import type { Auditoria, ChecklistItem, ResultadoChecklist } from '../../../types';

const colores: Record<ResultadoChecklist, string> = {
  pendiente: 'border-zinc-300 bg-surface text-zinc-600',
  conforme: 'border-emerald-600 bg-emerald-600 text-white',
  NC: 'border-red-600 bg-red-600 text-white',
  OM: 'border-sky-600 bg-sky-600 text-white',
  no_aplica: 'border-zinc-500 bg-zinc-500 text-white',
};

function ItemCard({ a, item, editable, onCrearHallazgo, evidencias }: { a: Auditoria; item: ChecklistItem; editable: boolean; onCrearHallazgo: (i: ChecklistItem) => void; evidencias: ReturnType<typeof useEvidencias>['data'] }) {
  const notify = useToast();
  const { mapa } = useData();
  const u = useUsuario();
  const [obs, setObs] = useState(item.evidenciaObservada);

  const guardar = async (cambios: Partial<ChecklistItem>) => {
    try {
      await actualizarItemChecklist(a.id, item.id, { ...cambios, auditorId: u.auditorId });
    } catch (e) {
      notify(errorMensaje(e), 'error');
    }
  };
  const hallazgo = item.hallazgoId;

  return (
    <li className="rounded-xl border border-zinc-200 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded bg-panel px-1.5 text-xs font-bold text-brand">{item.orden + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.pregunta}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {item.requisitoIds.map((id) => (mapa.requisitos[id] ? `${mapa.requisitos[id].norma} ${mapa.requisitos[id].clausula}` : '')).filter(Boolean).join(' · ')}
          </p>
        </div>
        {editable && !hallazgo && (
          <button aria-label="Eliminar ítem" className="p-1 text-zinc-400 hover:text-red-600" onClick={async () => { if (confirm('¿Eliminar este ítem del checklist?')) { try { await eliminarItemChecklist(a.id, item.id); } catch (e) { notify(errorMensaje(e), 'error'); } } }}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(Object.keys(RESULTADOS_CHECKLIST) as ResultadoChecklist[]).map((r) => (
          <button
            key={r}
            disabled={!editable || (!!hallazgo && r !== item.resultado)}
            onClick={() => guardar({ resultado: r })}
            className={cn('rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed', item.resultado === r ? colores[r] : 'border-zinc-200 bg-surface text-zinc-500 hover:border-zinc-400', !editable && item.resultado !== r && 'opacity-40')}
          >
            {RESULTADOS_CHECKLIST[r]}
          </button>
        ))}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Textarea rows={2} placeholder="Evidencia observada (qué se revisó, registros, entrevistas…)" value={obs} disabled={!editable} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== item.evidenciaObservada && guardar({ evidenciaObservada: obs })} />
        <EvidenciasPanel compacto auditoria={a} evidencias={evidencias.filter((e) => e.checklistItemId === item.id)} checklistItemId={item.id} editable={editable} />
      </div>

      {(item.resultado === 'NC' || item.resultado === 'OM') && (
        <div className="mt-2">
          {hallazgo ? (
            <Link to={`/hallazgos/${hallazgo}`} className="text-xs font-semibold text-zinc-700 underline">Ver hallazgo vinculado →</Link>
          ) : hallazgoDescripcionEditable(a.estado) ? (
            <Button size="sm" variant="dark" onClick={() => onCrearHallazgo({ ...item, evidenciaObservada: obs })}>
              Crear hallazgo {item.resultado}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

export default function ChecklistTab({ a, items, loading }: { a: Auditoria; items: ChecklistItem[]; loading: boolean }) {
  const notify = useToast();
  const { mapa } = useData();
  const evid = useEvidencias(a.id);
  const [filtro, setFiltro] = useState('todos');
  const [modal, setModal] = useState<'clausulas' | 'libre' | null>(null);
  const [reqSel, setReqSel] = useState<string[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [prefill, setPrefill] = useState<HallazgoPrefill | null>(null);
  const editable = checklistEditable(a.estado);
  const prog = progresoChecklist(items);

  const visibles = useMemo(
    () => items.filter((i) => filtro === 'todos' || (filtro === 'pendientes' ? i.resultado === 'pendiente' : i.resultado === 'NC' || i.resultado === 'OM')),
    [items, filtro],
  );

  async function agregar() {
    setErrores([]);
    const orden = items.length ? Math.max(...items.map((i) => i.orden)) + 1 : 0;
    try {
      if (modal === 'clausulas') {
        if (!reqSel.length) return setErrores(['Seleccione al menos una cláusula.']);
        const nuevos = reqSel
          .map((id) => mapa.requisitos[id])
          .filter(Boolean)
          .sort((x, y) => x.orden - y.orden)
          .map((r) => ({ pregunta: `¿Se cumple ${r.norma} ${r.clausula} «${r.titulo}»? Revisar evidencia objetiva.`, requisitoIds: [r.id] }));
        await agregarItemsChecklist(a, nuevos, orden);
        notify(`${nuevos.length} ítem(s) agregados`);
      } else {
        if (pregunta.trim().length < 5) return setErrores(['Escriba la pregunta.']);
        await agregarItemsChecklist(a, [{ pregunta: pregunta.trim(), requisitoIds: reqSel }], orden);
        notify('Ítem agregado');
      }
      setModal(null);
      setReqSel([]);
      setPregunta('');
    } catch (e) {
      setErrores([errorMensaje(e)]);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      {!editable && <Alerta tipo="info">El checklist solo se edita con la auditoría Planificada o En ejecución (RN-09).</Alerta>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex justify-between text-xs text-zinc-600">
            <span>Avance</span>
            <span>{prog.hechos}/{prog.total} · {prog.pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" icon={<ListPlus className="h-4 w-4" />} onClick={() => { setReqSel([]); setModal('clausulas'); }}>Desde cláusulas</Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => { setReqSel([]); setModal('libre'); }}>Pregunta libre</Button>
          </div>
        )}
      </div>

      <Hojas
        activa={filtro}
        onChange={setFiltro}
        hojas={[
          { key: 'todos', label: 'Todos', badge: items.length },
          { key: 'pendientes', label: 'Pendientes', badge: items.filter((i) => i.resultado === 'pendiente').length },
          { key: 'hallazgos', label: 'NC / OM', badge: items.filter((i) => i.resultado === 'NC' || i.resultado === 'OM').length },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState title="Checklist vacío">Agrega preguntas desde las cláusulas de las normas de esta auditoría o escribe preguntas libres.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {visibles.map((it) => (
            <ItemCard key={it.id} a={a} item={it} editable={editable} evidencias={evid.data} onCrearHallazgo={(i) => setPrefill({ tipo: i.resultado === 'OM' ? 'OM' : 'NC', requisitoIds: i.requisitoIds, descripcion: i.evidenciaObservada, checklistItemId: i.id })} />
          ))}
        </ul>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="lg"
        title={modal === 'clausulas' ? 'Agregar ítems desde cláusulas' : 'Agregar pregunta libre'}
        footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button variant="primary" onClick={agregar}>Agregar</Button></>}
      >
        <div className="space-y-3">
          {modal === 'libre' && (
            <Field label="Pregunta">
              <Textarea value={pregunta} onChange={(e) => setPregunta(e.target.value)} autoFocus />
            </Field>
          )}
          <Field label={modal === 'clausulas' ? 'Cláusulas (1 ítem por cláusula)' : 'Requisitos relacionados (opcional)'}>
            <RequisitoPicker value={reqSel} onChange={setReqSel} normas={a.normas} />
          </Field>
          <ErrorList errores={errores} />
        </div>
      </Modal>

      {prefill && <HallazgoFormModal open auditoria={a} prefill={prefill} onClose={() => setPrefill(null)} />}
    </div>
  );
}
