import { useEffect, useState } from 'react';
import { FileDown, RotateCcw } from 'lucide-react';
import { Button, Field, Input, Modal, Textarea } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { NORMAS, NORMA_VERSION } from '../../lib/constants';
import { errorMensaje } from '../../lib/utils';
import { TIPO_PROGRAMA, iniciales, type EventoAuditoria } from '../../domain/programa';
import { descargarProgramaPdf } from '../../services/programaExport';
import type { CeldaPrograma } from '../../domain/programaPdf';
import type { Area, Sucursal, TipoProgramado } from '../../types';

const CLAVE = 'fma-programa-presentacion';

const presentacionPorDefecto = (anio: number) =>
  `En cumplimiento de la cláusula 9.2 de las normas ${NORMAS.map((n) => NORMA_VERSION[n]).join(', ')}, y siguiendo las directrices de la norma ISO 19011:2018, FMA Industrial establece el presente Programa Anual de Auditorías Internas ${anio} para su Sistema de Gestión Integrado de Calidad, Medio Ambiente y Seguridad y Salud en el Trabajo.

El programa define las áreas a auditar, las fechas planificadas y el equipo auditor responsable de cada actividad, considerando la importancia de los procesos, los resultados de auditorías anteriores y los cambios que afectan a la organización. Incluye, además, las actividades de seguimiento de los hallazgos y la medición de la eficacia de las acciones correctivas implementadas.

Las fechas podrán ajustarse por razones operacionales, lo que será informado oportunamente a los responsables de cada área. Se solicita a las jefaturas brindar las facilidades necesarias para el desarrollo de las auditorías y la disponibilidad del personal involucrado.`;

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/** Plantilla del programa anual en PDF: logo, presentación justificada, calendario con áreas y responsables, firmas. */
export function ExportarProgramaModal({ open, onClose, anio, eventos, grupos, alcanceTxt }: {
  open: boolean;
  onClose: () => void;
  anio: number;
  eventos: EventoAuditoria[];
  grupos: { sucursal: Sucursal | null; areas: Area[] }[];
  alcanceTxt: string;
}) {
  const u = useUsuario();
  const notify = useToast();
  const { mapa } = useData();
  const [titulo, setTitulo] = useState('Programa anual de auditorías internas');
  const [texto, setTexto] = useState('');
  const [elaborado, setElaborado] = useState(u.nombre);
  const [aprobado, setAprobado] = useState('');
  const [detalle, setDetalle] = useState(true);
  const [eneFeb, setEneFeb] = useState(false);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const guardado = leer();
    setTexto(guardado ? guardado.replace(/\b20\d\d\b(?=\s+para su Sistema)/, String(anio)) : presentacionPorDefecto(anio));
    setEneFeb(eventos.some((e) => Number(e.fecha.slice(5, 7)) <= 2));
  }, [open, anio, eventos]);

  const vigentes = eventos.filter((e) => e.estado !== 'cancelada');

  const descargar = async () => {
    setBajando(true);
    try {
      try {
        localStorage.setItem(CLAVE, texto);
      } catch {
        /* sin almacenamiento: no se recuerda el texto */
      }
      // Siglas únicas por auditor (dos personas con las mismas iniciales reciben un número)
      const ids = [...new Set(vigentes.flatMap((e) => [e.liderId, ...e.equipoIds]).filter(Boolean))];
      const usadas: Record<string, number> = {};
      const sigla: Record<string, string> = {};
      ids
        .map((id) => ({ id, nombre: mapa.auditores[id]?.nombre ?? '?' }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .forEach(({ id, nombre }) => {
          const base = iniciales(nombre);
          usadas[base] = (usadas[base] ?? 0) + 1;
          sigla[id] = usadas[base] > 1 ? `${base}${usadas[base]}` : base;
        });
      const equipoTxt = (e: EventoAuditoria) => [e.liderId, ...e.equipoIds.filter((x) => x !== e.liderId)].filter(Boolean).map((id) => sigla[id]).join('/');
      const meses = Array.from({ length: 12 }, (_, i) => i).filter((i) => eneFeb || i >= 2);

      await descargarProgramaPdf({
        anio,
        titulo: titulo.trim() || 'Programa anual de auditorías internas',
        presentacion: texto,
        alcanceTxt,
        meses,
        grupos: grupos
          .filter((g) => g.areas.length)
          .map((g) => ({
            sucursal: g.sucursal?.nombre ?? 'Sin sucursal',
            areas: g.areas.map((a) => {
              const celdas: Record<number, CeldaPrograma[]> = {};
              vigentes
                .filter((e) => e.areaId === a.id)
                .forEach((e) => {
                  const m = Number(e.fecha.slice(5, 7)) - 1;
                  (celdas[m] ??= []).push({ dia: e.fecha.slice(8, 10), letra: TIPO_PROGRAMA[e.tipo].letra, equipo: equipoTxt(e) });
                });
              return { nombre: a.nombre, celdas };
            }),
          })),
        detalle: vigentes.map((e) => ({
          fecha: `${e.fecha.slice(8, 10)}-${e.fecha.slice(5, 7)}-${e.fecha.slice(0, 4)}`,
          tipo: TIPO_PROGRAMA[e.tipo].label,
          area: mapa.areas[e.areaId]?.nombre ?? '—',
          sucursal: mapa.sucursales[e.sucursalId]?.nombre ?? '—',
          lider: mapa.auditores[e.liderId]?.nombre ?? '—',
          equipo: e.equipoIds.filter((x) => x !== e.liderId).map((id) => mapa.auditores[id]?.nombre ?? '—').join(', '),
        })),
        siglas: ids.map((id) => ({ sigla: sigla[id], nombre: mapa.auditores[id]?.nombre ?? '?' })).sort((a, b) => a.sigla.localeCompare(b.sigla)),
        tipos: (Object.keys(TIPO_PROGRAMA) as TipoProgramado[]).map((k) => ({ letra: TIPO_PROGRAMA[k].letra, label: TIPO_PROGRAMA[k].label })),
        normas: NORMAS.map((n) => NORMA_VERSION[n]).join(' · '),
        elaboradoPor: elaborado.trim(),
        aprobadoPor: aprobado.trim(),
        emitido: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'),
        incluirDetalle: detalle,
      });
      notify('Programa descargado en PDF');
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
      size="lg"
      title={`Exportar programa ${anio} (PDF)`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<FileDown className="h-4 w-4" />} loading={bajando} disabled={!vigentes.length} onClick={descargar}>Descargar PDF</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Se exportan {vigentes.length} actividad(es) de {alcanceTxt.toLowerCase()} según los filtros activos (las canceladas no se incluyen). El PDF lleva logo, esta presentación con texto justificado, el calendario por área y mes con quién la realiza, la leyenda y las firmas.
        </p>
        <Field label="Título del documento">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
        <Field label="Texto de presentación" hint="Cada salto de línea es un párrafo. Se recuerda para la próxima exportación.">
          <Textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Field>
        <button type="button" onClick={() => setTexto(presentacionPorDefecto(anio))} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900">
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar texto sugerido
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Elaborado por">
            <Input value={elaborado} onChange={(e) => setElaborado(e.target.value)} />
          </Field>
          <Field label="Aprobado por">
            <Input value={aprobado} onChange={(e) => setAprobado(e.target.value)} placeholder="Ej.: Gerente General" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-zinc-700">
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={detalle} onChange={(e) => setDetalle(e.target.checked)} /> Incluir detalle (lista por fecha)</label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={eneFeb} onChange={(e) => setEneFeb(e.target.checked)} /> Incluir enero y febrero</label>
        </div>
      </div>
    </Modal>
  );
}
