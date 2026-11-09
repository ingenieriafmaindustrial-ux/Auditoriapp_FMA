import { useState } from 'react';
import { DatabaseBackup, FileJson, FileSpreadsheet } from 'lucide-react';
import { Alerta, Button, Card } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { descargarRespaldoExcel, descargarRespaldoJson, leerRespaldo } from '../../services/respaldo';

/** Respaldo completo de la base de datos (gestores). */
export function RespaldoCard() {
  const u = useUsuario();
  const notify = useToast();
  const [fotos, setFotos] = useState(false);
  const [trabajando, setTrabajando] = useState<'' | 'json' | 'excel'>('');
  const [progreso, setProgreso] = useState('');
  const [errores, setErrores] = useState<string[]>([]);

  const generar = async (tipo: 'json' | 'excel') => {
    setTrabajando(tipo);
    setErrores([]);
    try {
      const r = await leerRespaldo(u, tipo === 'json' && fotos, setProgreso);
      setProgreso(tipo === 'json' ? 'Armando el archivo JSON…' : 'Armando el Excel…');
      if (tipo === 'json') descargarRespaldoJson(r);
      else await descargarRespaldoExcel(r);
      const total = Object.values(r.colecciones).reduce((s, l) => s + l.length, 0);
      setErrores(Object.keys(r.errores));
      notify(`Respaldo ${tipo === 'json' ? 'JSON' : 'Excel'} descargado (${total} registros)`);
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setTrabajando('');
      setProgreso('');
    }
  };

  return (
    <Card title={<span className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4" /> Respaldo de datos</span>}>
      <p className="text-sm text-zinc-600">
        Descarga una copia de toda la base: auditorías, hallazgos, acciones, verificaciones, programa, catálogos, usuarios y bitácora. Guárdela fuera del PC (carpeta compartida o unidad de red) y repita el respaldo al menos una vez al mes.
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
        <li><b>JSON:</b> copia íntegra y restaurable, con checklist e informes emitidos de cada auditoría.</li>
        <li><b>Excel:</b> portada con índice y una hoja por entidad, con filtros; para revisar o entregar a un auditor externo.</li>
      </ul>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
        Incluir las fotos de evidencia en el JSON <span className="text-xs text-zinc-500">(archivo más pesado)</span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<FileJson className="h-4 w-4" />} loading={trabajando === 'json'} disabled={!!trabajando} onClick={() => generar('json')}>Respaldo JSON</Button>
        <Button icon={<FileSpreadsheet className="h-4 w-4" />} loading={trabajando === 'excel'} disabled={!!trabajando} onClick={() => generar('excel')}>Respaldo Excel</Button>
        {progreso && <span className="text-xs text-zinc-500">{progreso}</span>}
      </div>
      {errores.length > 0 && (
        <div className="mt-3">
          <Alerta tipo="warn">No se pudieron leer: {errores.slice(0, 4).join(', ')}{errores.length > 4 ? '…' : ''}. Revise que las reglas de Firestore estén publicadas; el resto del respaldo sí se descargó.</Alerta>
        </div>
      )}
    </Card>
  );
}
