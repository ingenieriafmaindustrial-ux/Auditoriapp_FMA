import { useState } from 'react';
import { ClipboardCheck, FileCheck2, FileText } from 'lucide-react';
import { ayudaMemoria, MODO_TXT } from '../../data/infoDocumentada';
import { cn } from '../../lib/utils';
import type { Norma } from '../../types';

/** Ayuda memoria para el auditor: ¿el área mantiene (documento vigente) o conserva (registro) información documentada sobre este tema? */
export function AyudaMemoria({ norma, clausula, compacto = false }: { norma: Norma; clausula: string; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const it = ayudaMemoria(norma, clausula);
  if (!it) return null;
  const Icono = it.modo === 'mantener' ? FileText : FileCheck2;
  return (
    <div className={cn('ayuda-mem', `ayuda-mem--${it.modo}`, compacto && 'ayuda-mem--compacto')}>
      <button type="button" className="ayuda-mem-cab" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <ClipboardCheck className="h-3.5 w-3.5" />
        <span>Ayuda memoria</span>
        <b><Icono className="h-3 w-3" /> {MODO_TXT[it.modo].titulo} info. documentada</b>
        <i>{abierto ? 'ocultar' : 'ver qué revisar'}</i>
      </button>
      {abierto && (
        <div className="ayuda-mem-cuerpo">
          <p><b>{MODO_TXT[it.modo].titulo}:</b> {MODO_TXT[it.modo].idea}</p>
          <p><b>Pregúntale al área:</b> ¿mantiene/conserva documentación sobre este tema? Revisa: {it.revisar}</p>
          {it.nota && <p className="ayuda-mem-nota">{it.nota}</p>}
        </div>
      )}
    </div>
  );
}
