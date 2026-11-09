import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { anioActual, ANIO_INICIO, fmtFecha, hoyISO } from '../../lib/dates';
import { errorMensaje } from '../../lib/utils';
import { datosInformeAnual } from '../../domain/informeAnual';
import { descargarInformeAnual } from '../../services/informeAnualExport';

const CLAVE = 'fma-informe-anual';
const leer = (): { conclusiones?: string; aprobadoPor?: string } => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
  } catch {
    return {};
  }
};

/** Informe anual del programa de auditorías (PDF con gráficos) para la revisión por la dirección. */
export function InformeAnualModal({ open, onClose, anioInicial, sucursalInicial }: { open: boolean; onClose: () => void; anioInicial: number | null; sucursalInicial: string }) {
  const u = useUsuario();
  const notify = useToast();
  const { hallazgos, auditorias, programa, areas, sucursales, mapa } = useData();
  const [anio, setAnio] = useState(anioActual());
  const [sucursal, setSucursal] = useState('');
  const [conclusiones, setConclusiones] = useState('');
  const [elaborado, setElaborado] = useState('');
  const [aprobado, setAprobado] = useState('');
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = leer();
    setAnio(anioInicial ?? anioActual());
    setSucursal(sucursalInicial);
    setConclusiones(g.conclusiones ?? '');
    setAprobado(g.aprobadoPor ?? '');
    setElaborado(u.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const anios = useMemo(() => {
    const max = Math.max(anioActual(), ...hallazgos.map((h) => h.anio));
    return Array.from({ length: max - ANIO_INICIO + 1 }, (_, i) => max - i);
  }, [hallazgos]);

  const datos = useMemo(
    () => (open ? datosInformeAnual({ anio, sucursalId: sucursal, hallazgos, auditorias, programa, areas, mapa, textos: { conclusiones, elaboradoPor: elaborado, aprobadoPor: aprobado, emitido: fmtFecha(hoyISO()) } }) : null),
    [open, anio, sucursal, hallazgos, auditorias, programa, areas, mapa, conclusiones, elaborado, aprobado],
  );

  const generar = async () => {
    if (!datos) return;
    setGenerando(true);
    try {
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ conclusiones, aprobadoPor: aprobado }));
      } catch {
        /* sin almacenamiento local: no es crítico */
      }
      await descargarInformeAnual(datos);
      notify('Informe anual descargado');
      onClose();
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Informe anual de auditorías"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<FileText className="h-4 w-4" />} loading={generando} onClick={generar}>Descargar PDF</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">PDF con logo, resumen ejecutivo, cumplimiento del programa, gráficos de hallazgos, evolución de tres años, NC vencidas, eficacia, conclusiones y firmas. Insumo para la revisión por la dirección (cl. 9.3).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Año">
            <Select value={String(anio)} onChange={(e) => setAnio(Number(e.target.value))} options={anios.map((y) => ({ value: String(y), label: String(y) }))} />
          </Field>
          <Field label="Alcance">
            <Select value={sucursal} onChange={(e) => setSucursal(e.target.value)} options={[{ value: '', label: 'Todas las sucursales' }, ...sucursales.filter((s) => s.activo).map((s) => ({ value: s.id, label: s.nombre }))]} />
          </Field>
        </div>
        {datos && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 ring-1 ring-zinc-200 sm:grid-cols-4">
            <span><b className="block text-base text-zinc-900">{datos.kpi.auditorias}</b>auditorías</span>
            <span><b className="block text-base text-zinc-900">{datos.kpi.hallazgos}</b>{datos.kpi.nc} NC · {datos.kpi.om} OM</span>
            <span><b className="block text-base text-zinc-900">{datos.kpi.pctTratados}%</b>tratados</span>
            <span><b className={`block text-base ${datos.kpi.ncVencidas ? 'text-red-700' : 'text-ink'}`}>{datos.kpi.ncVencidas}</b>NC vencidas</span>
          </div>
        )}
        <Field label="Resumen automático" hint="Se genera con los datos; aparece al inicio del informe.">
          <p className="whitespace-pre-line rounded-md border border-zinc-200 bg-surface p-3 text-xs leading-relaxed text-zinc-700">{datos?.resumen}</p>
        </Field>
        <Field label="Conclusiones y recomendaciones para la dirección" hint="Texto justificado en el informe. Se recuerda para la próxima vez.">
          <Textarea rows={5} value={conclusiones} onChange={(e) => setConclusiones(e.target.value)} placeholder="Ej.: Se recomienda reforzar el control de información documentada en Producción, área con NC recurrentes en los últimos tres años…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Elaborado por">
            <Input value={elaborado} onChange={(e) => setElaborado(e.target.value)} />
          </Field>
          <Field label="Aprobado por">
            <Input value={aprobado} onChange={(e) => setAprobado(e.target.value)} placeholder="Ej.: Gerente General" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
