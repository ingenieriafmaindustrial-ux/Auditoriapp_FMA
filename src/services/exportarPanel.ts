// Exportación del panel de control a Excel (carga diferida: el generador solo se descarga al usarlo).
import { descargarBlob } from './informeExport';
import type { DatosReporte } from '../domain/reportePanel';

async function logoPng(): Promise<Uint8Array | null> {
  try {
    const r = await fetch('/logo-fma.png');
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function exportarPanelExcel(datos: Omit<DatosReporte, 'fecha'>) {
  const { construirReportePanel, nombreArchivoReporte } = await import('../domain/reportePanel');
  const fecha = new Date();
  const bytes = construirReportePanel({ ...datos, fecha }, await logoPng());
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  descargarBlob(blob, nombreArchivoReporte(fecha, datos.filtros.anio));
}
