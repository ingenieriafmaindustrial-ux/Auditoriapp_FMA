# FMA AuditoriAPP

Aplicación web para gestionar **auditorías internas** del Sistema Integrado de Gestión de FMA Industrial Chile (ISO 9001:2015, ISO 14001:2015 e ISO 45001:2018).

Flujo completo dentro de la app: auditoría, checklist en terreno, hallazgos NC/OM, corrección y causa raíz, acciones, verificación de eficacia, informe con versiones y exportación a Word (formato v10/2024).

Especificación funcional: [`docs/FASE_0_Especificacion_FMA_AuditoriAPP.md`](docs/FASE_0_Especificacion_FMA_AuditoriAPP.md)

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, React Router 7 |
| UI | Tailwind CSS 4, lucide-react. Navegación por **hojas** (pestañas) |
| Backend | Firebase Authentication (correo/contraseña) y Cloud Firestore con caché sin conexión |
| Evidencias | Fotos comprimidas en Firestore (sin Cloud Storage, plan Spark) |
| Informes | `docx`: genera el .docx en el navegador |
| Hosting | Netlify |

## Estructura

```
src/
  types/          Tipos de dominio
  domain/         Reglas de negocio puras (RN-01..RN-14), snapshot y generador Word
  services/       Acceso a Firestore (transacciones y bitácora)
  context/        Auth, datos globales en tiempo real, toasts
  hooks/          Suscripciones por auditoría (checklist, evidencias, bitácora, informes)
  components/     UI base, layout con hojas y componentes compartidos
  pages/          Inicio, Auditorías, Hallazgos, Catálogos, Usuarios, Perfil
  data/           Cláusulas ISO para la carga inicial
firestore.rules   Seguridad por roles
```

---

## 1. Preparar el equipo

> ⚠️ **No ejecutes `npm install` dentro de OneDrive.** `node_modules` tiene decenas de miles de archivos y satura la sincronización. Copia la carpeta del código a una ruta local (por ejemplo `C:\dev\fma-auditoriapp`) y versiona con Git/GitHub.

Requisitos: **Node.js 20.19 o superior** (recomendado 22 LTS) y Git.

```bash
cd C:\dev\fma-auditoriapp
npm install
```

## 2. Configurar Firebase (cuenta existente)

1. Proyecto actual: **`auditoria-interna-fma`** (`.env.local` y `.firebaserc` ya vienen configurados).
2. **Authentication → Método de acceso:** habilita *Correo electrónico/contraseña*.
3. **Authentication → Usuarios → Agregar usuario:** crea **tu** cuenta, que será el primer auditor líder.
4. **Firestore Database:** créala en modo producción, ubicación `southamerica-west1` (Santiago).
5. **Configuración del proyecto → Tus apps → Web:** registra la app y copia la configuración.
6. Copia `.env.example` como `.env.local` y completa las variables `VITE_FIREBASE_*`.
7. Publica las reglas y los índices:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # ajusta los IDs de proyecto
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. Primer arranque

```bash
npm run dev
```

1. Entra con la cuenta creada en el paso 2.3. La app detecta que no hay usuarios y muestra **Inicializar sistema**, que te deja como *Auditor líder*.
2. Ve a **Catálogos → Cargar datos iniciales**. Carga sucursales, áreas y los 12 auditores de la plantilla v10, además de 168 cláusulas de las tres normas.
3. En **Catálogos → Auditores**, completa el **área de origen** de cada auditor. Se usa para la regla de independencia.
4. En **Usuarios → Nuevo usuario**, marca *«La cuenta ya existe en Firebase Authentication»* y pega el **UID** de Cristian Neira (*Auditor de sistema*) e Israel Contreras (*Auditor*), vinculando cada uno a su auditor del catálogo. Si la cuenta no existe, desmárcalo y la app la crea con contraseña temporal.

## 4. Deploy en Netlify

1. Sube el repositorio a GitHub.
2. En Netlify: *Add new site → Import from Git*. Build: `npm run build`. Publish: `dist` (ya definido en `netlify.toml`).
3. En *Site settings → Environment variables*, agrega las mismas `VITE_FIREBASE_*`.
4. En Firebase: **Authentication → Configuración → Dominios autorizados**, agrega el dominio de Netlify.

---

## Roles

| Acción | Auditor líder | Auditor de sistema | Auditor |
|---|:-:|:-:|:-:|
| Ver auditorías | Todas | Todas | Solo donde participa |
| Crear o editar auditorías, cambiar estados | ✅ | ✅ | ❌ |
| Checklist, hallazgos, seguimiento y eficacia | ✅ | ✅ | ✅ (las suyas) |
| Emitir informe | ✅ | Si es líder de la auditoría | ❌ |
| Anular o reabrir | ✅ | ❌ | ❌ |
| Catálogos | ✅ | ✅ | ❌ |
| Usuarios | ✅ | ❌ | ❌ |

Las reglas de `firestore.rules` aplican estos permisos también en el servidor.

## Reglas de negocio clave

- **Correlativo** `NN/AAAA` por año, asignado con transacción. No se reutiliza.
- **Estado del hallazgo derivado:** *No tratada* (sin acciones), *En seguimiento* (con acciones) y *Tratada* (verificación eficaz, o una OM cerrada con justificación).
- **NC:** exige corrección y causa raíz antes de registrar acciones correctivas. Una verificación no eficaz exige una acción nueva.
- **Auditoría cerrada:** bloquea el checklist y la descripción de los hallazgos. El seguimiento continúa.
- **Informe emitido = inmutable.** Cada emisión crea una versión (v1, v2…) con un snapshot y se puede re-descargar en Word.
- **Bitácora:** todas las operaciones quedan registradas y no se pueden editar ni borrar.

## Informe Word

- Se genera en el navegador con la estructura de *Informe auditoría interno versión N°10 2024*.
- Al abrirlo, Word pregunta si desea **actualizar los campos**. Responde *Sí* para que se genere el índice.

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Desarrollo local |
| `npm run typecheck` | Verificación de tipos |
| `npm run build` | Build de producción (`dist/`) |
| `npm run rules:deploy` | Publica reglas e índices de Firestore |

## Pendiente (etapas 2 y 3)

Programa anual, plantillas de checklist, gráficos del dashboard, calendario, búsqueda global, PWA instalable, reportes y exportación a Excel/PDF, y notificaciones (requieren Cloud Functions y el plan Blaze).
