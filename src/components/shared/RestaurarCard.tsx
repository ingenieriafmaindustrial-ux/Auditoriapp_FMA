import { useRef, useState } from 'react';
import { ArchiveRestore, FileUp, ShieldAlert } from 'lucide-react';
import { Alerta, Button, Card, Input, Modal } from '../ui';
import { Segmentado } from './Filtros';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { fmtFechaHora } from '../../lib/dates';
import { analizarRestauracion, ejecutarRestauracion, leerArchivoRespaldo, type Analisis, type ModoRestauracion } from '../../services/restaurar';

const PALABRA = 'RESTAURAR';

/** Restaurar desde un respaldo JSON (solo administrador TI): análisis previo, respaldo de seguridad automático y doble confirmación. */
export function RestaurarCard() {
  const u = useUsuario();
  const notify = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [modo, setModo] = useState<ModoRestauracion>('faltantes');
  const [confirmar, setConfirmar] = useState(false);
  const [texto, setTexto] = useState('');
  const [progreso, setProgreso] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const elegir = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setTrabajando(true);
    setAnalisis(null);
    try {
      const r = await leerArchivoRespaldo(file);
      setAnalisis(await analizarRestauracion(u, r, setProgreso));
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setTrabajando(false);
      setProgreso('');
    }
  };

  const aEscribir = analisis ? (modo === 'todo' ? analisis.totalFaltan + analisis.totalExistentes : analisis.totalFaltan) : 0;

  return (
    <Card title={<span className="flex items-center gap-2"><ArchiveRestore className="h-4 w-4" /> Restaurar desde respaldo</span>}>
      <p className="text-sm text-zinc-600">
        Recupera registros desde un respaldo <b>.json</b> de la app. <b>Nunca borra</b> datos actuales y, antes de escribir, descarga automáticamente un respaldo del estado actual por si necesitas volver atrás.
      </p>
      <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button icon={<FileUp className="h-4 w-4" />} loading={trabajando && !confirmar} disabled={trabajando} onClick={() => input.current?.click()}>Elegir respaldo .json</Button>
        {progreso && <span className="text-xs text-zinc-500">{progreso}</span>}
      </div>

      {analisis && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-700">
            Respaldo del <b>{fmtFechaHora(analisis.respaldo.generado)}</b>, generado por {analisis.respaldo.generadoPor.nombre}{analisis.respaldo.incluyeFotos ? ' (incluye fotos)' : ''}.
          </p>
          <div className="table-wrap">
            <table className="tabla">
              <thead><tr><th>Colección</th><th className="text-right">En respaldo</th><th className="text-right">Ya existen</th><th className="text-right">Faltan hoy</th></tr></thead>
              <tbody>
                {analisis.filas.map((f) => (
                  <tr key={f.ruta}>
                    <td>{f.ruta}</td>
                    <td className="text-right">{f.enRespaldo}</td>
                    <td className="text-right">{f.existentes}</td>
                    <td className={'text-right ' + (f.faltan ? 'font-bold text-amber-700' : '')}>{f.faltan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Segmentado
            etiqueta="Modo de restauración"
            valor={modo}
            onChange={setModo}
            opciones={[{ v: 'faltantes', label: `Solo lo que falta (${analisis.totalFaltan})` }, { v: 'todo', label: `Sobrescribir todo (${analisis.totalFaltan + analisis.totalExistentes})` }]}
          />
          {modo === 'todo' ? (
            <Alerta tipo="error">“Sobrescribir todo” devuelve <b>cada registro</b> del respaldo a como estaba ese día: se pierden los cambios hechos después (tratamientos, verificaciones, estados). Úsalo solo si la base quedó dañada.</Alerta>
          ) : (
            <Alerta tipo="info">“Solo lo que falta” recrea los registros eliminados y no toca nada de lo existente. Es la opción segura.</Alerta>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" icon={<ShieldAlert className="h-4 w-4" />} disabled={!aEscribir || trabajando} onClick={() => { setTexto(''); setConfirmar(true); }}>
              Restaurar {aEscribir} registro(s)
            </Button>
            <Button onClick={() => setAnalisis(null)} disabled={trabajando}>Cancelar</Button>
          </div>
        </div>
      )}

      <Modal
        open={confirmar}
        onClose={() => !trabajando && setConfirmar(false)}
        title="Confirmar restauración"
        footer={
          <>
            <Button onClick={() => setConfirmar(false)} disabled={trabajando}>Cancelar</Button>
            <Button
              variant="danger"
              loading={trabajando}
              disabled={texto.trim().toUpperCase() !== PALABRA}
              onClick={async () => {
                if (!analisis) return;
                setTrabajando(true);
                try {
                  const n = await ejecutarRestauracion(u, analisis, modo, setProgreso);
                  notify(`Restauración completa: ${n} registro(s). Se descargó un respaldo previo de seguridad.`);
                  setConfirmar(false);
                  setAnalisis(null);
                } catch (e) {
                  notify(errorMensaje(e), 'error');
                } finally {
                  setTrabajando(false);
                  setProgreso('');
                }
              }}
            >
              Restaurar ahora
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>Se escribirán <b>{aEscribir}</b> registro(s) en modo <b>{modo === 'todo' ? 'sobrescribir todo' : 'solo lo que falta'}</b>. Primero se descargará un respaldo del estado actual.</p>
          <label className="block">
            <span className="label">Para confirmar, escribe <b className="normal-case text-zinc-900">{PALABRA}</b></span>
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PALABRA} autoFocus />
          </label>
          {progreso && <p className="text-xs text-zinc-500">{progreso}</p>}
        </div>
      </Modal>
    </Card>
  );
}
