import { Packer } from 'docx';
import { construirDocumentoInforme, construirDocumentoPlan, type DatosPlanDoc, type ImagenInforme } from '../domain/informeDocx';
import { construirPlanPdf, type DatosPlanPdf } from '../domain/planPdf';
import { imagenAJpeg } from '../lib/pdf';
import { evidenceStore } from './evidencias';
import type { Evidencia, InformeSnapshot } from '../types';

function dataUrlABytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function cargarLogo(): Promise<Uint8Array | null> {
  try {
    const r = await fetch('/logo-fma.png');
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** Descarga el informe .docx (desde borrador o desde una versión emitida). */
export async function descargarInformeWord(s: InformeSnapshot, evidencias: Evidencia[]) {
  const meta = Object.fromEntries(evidencias.map((e) => [e.id, e]));
  const imagenes: Record<string, ImagenInforme> = {};
  await Promise.all(
    s.evidencias.map(async (e) => {
      const datos = await evidenceStore.obtenerImagen(e.id).catch(() => null);
      if (datos) imagenes[e.id] = { data: dataUrlABytes(datos), ancho: meta[e.id]?.ancho ?? 0, alto: meta[e.id]?.alto ?? 0 };
    }),
  );
  const doc = construirDocumentoInforme(s, await cargarLogo(), imagenes);
  descargarBlob(await Packer.toBlob(doc), `Informe auditoria interna ${s.codigo.replace('/', '-')} v${s.version || 'borrador'}.docx`);
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Descarga el plan de auditoría (.docx) para enviarlo al área antes de auditar. */
export async function descargarPlanWord(p: DatosPlanDoc) {
  const doc = construirDocumentoPlan(p, await cargarLogo());
  descargarBlob(await Packer.toBlob(doc), `Plan de auditoria ${p.codigo.replace('/', '-')} - ${p.area}.docx`);
}

/** Descarga el plan de auditoría en PDF, con el equipo auditor y la fecha elegidos. */
export async function descargarPlanPdf(p: DatosPlanPdf) {
  const bytes = construirPlanPdf(p, await imagenAJpeg('/logo-fma.png'));
  descargarBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `Plan de auditoria ${p.codigo ? p.codigo.replace('/', '-') + ' - ' : ''}${p.area}.pdf`);
}
