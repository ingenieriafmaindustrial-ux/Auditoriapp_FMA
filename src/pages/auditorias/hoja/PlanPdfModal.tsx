import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from '../../../components/ui';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { errorMensaje } from '../../../lib/utils';
import { descargarPlanPdf } from '../../../services/informeExport';
import type { DatosPlanPdf } from '../../../domain/planPdf';

export type BasePlanPdf = Omit<DatosPlanPdf, 'fecha' | 'equipoAuditor' | 'generadoPor'>;

/**
 * Paso previo a descargar el plan en PDF: equipo auditor y fecha de la auditoría (ambos obligatorios).
 * Sirve para el plan de una auditoría y para el plan (plantilla) de un área.
 */
export function PlanPdfModal({ open, onClose, base, liderId = null, equipoInicial = [], fechaInicial = '', alDescargar }: {
  open: boolean;
  onClose: () => void;
  base: BasePlanPdf;
  liderId?: string | null;
  equipoInicial?: string[];
  fechaInicial?: string;
  alDescargar?: (equipo: string[], fecha: string) => void;
}) {
  const { mapa, auditores } = useData();
  const u = useUsuario();
  const notify = useToast();
  const [equipo, setEquipo] = useState<string[]>(equipoInicial);
  const [fecha, setFecha] = useState<string>(fechaInicial);
  const [intentado, setIntentado] = useState(false);
  const [bajando, setBajando] = useState(false);

  const disponibles = useMemo(() => auditores.filter((x) => x.activo && !equipo.includes(x.id)).map((x) => ({ value: x.id, label: x.nombre })), [auditores, equipo]);
  const errEquipo = !equipo.length ? 'Elige al menos un auditor (puede ser solo el auditor líder).' : null;
  const errFecha = !fecha ? 'Elige la fecha en que se realizará la auditoría.' : null;
  const nombre = (id: string) => mapa.auditores[id]?.nombre ?? '—';

  const descargar = async () => {
    setIntentado(true);
    if (errEquipo || errFecha) return;
    setBajando(true);
    try {
      const nombres = equipo.map(nombre);
      await descargarPlanPdf({ ...base, fecha, equipoAuditor: nombres, generadoPor: u.nombre });
      alDescargar?.(nombres, fecha);
      notify('Plan descargado en PDF');
      onClose();
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setBajando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Exportar plan de auditoría (PDF)${base.area ? ` · ${base.area}` : ''}`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Download className="h-4 w-4" />} loading={bajando} onClick={descargar}>Descargar PDF</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">El PDF mostrará el equipo auditor y la fecha que indiques aquí. Ambos datos son obligatorios.</p>
        <Field label="Equipo auditor a cargo" error={intentado ? errEquipo : null} hint="Puede ser uno o más auditores; también puede auditar solo el auditor líder.">
          <div className="space-y-2">
            <Select
              value=""
              onChange={(e) => e.target.value && setEquipo([...equipo, e.target.value])}
              placeholder={disponibles.length ? 'Agregar auditor…' : 'No hay más auditores activos'}
              options={disponibles}
              disabled={!disponibles.length}
            />
            <div className="flex flex-wrap gap-1.5">
              {equipo.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs font-medium text-white">
                  {nombre(id)}{id === liderId && <em className="not-italic opacity-70"> · líder</em>}
                  <button type="button" onClick={() => setEquipo(equipo.filter((x) => x !== id))} aria-label={`Quitar a ${nombre(id)}`} className="rounded-full p-0.5 hover:bg-white/20"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            {liderId && !(equipo.length === 1 && equipo[0] === liderId) && (
              <button type="button" className="text-xs font-semibold text-violet-600 hover:underline" onClick={() => setEquipo([liderId])}>Solo el auditor líder ({nombre(liderId)})</button>
            )}
          </div>
        </Field>
        <Field label="Fecha de la auditoría" error={intentado ? errFecha : null}>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
