import { useState } from 'react';
import { CheckCircle2, DatabaseBackup, FileJson, FileSpreadsheet } from 'lucide-react';
import { Alerta, Button, Card } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { fmtFechaHora } from '../../lib/dates';
import { DIAS_RECORDAR_RESPALDO } from '../../hooks/usePendientes';
import { descargarRespaldoExcel, descargarRespaldoJson, leerRespaldo, registrarRespaldo, type VerificacionRespaldo } from '../../services/respaldo';

const ETIQUETA: Record<string, string> = {
  auditorias: 'Auditorías', hallazgos: 'Hallazgos', programa: 'Programa anual', evidencias: 'Fotos (miniaturas)', evidenciasDatos: 'Fotos (completas)',
  areas: 'Áreas', sucursales: 'Sucursales', auditores: 'Auditores', usuarios: 'Usuarios', requisitos: 'Requisitos ISO', bitacora: 'Bitácora',
  aprendizaje: 'Aprendizaje del asistente', contadores: 'Contadores', config: 'Configuración', firmas: 'Firmas',
};
const kb = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Respaldo completo de la base de datos (gestores): descarga, verificación y constancia del último respaldo. */
export function RespaldoCard() {
  const u = useUsuario();
  const { ultimoRespaldo } = useData();
  const notify = useToast();
  const [fotos, setFotos] = useState(false);
  const [trabajando, setTrabajando] = useState<'' | 'json' | 'excel'>('');
  const [progreso, setProgreso] = useState('');
  const [verif, setVerif] = useState<VerificacionRespaldo | null>(null);

  const dias = ultimoRespaldo ? Math.floor((Date.now() - Date.parse(ultimoRespaldo.fecha)) / 86_400_000) : null;
  const atrasado = dias === null || dias >= DIAS_RECORDAR_RESPALDO;

  const generar = async (tipo: 'json' | 'excel') => {
    setTrabajando(tipo);
    setVerif(null);
    try {
      const conFotos = tipo === 'json' && fotos;
      const r = await leerRespaldo(u, conFotos, setProgreso);
      setProgreso(tipo === 'json' ? 'Armando y verificando el JSON…' : 'Armando y verificando el Excel…');
      const v = tipo === 'json' ? descargarRespaldoJson(r) : await descargarRespaldoExcel(r);
      setVerif(v);
      await registrarRespaldo(u, v, conFotos).catch(() => undefined);
      notify(v.ok ? `Respaldo ${tipo === 'json' ? 'JSON' : 'Excel'} descargado y verificado (${v.totalRegistros} registros)` : 'Respaldo descargado con observaciones: revisa el detalle', v.ok ? 'ok' : 'error');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setTrabajando('');
      setProgreso('');
    }
  };

  return (
    <div id="respaldo">
    <Card title={<span className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4" /> Respaldo de datos</span>}>
      <div className={'mb-3 rounded-lg px-3 py-2 text-sm ' + (atrasado ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
        {ultimoRespaldo ? (
          <>Último respaldo: <b>{fmtFechaHora(ultimoRespaldo.fecha)}</b> ({dias === 0 ? 'hoy' : `hace ${dias} día(s)`}) por {ultimoRespaldo.usuarioNombre} · {ultimoRespaldo.tipo.toUpperCase()} · {ultimoRespaldo.totalRegistros} registros{ultimoRespaldo.verificado ? ' · verificado' : ' · con observaciones'}.{atrasado && ' Corresponde hacer uno nuevo.'}</>
        ) : (
          <>Aún no se registra ningún respaldo. Haz el primero ahora.</>
        )}
      </div>
      <p className="text-sm text-zinc-600">
        Descarga una copia de toda la base: auditorías, hallazgos, acciones, verificaciones, programa, catálogos, usuarios y bitácora. Guárdala fuera del PC (carpeta compartida de FMA) y repítelo al menos una vez al mes: la campana te avisará a los {DIAS_RECORDAR_RESPALDO} días.
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

      {verif && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <CheckCircle2 className={'h-4 w-4 ' + (verif.ok ? 'text-emerald-600' : 'text-amber-600')} />
            {verif.ok ? 'Respaldo verificado' : 'Respaldo con observaciones'} · {verif.tipo.toUpperCase()} · {kb(verif.bytes)} · {verif.totalRegistros} registros
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-zinc-600 sm:grid-cols-3">
            {Object.entries(verif.porColeccion).filter(([, n]) => n > 0).map(([c, n]) => (
              <span key={c} className="flex justify-between gap-2"><span>{ETIQUETA[c] ?? c}</span><b className="text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</b></span>
            ))}
            <span className="flex justify-between gap-2"><span>Ítems de checklist</span><b className="text-zinc-900">{verif.subcolecciones.checklist}</b></span>
            <span className="flex justify-between gap-2"><span>Informes emitidos</span><b className="text-zinc-900">{verif.subcolecciones.informes}</b></span>
          </div>
          {verif.problemas.length > 0 && (
            <div className="mt-2"><Alerta tipo="warn">{verif.problemas.join(' · ')}. Revisa que las reglas de Firestore estén publicadas; el resto del respaldo sí se descargó.</Alerta></div>
          )}
        </div>
      )}
    </Card>
    </div>
  );
}
