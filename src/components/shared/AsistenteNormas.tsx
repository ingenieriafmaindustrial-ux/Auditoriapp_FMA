import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, History, PenLine, Plus, Undo2, WandSparkles, X } from 'lucide-react';
import { proponerRedaccion } from '../../domain/asistente/redaccion';
import { useData } from '../../context/DataContext';
import { resumenClausula } from '../../data/resumenClausulas';
import { AyudaMemoria } from './AyudaMemoria';
import { cn } from '../../lib/utils';
import { useAprendizaje } from '../../services/aprendizaje';
import type { Analisis, ClausulaSugerida, Confianza, Motor } from '../../domain/asistente/motor';
import type { Auditoria, Norma, TipoHallazgo } from '../../types';

/**
 * Ícono del asistente: orbe de vidrio azul noche con destello dorado (marca FMA),
 * anillo degradado que gira y chispas que titilan. 100 % SVG + CSS, respeta "reducir movimiento".
 */
export function IconoAsistente({ size = 40, activo = false, className }: { size?: number; activo?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <span className={cn('asis-orb', activo && 'asis-orb--activo', className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <defs>
          <linearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f5c400" />
            <stop offset="45%" stopColor="#7c6cf2" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <radialGradient id={`o${uid}`} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#3b5ea8" />
            <stop offset="55%" stopColor="#16264a" />
            <stop offset="100%" stopColor="#0a1328" />
          </radialGradient>
          <radialGradient id={`g${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe27a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#f5c400" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6c2" />
            <stop offset="100%" stopColor="#f5b800" />
          </linearGradient>
        </defs>
        {/* anillo */}
        <g className="asis-anillo">
          <circle cx="24" cy="24" r="22" fill="none" stroke={`url(#r${uid})`} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="100 38" />
        </g>
        {/* orbe */}
        <circle cx="24" cy="24" r="18" fill={`url(#o${uid})`} />
        <circle cx="24" cy="24" r="17.4" fill="none" stroke="#ffffff" strokeOpacity="0.14" />
        <circle className="asis-halo" cx="24" cy="25" r="11" fill={`url(#g${uid})`} />
        {/* destello principal */}
        <path className="asis-estrella" d="M24 13.5c.9 5.6 3 7.7 8.6 8.6-5.6.9-7.7 3-8.6 8.6-.9-5.6-3-7.7-8.6-8.6 5.6-.9 7.7-3 8.6-8.6Z" fill={`url(#s${uid})`} />
        {/* chispas */}
        <path className="asis-chispa asis-chispa--1" d="M32.5 12.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9Z" fill="#fff3b0" />
        <circle className="asis-chispa asis-chispa--2" cx="16" cy="31.5" r="1.3" fill="#9fd8ff" />
        {/* brillo de vidrio */}
        <ellipse cx="18.5" cy="14.5" rx="6" ry="3" fill="#ffffff" fillOpacity="0.16" transform="rotate(-28 18.5 14.5)" />
      </svg>
    </span>
  );
}

const TONO_TIPO = { NC: 'bg-red-50 text-red-700 ring-red-200', OM: 'bg-sky-50 text-sky-700 ring-sky-200' } as const;
const BARRAS: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 };

/** Barra de señal: ancho = puntaje del motor (0–100 %). La cláusula líder se destaca con barra gruesa y etiqueta. */
function BarraSenal({ c, lider }: { c: ClausulaSugerida; lider: boolean }) {
  const pct = Math.max(4, Math.min(100, Math.round(c.puntaje * 100)));
  return (
    <div className={cn('asis-senal', lider && 'asis-senal--lider', `asis-senal--${c.confianza}`)} title={`Señal ${pct} % · confianza ${c.confianza}`}>
      <div className="asis-senal-pista" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Señal de ${c.norma} ${c.clausula}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <b>{pct}%</b>
      {lider && <em>Señal más fuerte</em>}
    </div>
  );
}

function Medidor({ c }: { c: Confianza }) {
  return (
    <span className="asis-medidor" title={`Confianza ${c}`}>
      {[1, 2, 3].map((i) => <i key={i} className={cn(i <= BARRAS[c] && `on-${c}`)} />)}
      <span className="sr-only">Confianza {c}</span>
    </span>
  );
}

/** Carga el motor (y la memoria histórica) solo cuando se abre un editor de hallazgo. */
function useMotor(): Motor | null {
  const aprendidos = useAprendizaje();
  const [mod, setMod] = useState<typeof import('../../domain/asistente/motor') | null>(null);
  useEffect(() => {
    let vivo = true;
    import('../../domain/asistente/motor').then((m) => vivo && setMod(m));
    return () => { vivo = false; };
  }, []);
  return useMemo(() => (mod ? mod.crearMotor(aprendidos) : null), [mod, aprendidos]);
}

/**
 * Asistente de auditoría: analiza en tiempo real la frase del auditor y la cruza con
 * la biblioteca FMA, las normas ISO, el historial 2023–2026 y lo aprendido de todos los auditores.
 */
/** Párrafo que explica, con lo detectado, por qué la cláusula se relaciona con lo que escribió el auditor. */
function relacion(c: ClausulaSugerida, reincidente: boolean): string {
  const partes: string[] = [];
  const lista = (xs: string[]) => xs.map((x) => `«${x}»`).join(xs.length > 2 ? ', ' : ' y ');
  if (c.terminos.length) partes.push(`Tu descripción menciona ${lista(c.terminos)}, que es precisamente lo que regula esta cláusula de ${c.norma}.`);
  if (c.tipoFMA) partes.push(`En los informes de FMA este tipo de situación («${c.tipoFMA}») se ha levantado contra este requisito.`);
  if (c.previos > 0) partes.push(`${c.previos} hallazgo${c.previos > 1 ? 's' : ''} parecido${c.previos > 1 ? 's' : ''} de auditorías anteriores ${c.previos > 1 ? 'usaron' : 'usó'} esta misma cláusula.`);
  if (c.equivalente) partes.push(`Es el requisito equivalente en ${c.norma}: si la auditoría incluye esa norma, el mismo hecho también la incumple.`);
  if (c.motivos.some((m) => m.startsWith('Reincidencia')) && reincidente)
    partes.push(c.clausula === '10.2' ? 'Como el tema ya se había levantado antes en el área, la acción correctiva anterior no fue eficaz: eso es un incumplimiento de 10.2.' : 'El hallazgo anterior del área usó esta cláusula, por lo que se mantiene el mismo requisito.');
  if (!partes.length) partes.push(`La relación es indirecta: el tema de tu hallazgo coincide con «${c.titulo}». Confírmala leyendo el requisito antes de agregarla.`);
  partes.push(`Para que la ${c.confianza === 'alta' ? 'asociación' : 'asociación (confianza ' + c.confianza + ')'} sea sólida, la condición del hallazgo debe mostrar la evidencia de que no se cumple lo que exige el requisito.`);
  return partes.join(' ');
}

export function AsistenteNormas({ texto, auditoria, hallazgoId, requisitoIds, tipoActual, onAgregar, onTipo, onSugeridas, onRedaccion, onReincidencia }: {
  texto: string;
  auditoria: Auditoria;
  hallazgoId?: string;
  requisitoIds: string[];
  tipoActual: TipoHallazgo;
  onAgregar: (ids: string[]) => void;
  onTipo: (t: TipoHallazgo) => void;
  onSugeridas?: (claves: string[]) => void;
  /** Reemplaza la descripción por la redacción propuesta. */
  onRedaccion?: (texto: string) => void;
  /** Avisa si el texto parece reincidencia en el área (para la escala de impacto). */
  onReincidencia?: (r: boolean) => void;
}) {
  const { requisitos, mapa, hallazgos } = useData();
  const motor = useMotor();
  const diferido = useDeferredValue(texto);
  const [oculto, setOculto] = useState(false);
  const [porque, setPorque] = useState<string | null>(null);
  const [verParecidos, setVerParecidos] = useState(false);
  const [verRedaccion, setVerRedaccion] = useState(false);
  const [anterior, setAnterior] = useState<string | null>(null);

  const idPorClausula = useMemo(() => {
    const m = new Map<string, string>();
    requisitos.filter((r) => r.activo).forEach((r) => m.set(`${r.norma}|${r.clausula}`, r.id));
    return m;
  }, [requisitos]);

  const area = mapa.areas[auditoria.areaId]?.nombre ?? '';
  const sucursal = mapa.sucursales[auditoria.sucursalId]?.nombre ?? '';

  const a: Analisis | null = useMemo(() => {
    if (!motor || diferido.trim().length < 12) return null;
    return motor.analizar(diferido, { normas: auditoria.normas, area, sucursal, anio: auditoria.anio, auditoriaId: auditoria.id, excluirId: hallazgoId });
  }, [motor, diferido, auditoria.normas, auditoria.anio, auditoria.id, area, sucursal, hallazgoId]);

  const sugeridas = useMemo(() => (a ? a.clausulas.filter((c) => c.confianza !== 'baja').map((c) => c.clave) : []), [a]);
  useEffect(() => { onSugeridas?.(sugeridas); }, [sugeridas, onSugeridas]);
  const hayReincidencia = !!a && a.reincidencias.length > 0;
  useEffect(() => { onReincidencia?.(hayReincidencia); }, [hayReincidencia, onReincidencia]);

  const propuesta = useMemo(() => {
    if (!a || diferido.trim().length < 25) return null;
    const elegidas = requisitoIds.map((id) => mapa.requisitos[id]).filter(Boolean).map((r) => ({ norma: r.norma, clausula: r.clausula, titulo: r.titulo }));
    const clausulas = elegidas.length ? elegidas : a.clausulas.filter((c) => c.confianza !== 'baja').slice(0, 2);
    return proponerRedaccion({ texto: diferido, tipo: tipoActual, area, clausulas, referenciasInternas: a.tipos[0]?.tipo.referencias ?? [] });
  }, [a, diferido, requisitoIds, mapa.requisitos, tipoActual, area]);

  const hayAlgo = !!a && (a.clausulas.length > 0 || !!a.clasificacion || a.similares.length > 0 || !!propuesta);
  const memoria = motor ? motor.memoria.historial + motor.memoria.aprendidos : 0;

  if (oculto)
    return (
      <button type="button" onClick={() => setOculto(false)} className="asis-pill" title="Mostrar asistente de auditoría">
        <IconoAsistente size={22} activo={hayAlgo} />
        Asistente de auditoría
        {hayAlgo && <span className="asis-pill-badge">{a!.clausulas.length}</span>}
      </button>
    );

  if (!hayAlgo)
    return (
      <div className="asis-idle">
        <IconoAsistente size={30} activo={!motor} />
        <p className="min-w-0 flex-1 text-xs text-zinc-500">
          <b className="text-zinc-700">Asistente de auditoría.</b>{' '}
          {!motor
            ? 'Cargando memoria de hallazgos…'
            : texto.trim().length < 12
              ? `Describe lo que observas: analizo tu frase con las normas y ${memoria} hallazgos de FMA.`
              : 'No encuentro relación clara todavía. Agrega detalle (qué, dónde, qué requisito o documento) o elige el requisito manualmente.'}
        </p>
      </div>
    );

  const agregables = a!.clausulas.filter((c) => c.confianza !== 'baja').map((c) => idPorClausula.get(c.clave)).filter((id): id is string => !!id && !requisitoIds.includes(id));
  const tipoRef = a!.tipos[0]?.tipo;
  const reinAgregables = a!.clausulas
    .filter((c) => c.motivos.some((m) => m.startsWith('Reincidencia')))
    .map((c) => idPorClausula.get(c.clave))
    .filter((id): id is string => !!id && !requisitoIds.includes(id));

  return (
    <section className="asis-card" aria-live="polite" aria-label="Análisis del asistente de auditoría">
      <header className="flex items-center gap-3">
        <IconoAsistente size={42} activo />
        <div className="min-w-0 flex-1">
          <p className="asis-titulo">Asistente de auditoría</p>
          <p className="text-[11px] text-zinc-500">Norma ISO · {motor!.memoria.historial} hallazgos 2023–2026 · {motor!.memoria.aprendidos} aprendidos del equipo</p>
        </div>
        <button type="button" onClick={() => setOculto(true)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Ocultar asistente">
          <X className="h-4 w-4" />
        </button>
      </header>

      {a!.palabrasClave.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Detecté:</span>
          {a!.palabrasClave.map((w) => <span key={w} className="asis-palabra">{w}</span>)}
        </div>
      )}

      {a!.clasificacion && (
        <div className="asis-bloque mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600">Clasificación sugerida</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold ring-1', TONO_TIPO[a!.clasificacion.tipo])}>{a!.clasificacion.tipo === 'NC' ? 'No conformidad' : 'Oportunidad de mejora'}</span>
            <Medidor c={a!.clasificacion.confianza} />
            <span className="text-[11px] text-zinc-500">confianza {a!.clasificacion.confianza}</span>
            {a!.clasificacion.tipo !== tipoActual && (
              <button type="button" className="asis-accion ml-auto" onClick={() => onTipo(a!.clasificacion!.tipo)}>Marcar como {a!.clasificacion.tipo}</button>
            )}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-500">
            {a!.clasificacion.motivos.map((m) => <li key={m}>· {m}</li>)}
          </ul>
        </div>
      )}

      {a!.reincidencias.length > 0 && (
        <div className="asis-alerta mt-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-xs">
            <b>Posible reincidencia en {area || 'esta área'}.</b> Este tema ya se levantó antes:
            <ul className="mt-1 space-y-0.5">
              {a!.reincidencias.map((r) => (
                <li key={r.id}>
                  · <b>{r.anio}</b> como {r.tipo === 'NC' ? 'No conformidad' : 'Oportunidad de mejora'}
                  {r.clausulas.length > 0 && <> ({r.clausulas.map((k) => k.replace('ISO ', '').replace('|', ' ')).join(', ')})</>}
                  {r.extracto && <span className="text-zinc-600"> — «{r.extracto.slice(0, 110)}{r.extracto.length > 110 ? '…' : ''}»</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1">Si vuelve a ocurrir, la acción anterior no fue eficaz: corresponde levantarlo como <b>No conformidad</b> e incluir la cláusula <b>10.2</b>. Ya agregué esas cláusulas a la lista de requisitos.</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tipoActual !== 'NC' && <button type="button" className="asis-accion" onClick={() => onTipo('NC')}>Marcar como NC</button>}
              {reinAgregables.length > 0 && (
                <button type="button" className="asis-accion asis-accion--primaria" onClick={() => onAgregar([...requisitoIds, ...reinAgregables])}>
                  <Plus className="h-3.5 w-3.5" /> Agregar cláusulas de la reincidencia ({reinAgregables.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {a!.clausulas.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-600">Requisitos que podrían aplicar</span>
            {agregables.length > 1 && (
              <button type="button" className="asis-accion asis-accion--primaria" onClick={() => onAgregar([...requisitoIds, ...agregables])}>
                <Plus className="h-3.5 w-3.5" /> Agregar {agregables.length} sugeridos
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {a!.clausulas.map((c, idx) => {
              const id = idPorClausula.get(c.clave);
              const puesto = !!id && requisitoIds.includes(id);
              return (
                <li key={c.clave} className={cn('asis-item', idx === 0 && 'asis-item--top')}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!id}
                      onClick={() => id && onAgregar(puesto ? requisitoIds.filter((x) => x !== id) : [...requisitoIds, id])}
                      className={cn('asis-req shrink-0', puesto && 'asis-req--on')}
                      title={id ? (puesto ? 'Quitar del hallazgo' : 'Agregar al hallazgo') : 'Cláusula no cargada en el catálogo'}
                    >
                      {puesto ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      <b>{c.norma}</b> {c.clausula}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-800" title={c.titulo}>{c.titulo}</span>
                    <Medidor c={c.confianza} />
                  </div>
                  <BarraSenal c={c} lider={idx === 0 && a!.clausulas.length > 1} />
                  {resumenClausula(c.norma, c.clausula) && (
                    <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">
                      <b className="text-zinc-700">Qué exige:</b> {resumenClausula(c.norma, c.clausula)}
                    </p>
                  )}
                  <AyudaMemoria norma={c.norma as Norma} clausula={c.clausula} compacto />
                  <button type="button" className="mt-1 text-[11px] font-semibold text-violet-600 hover:underline" onClick={() => setPorque(porque === c.clave ? null : c.clave)} aria-expanded={porque === c.clave}>
                    {porque === c.clave ? 'Ocultar explicación' : '¿Cómo se relaciona con mi hallazgo?'}
                  </button>
                  {porque === c.clave && (
                    <div className="asis-relacion mt-1.5">
                      <p>{relacion(c, a!.reincidencias.length > 0)}</p>
                      <p className="asis-relacion-fuentes">Fuentes: {c.motivos.join(' · ')}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tipoRef && (tipoRef.referencias.length > 0 || tipoRef.guia) && (
        <div className="mt-3 space-y-1">
          {tipoRef.referencias.length > 0 && <p className="text-[11px] text-zinc-500"><b className="text-zinc-600">Referencias FMA/legales:</b> {tipoRef.referencias.join(' · ')}</p>}
          <p className="asis-guia">{tipoRef.guia}</p>
        </div>
      )}

      {propuesta && onRedaccion && (
        <div className="asis-bloque mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <PenLine className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-zinc-700">Redacción del hallazgo</span>
            <span className="asis-calidad" title="Qué tan completo está lo que escribiste">
              <span style={{ width: `${propuesta.calidad}%` }} className={cn(propuesta.calidad >= 80 ? 'bg-emerald-500' : propuesta.calidad >= 60 ? 'bg-amber-500' : 'bg-red-500')} />
            </span>
            <span className="text-[11px] text-zinc-500">{propuesta.calidad} % completa</span>
            {anterior !== null && (
              <button type="button" className="asis-accion ml-auto" onClick={() => { onRedaccion(anterior); setAnterior(null); }}>
                <Undo2 className="h-3.5 w-3.5" /> Deshacer
              </button>
            )}
          </div>
          {propuesta.faltantes.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
              Le falta: {propuesta.faltantes.map((f) => <span key={f.clave} className="asis-falta">{f.etiqueta}</span>)}
            </p>
          )}
          {propuesta.yaEstructurado ? (
            <p className="mt-1.5 text-[11px] text-zinc-500">Ya tiene formato FMA. {/\[(indicar|describir|propuesta|completar|precisar)/i.test(texto) ? 'Completa los campos entre [corchetes].' : 'Revisa y guarda.'}</p>
          ) : (
            <>
              <button type="button" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline" onClick={() => setVerRedaccion((v) => !v)} aria-expanded={verRedaccion}>
                {verRedaccion ? 'Ocultar propuesta' : 'Ver propuesta de redacción'} {verRedaccion ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {verRedaccion && (
                <div className="mt-2">
                  <div className="asis-propuesta">
                    {propuesta.texto.split('\n').map((l, i) => {
                      const m = l.match(/^([^:–]+[:–])\s?(.*)$/);
                      return (
                        <p key={i} className={i === 0 ? 'font-bold text-zinc-900' : ''}>
                          {i > 0 && m ? <><b className="text-zinc-700">{m[1]}</b> {m[2].split(/(\[[^\]]+\])/).map((seg, j) => (seg.startsWith('[') ? <mark key={j} className="asis-hueco">{seg}</mark> : seg))}</> : l}
                        </p>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" className="asis-accion asis-accion--primaria" onClick={() => { setAnterior(texto); onRedaccion(propuesta.texto); setVerRedaccion(false); }}>
                      <WandSparkles className="h-3.5 w-3.5" /> Usar esta redacción
                    </button>
                    <span className="text-[11px] text-zinc-500">Reemplaza la descripción; completa lo marcado en amarillo. Puedes deshacer.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {a!.similares.length > 0 && (
        <div className="mt-3">
          <button type="button" className="flex w-full items-center gap-1.5 text-xs font-semibold text-zinc-600" onClick={() => setVerParecidos((v) => !v)} aria-expanded={verParecidos}>
            <History className="h-3.5 w-3.5" /> Hallazgos parecidos ({a!.similares.length})
            {verParecidos ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </button>
          {verParecidos && (
            <ul className="mt-1.5 space-y-1.5">
              {a!.similares.map((s) => {
                const propio = s.origen === 'aprendido' ? hallazgos.find((h) => h.id === s.id) : undefined;
                const extracto = s.extracto ?? (propio ? propio.descripcion.slice(0, 220) : null);
                return (
                  <li key={s.id} className="asis-item">
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                      <b className="text-zinc-700">{s.anio} · {s.area}{s.sucursal === 'Antofagasta' ? ' Antofagasta' : ''}</b>
                      <span className={cn('rounded-full px-1.5 py-px text-[10px] font-bold ring-1', TONO_TIPO[s.tipo])}>{s.tipo}</span>
                      <span>{Math.round(s.similitud * 100)} % parecido</span>
                      {s.origen === 'aprendido' && <span className="rounded bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">aprendido</span>}
                      {s.clausulas.length > 0 && <span>· usó {s.clausulas.slice(0, 3).map((k) => k.replace('ISO ', '').replace('|', ' ')).join(', ')}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">{extracto ?? 'Hallazgo de otra auditoría (texto reservado a sus participantes).'}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-zinc-400">Apoyo al auditor: tú decides la clasificación y el requisito. El asistente aprende de lo que guarda todo el equipo. Verifica la vigencia de referencias legales.</p>
    </section>
  );
}
