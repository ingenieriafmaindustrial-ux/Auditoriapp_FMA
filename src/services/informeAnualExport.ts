import { imagenAJpeg } from '../lib/pdf';
import { construirInformeAnualPdf, type DatosInformeAnual } from '../domain/informeAnual';

export async function descargarInformeAnual(d: DatosInformeAnual) {
  const bytes = construirInformeAnualPdf(d, await imagenAJpeg('/logo-fma.png'));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe anual auditorias internas ${d.anio}${d.alcance !== 'Todas las sucursales' ? ' - ' + d.alcance : ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
