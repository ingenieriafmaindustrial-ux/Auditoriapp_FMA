import type {
  EstadoAuditoria,
  EstadoHallazgo,
  MetodoCausa,
  Nivel,
  Norma,
  ResultadoChecklist,
  Rol,
  TipoHallazgo,
} from '../types';

export const APP_NOMBRE = 'FMA AuditoriAPP';
export const EMPRESA = 'FMA INDUSTRIAL CHILE';
export const FORMATO_INFORME = { titulo: 'INFORME DE AUDITORÍA INTERNA FMA', version: 'Versión 11/2026' };

/** Auditor líder por defecto de todas las auditorías (puede cambiarse solo en casos excepcionales). */
export const AUDITOR_LIDER_NOMBRE = 'Ismael Arelluna';

/** Administrador TI de la app: único que gestiona usuarios. */
export const ADMIN_TI_EMAIL = 'i.arelluna@fma.cl';

/** Descripción de cada estado (se muestra en la hoja de auditoría). */
export const AYUDA_ESTADOS = {
  planificada: 'Auditoría programada. Aún no se registran hallazgos.',
  en_ejecucion: 'El equipo está auditando y registrando hallazgos en la hoja.',
  en_revision: 'Enviada al auditor líder: revisa, aprueba y emite el informe, o la devuelve con observaciones.',
  cerrada: 'Informe emitido y aprobado. El seguimiento de hallazgos continúa.',
  anulada: 'Auditoría anulada (conserva su número).',
} as const;

export const NORMAS: Norma[] = ['ISO 9001', 'ISO 14001', 'ISO 45001'];
export const NORMA_VERSION: Record<Norma, string> = {
  'ISO 9001': 'ISO 9001:2015',
  'ISO 14001': 'ISO 14001:2026',
  'ISO 45001': 'ISO 45001:2018',
};

export const ROLES: Record<Rol, string> = {
  auditor_lider: 'Auditor líder',
  auditor_sistema: 'Auditor de sistema',
  auditor: 'Auditor',
};

export const TIPOS_HALLAZGO: Record<TipoHallazgo, string> = {
  NC: 'No Conformidad',
  OM: 'Oportunidad de Mejora',
};

export const NIVELES: Nivel[] = ['BAJA', 'MEDIA', 'ALTA'];

export const ESTADOS_AUDITORIA: Record<EstadoAuditoria, string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En curso',
  en_revision: 'En revisión (líder)',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
};

export const ESTADOS_HALLAZGO: Record<EstadoHallazgo, string> = {
  no_tratada: 'No tratada',
  en_seguimiento: 'En seguimiento',
  tratada: 'Tratada',
};

export const RESULTADOS_CHECKLIST: Record<ResultadoChecklist, string> = {
  pendiente: 'Pendiente',
  conforme: 'Conforme',
  NC: 'NC',
  OM: 'OM',
  no_aplica: 'N/A',
};

export const METODOS_CAUSA: Record<MetodoCausa, string> = {
  '5porques': '5 porqués',
  ishikawa: 'Ishikawa (6M)',
  otro: 'Otro',
};

export const OBJETIVO_POR_DEFECTO =
  'Verificar la correcta implementación del Sistema Integrado de Gestión e implementación de las acciones correctivas encontradas en la auditoría anterior.';
export const ALCANCE_POR_DEFECTO =
  'Todos los procesos y documentos involucrados en el Sistema de Gestión Integrado en FMA Santiago.';

/** Días antes de la fecha límite en que un hallazgo se considera "próximo a vencer". */
export const DIAS_ALERTA_VENCIMIENTO = 7;
/** Plazo del área para dar cumplimiento (seguimiento) a sus NC: 3 semanas contadas desde la auditoría (fecha de detección). */
export const PLAZO_SEGUIMIENTO_DIAS = 21;

/** Datos maestros iniciales (plantilla Informe v10/2024). */
export const SEED = {
  sucursales: ['Santiago', 'Antofagasta'],
  areas: [
    'Control de Calidad',
    'Post Venta',
    'Diseño y planos de fabricación',
    'Producción',
    'Recursos humanos',
    'Adquisiciones',
    'Prev. de riesgos y medio ambiente',
    'Ventas',
    'Gerencia General',
    'Bodega',
  ],
  auditores: [
    'Ismael Arelluna',
    'Cristian Gatica',
    'Cristian Neira',
    'Aldo Aravena',
    'Israel Contreras',
    'Gisela González',
    'Denisse Torres',
    'Eva Duarte',
    'Lucio D´Amico',
    'Evelyn Araya',
    'Luis González',
    'Katherine Molina',
  ],
};
