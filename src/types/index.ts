// ============================================================
// Tipos de dominio — FMA_AuditoriAPP
// Fechas de negocio: string 'YYYY-MM-DD' (ISODate). Sellos de auditoría: ISO datetime.
// ============================================================

export type ISODate = string;
export type ISODateTime = string;

export type Rol = 'auditor_lider' | 'auditor_sistema' | 'auditor';
export type Norma = 'ISO 9001' | 'ISO 14001' | 'ISO 45001';
export type TipoHallazgo = 'NC' | 'OM';
export type Nivel = 'BAJA' | 'MEDIA' | 'ALTA';
export type EstadoAuditoria = 'planificada' | 'en_ejecucion' | 'en_revision' | 'cerrada' | 'anulada';
export type EstadoHallazgo = 'no_tratada' | 'en_seguimiento' | 'tratada';
export type ResultadoChecklist = 'pendiente' | 'conforme' | 'NC' | 'OM' | 'no_aplica';
export type MetodoCausa = '5porques' | 'ishikawa' | 'otro';
export type ResultadoEficacia = 'eficaz' | 'no_eficaz';

export interface Usuario {
  id: string; // uid de Firebase Auth
  nombre: string;
  email: string;
  rol: Rol;
  auditorId: string | null;
  activo: boolean;
}

export interface Sucursal {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Area {
  id: string;
  nombre: string;
  sucursalId: string | null; // Santiago / Antofagasta
  encargado: string; // jefe / encargado del área (sin cuenta en la app)
  cargoEncargado: string;
  activo: boolean;
  /** Plantilla del plan de auditoría del área (puntos a revisar). */
  plan?: PuntoPlan[];
}

// ---------- Plan de auditoría ----------
export type GrupoPlan = 'sistema' | 'operacion' | 'sst_ambiente' | 'seguimiento';
export type EstadoPunto = 'pendiente' | 'conforme' | 'hallazgo' | 'no_aplica';

/** Punto de la plantilla del plan de un área. requisitos = claves 'ISO 9001|8.2.1'. */
export interface PuntoPlan {
  id: string;
  titulo: string;
  grupo: GrupoPlan;
  requisitos: string[];
  referencia: string | null; // PGI / ISGI / documento interno
}

/** Punto copiado a una auditoría (foto fija del plan) con su resultado. */
export interface PuntoPlanAuditoria extends PuntoPlan {
  origen: 'plan' | 'nc_anterior' | 'recurrente' | 'manual';
  estado: EstadoPunto;
  hallazgoIds: string[];
  hallazgoOrigenId: string | null; // NC de la auditoría anterior a verificar
  revisadoPor: string | null;
}

export interface Auditor {
  id: string;
  nombre: string;
  cargo: string;
  sucursalId: string | null;
  areaOrigenId: string | null;
  activo: boolean;
}

export interface RequisitoSeed {
  norma: Norma;
  clausula: string;
  titulo: string;
}

export interface Requisito extends RequisitoSeed {
  id: string;
  orden: number;
  activo: boolean;
}

export interface AgendaItem {
  fecha: ISODate;
  hora: string;
  proceso: string;
  auditado: string;
  auditorId: string | null;
}

export interface RegistroMotivo {
  motivo: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: ISODateTime;
}

export interface Aprobacion {
  rol: 'auditor_lider' | 'equipo' | 'jefe_area';
  nombre: string;
  usuarioId: string | null;
  fecha: ISODateTime;
}

/** Control de revisiones del documento (flujo auditor → auditor líder). */
export interface RevisionDoc {
  id: string;
  tipo: 'envio' | 'observacion' | 'aprobacion' | 'emision' | 'reapertura';
  usuarioId: string;
  usuarioNombre: string;
  fecha: ISODateTime;
  comentario: string;
  version: number | null; // versión de informe asociada (emisión)
}

export interface Auditoria {
  id: string;
  numero: number;
  anio: number;
  codigo: string; // "01/2026"
  sucursalId: string;
  areaId: string;
  objetivos: string;
  alcance: string;
  normas: Norma[];
  auditorLiderId: string;
  equipoIds: string[];
  participantes: string[]; // [líder, ...equipo] — usado por reglas de seguridad
  auditadosTexto: string;
  fechaPlanificada: ISODate;
  fechaRealizacion: ISODate | null;
  agenda: AgendaItem[];
  estado: EstadoAuditoria;
  notas: string;
  aprobaciones: Aprobacion[];
  auditoriaAnteriorId: string | null;
  contadorHallazgos: number;
  informeVersion: number; // última versión emitida (0 = ninguna)
  independenciaForzada: RegistroMotivo | null;
  anulacion: RegistroMotivo | null;
  reaperturas: RegistroMotivo[];
  revisiones?: RevisionDoc[];
  plan?: PuntoPlanAuditoria[];
  /** Auditoría histórica cargada desde un informe anterior (solo lectura de seguimiento). */
  importada?: boolean;
  /** N° original del informe ("01 / 2024"): el número de la app es correlativo propio. */
  codigoOriginal?: string;
  origenArchivo?: string;
  /** Clave anio|sucursal|área: evita importar dos veces la misma auditoría. */
  importadaClave?: string;
  /** Última edición de las notas (trabajo en equipo). */
  notasActualizadasPor?: string | null;
  notasActualizadasEn?: ISODateTime | null;
  creadoPor: string;
  creadoEn: ISODateTime;
  actualizadoEn: ISODateTime;
}

// ---------- Programa anual de auditorías (ISO 19011 §5.4) ----------
export type TipoProgramado = 'auditoria' | 'seguimiento' | 'eficacia';

/** Actividad programada para un área: auditoría (al ejecutarse se crea y queda vinculada), seguimiento o medición de eficacia. */
export interface ProgramaItem {
  id: string;
  /** Sin valor = auditoría (registros anteriores a este campo). */
  tipo?: TipoProgramado;
  anio: number;
  sucursalId: string;
  areaId: string;
  fecha: ISODate;
  auditorLiderId: string;
  equipoIds: string[];
  notas: string;
  auditoriaId: string | null;
  cancelado: boolean;
  /** Seguimiento / medición de eficacia: fecha en que se marcó como realizada. */
  realizadoEn?: ISODate | null;
  creadoPor: string;
  creadoEn: ISODateTime;
  actualizadoEn: ISODateTime;
}

export interface ChecklistItem {
  id: string;
  orden: number;
  pregunta: string;
  requisitoIds: string[];
  resultado: ResultadoChecklist;
  evidenciaObservada: string;
  auditorId: string | null;
  hallazgoId: string | null;
  actualizadoEn: ISODateTime;
}

export interface AnalisisCausa {
  metodo: MetodoCausa;
  porques: string[];
  causaRaiz: string;
}

export interface Accion {
  id: string;
  tipo: 'correctiva' | 'mejora';
  descripcion: string;
  responsable: string; // texto: jefe/encargado de área (no tiene cuenta)
  fechaCompromiso: ISODate;
  fechaImplementacion: ISODate | null;
  implementada: boolean;
  creadoEn: ISODateTime;
  creadoPor: string;
}

export interface Verificacion {
  id: string;
  fecha: ISODate;
  auditorId: string | null;
  auditoriaId: string | null; // auditoría en la que se verificó (RN-14)
  resultado: ResultadoEficacia;
  analisis: string;
  creadoEn: ISODateTime;
  creadoPor: string;
}

export interface Hallazgo {
  id: string;
  auditoriaId: string;
  correlativo: number;
  anio: number;
  sucursalId: string;
  areaId: string;
  participantes: string[];
  tipo: TipoHallazgo;
  requisitoIds: string[];
  normas: Norma[];
  descripcion: string;
  nivel: Nivel; // único campo: impacto = nivel de importancia
  fechaDeteccion: ISODate;
  fechaLimite: ISODate | null;
  auditorResponsableId: string | null;
  checklistItemId: string | null;
  /** Punto del plan de auditoría desde el que se levantó. */
  planPuntoId?: string | null;
  correccion: string;
  analisisCausa: AnalisisCausa;
  acciones: Accion[];
  verificaciones: Verificacion[];
  cierreSinAccion: RegistroMotivo | null; // solo OM
  estado: EstadoHallazgo; // derivado — ver domain/hallazgoReglas.ts
  anulado: boolean;
  anulacion: RegistroMotivo | null;
  creadoPor: string;
  creadoEn: ISODateTime;
  actualizadoEn: ISODateTime;
  /** uid de quien hizo el último cambio (trabajo en equipo). */
  actualizadoPor?: string;
  /** Hallazgo histórico importado sin seguimiento: queda como tratado y fuera de alertas hasta reactivarlo. */
  historico?: boolean;
  /** El tipo (NC/OM) se dedujo del informe porque no venía marcado; conviene revisarlo. */
  tipoInferido?: boolean;
}

export interface Evidencia {
  id: string;
  auditoriaId: string;
  participantes: string[];
  hallazgoId: string | null;
  checklistItemId: string | null;
  descripcion: string;
  mime: string;
  ancho: number;
  alto: number;
  bytes: number;
  miniatura: string; // dataURL ~ 320px
  subidoPor: string;
  creadoEn: ISODateTime;
}

export interface EvidenciaDatos {
  id: string;
  auditoriaId: string;
  participantes: string[];
  datos: string; // dataURL imagen completa comprimida
  subidoPor: string;
}

// ---------- Informe ----------
export interface InformeFilaHallazgo {
  correlativo: number;
  tipo: TipoHallazgo;
  requisitos: string[]; // "ISO 9001 7.5.3"
  descripcion: string;
  correccion: string;
  causaRaiz: string;
  acciones: string[];
  nivel: Nivel;
  estado: EstadoHallazgo;
  verificacionFecha: ISODate | null;
  verificacionResultado: ResultadoEficacia | null;
  verificacionAnalisis: string;
}

export interface InformeSnapshot {
  codigo: string;
  sucursal: string;
  objetivos: string;
  alcance: string;
  normas: Norma[];
  auditorLider: string;
  equipo: string[];
  area: string;
  auditados: string;
  fechaRealizacion: ISODate | null;
  totalNC: number;
  totalOM: number;
  notas: string;
  hallazgos: InformeFilaHallazgo[];
  evidencias: { id: string; descripcion: string; hallazgoCorrelativo: number | null }[];
  aprobaciones: Aprobacion[];
  revisiones: RevisionDoc[];
  plan?: { titulo: string; estado: EstadoPunto; origen: PuntoPlanAuditoria['origen']; requisitos: string[]; hallazgos: number[] }[];
  version: number;
  generadoEn: ISODateTime;
}

export interface InformeVersion {
  id: string;
  version: number;
  snapshot: InformeSnapshot;
  emitidoPor: string;
  emitidoPorNombre: string;
  emitidoEn: ISODateTime;
  comentario: string;
}

// ---------- Bitácora ----------
export type AccionBitacora =
  | 'crear'
  | 'editar'
  | 'cambio_estado'
  | 'emitir_informe'
  | 'anular'
  | 'reabrir'
  | 'eliminar';

export interface BitacoraEntry {
  id: string;
  entidad: 'auditoria' | 'hallazgo' | 'checklist' | 'evidencia' | 'usuario' | 'catalogo' | 'sistema';
  entidadId: string;
  auditoriaId: string | null;
  participantes: string[];
  accion: AccionBitacora;
  detalle: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: ISODateTime;
}

// ---------- Presencia en la sala de auditoría ----------
export type EditandoEn = { tipo: 'hallazgo'; id: string; n: number } | { tipo: 'nuevo' } | { tipo: 'notas' } | null;
export interface Presencia {
  id: string; // `${auditoriaId}__${uid}`
  auditoriaId: string;
  usuarioId: string;
  auditorId: string | null;
  nombre: string;
  enSala: boolean;
  editando: EditandoEn;
  ultimaSenal: ISODateTime;
  desde: ISODateTime;
}
