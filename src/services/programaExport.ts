import { imagenAJpeg } from '../lib/pdf';
import { construirProgramaPdf, type DatosProgramaPdf } from '../domain/programaPdf';

export async function descargarProgramaPdf(p: DatosProgramaPdf) {
  const bytes = construirProgramaPdf(p, await imagenAJpeg('/logo-fma.png'));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Programa anual de auditorias ${p.anio}${p.alcanceTxt && !p.alcanceTxt.startsWith('Todas') ? ' - ' + p.alcanceTxt : ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
