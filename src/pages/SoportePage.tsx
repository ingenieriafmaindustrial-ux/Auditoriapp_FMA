import { useState } from 'react';
import { Bug, Check, ChevronDown, MessageSquareText, RotateCcw, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { Segmentado } from '../components/shared/Filtros';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMensaje } from '../lib/utils';
import { fmtFechaHora } from '../lib/dates';
import { VERSION_APP } from '../lib/errores';
import { eliminarError, eliminarReporte, marcarErrorRevisado, marcarReporteRevisado } from '../services/soporte';

const ORIGEN: Record<string, string> = { operacion: 'Al guardar / operar', pantalla: 'Error de pantalla', promesa: 'Proceso en segundo plano', render: 'Pantalla no se pudo mostrar' };

/** Soporte (solo administrador TI): errores registrados automáticamente y reportes enviados por los usuarios. */
export default function SoportePage() {
  const { soporte } = useData();
  const notify = useToast();
  const [vista, setVista] = useState<'reportes' | 'errores'>('reportes');
  const [verRevisados, setVerRevisados] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const accion = (p: Promise<unknown>, ok: string) => p.then(() => notify(ok)).catch((e) => notify(errorMensaje(e), 'error'));
  const nRep = soporte.reportes.filter((r) => r.estado === 'nuevo').length;
  const nErr = soporte.errores.filter((e) => !e.revisado).length;
  const reportes = soporte.reportes.filter((r) => verRevisados || r.estado === 'nuevo');
  const errores = soporte.errores.filter((e) => verRevisados || !e.revisado);

  return (
    <div className="space-y-4">
      <PageHeader title="Soporte" subtitle={`Errores de la app y reportes del equipo · versión en uso ${VERSION_APP}`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentado
          etiqueta="Vista"
          valor={vista}
          onChange={setVista}
          opciones={[
            { v: 'reportes', label: <><MessageSquareText className="h-3.5 w-3.5" /> Reportes{nRep ? ` (${nRep})` : ''}</> },
            { v: 'errores', label: <><Bug className="h-3.5 w-3.5" /> Errores{nErr ? ` (${nErr})` : ''}</> },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={verRevisados} onChange={(e) => setVerRevisados(e.target.checked)} />
          Mostrar también los revisados
        </label>
      </div>

      {vista === 'reportes' ? (
        reportes.length === 0 ? (
          <Card><EmptyState title="Sin reportes pendientes">Cuando un auditor use “Reportar un problema” o “Contar qué pasó”, aparecerá aquí.</EmptyState></Card>
        ) : (
          <ul className="space-y-3">
            {reportes.map((r) => (
              <li key={r.id} className={'card p-4 ' + (r.estado === 'revisado' ? 'opacity-60' : '')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{r.usuarioNombre} <span className="font-normal text-zinc-500">· {fmtFechaHora(r.fecha)}</span></p>
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">{r.descripcion}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" icon={r.estado === 'nuevo' ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} onClick={() => accion(marcarReporteRevisado(r.id, r.estado === 'nuevo'), r.estado === 'nuevo' ? 'Marcado como revisado' : 'Marcado como nuevo')}>
                      {r.estado === 'nuevo' ? 'Revisado' : 'Reabrir'}
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Eliminar reporte" onClick={() => accion(eliminarReporte(r.id), 'Reporte eliminado')} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Pantalla {r.ruta}{r.accion ? ` · última acción ${r.accion}` : ''} · {r.dispositivo} · versión {r.version}</p>
                {r.errores.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-700">
                    {r.errores.map((e, i) => <li key={i}>• {e.mensaje}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      ) : errores.length === 0 ? (
        <Card><EmptyState title="Sin errores pendientes">La app registra aquí, de forma automática, cualquier falla que tengan los usuarios.</EmptyState></Card>
      ) : (
        <ul className="space-y-3">
          {errores.map((e) => (
            <li key={e.id} className={'card p-4 ' + (e.revisado ? 'opacity-60' : '')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{e.veces}×</span>
                    <span>{ORIGEN[e.origen] ?? e.origen}</span>
                    <span>· última vez {fmtFechaHora(e.ultimaVez)}</span>
                    {e.codigo && <span className="font-mono">· {e.codigo}</span>}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-zinc-900">{e.mensaje}</p>
                  <p className="mt-1 text-xs text-zinc-500">Pantalla {e.ruta}{e.accion ? ` · ${e.accion}` : ''} · {e.usuarios.join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" icon={!e.revisado ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} onClick={() => accion(marcarErrorRevisado(e.id, !e.revisado), !e.revisado ? 'Marcado como revisado' : 'Marcado como nuevo')}>
                    {!e.revisado ? 'Revisado' : 'Reabrir'}
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Eliminar error" onClick={() => accion(eliminarError(e.id), 'Error eliminado')} />
                </div>
              </div>
              <button type="button" onClick={() => setAbierto(abierto === e.id ? null : e.id)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900">
                <ChevronDown className={'h-3.5 w-3.5 transition ' + (abierto === e.id ? 'rotate-180' : '')} /> Detalle técnico
              </button>
              {abierto === e.id && (
                <div className="mt-2 space-y-1 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
                  <p>{e.dispositivo} · versión {e.version} · mes {e.mes}</p>
                  {e.detalle && <p>Contexto: {e.detalle}</p>}
                  {e.stack && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-600">{e.stack}</pre>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">Los errores iguales se agrupan por mes (“veces”). Marca como revisado lo que ya entendiste o corregiste; si vuelve a ocurrir, reaparece como nuevo.</p>
    </div>
  );
}
