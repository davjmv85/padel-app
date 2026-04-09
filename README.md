# Padel App - Gestión de Torneos de Pádel

MVP web para organizar eventos de pádel, gestionar inscripciones, pagos, parejas, resultados y ranking individual.

## Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Estilos:** Tailwind CSS
- **Routing:** React Router v6
- **Backend:** Firebase (Auth, Firestore, Cloud Functions, Hosting)
- **Formularios:** React Hook Form + Zod
- **Iconos:** Lucide React
- **Notificaciones:** React Hot Toast

## Setup local

### Prerequisitos

- Node.js 20+
- npm
- Firebase CLI (`npm install -g firebase-tools`)

### Instalación

```bash
# Clonar el repo
git clone <repo-url>
cd padel-app

# Instalar dependencias del frontend
npm install

# Instalar dependencias de Cloud Functions
cd functions && npm install && cd ..
```

### Configurar Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Authentication (Email/Password + Google)
3. Crear base de datos Firestore
4. Copiar la configuración del proyecto:

```bash
cp .env.example .env
```

5. Completar `.env` con los datos del proyecto Firebase:

```
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
```

6. Actualizar `.firebaserc` con tu project ID.

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# (Opcional) Usar emuladores de Firebase
VITE_USE_EMULATORS=true npm run dev

# En otra terminal, iniciar emuladores
firebase emulators:start
```

### Crear usuario admin

El primer usuario se crea como `player`. Para hacerlo admin, desde la consola de Firebase > Firestore, editar el documento en `users/{userId}` y cambiar `role` a `"admin"`.

## Deploy

```bash
# Build de producción
npm run build

# Deploy a Firebase Hosting
firebase deploy --only hosting

# Deploy de Security Rules
firebase deploy --only firestore:rules

# Deploy de Cloud Functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# Deploy completo
npm run build && firebase deploy
```

## Estructura del proyecto

```
src/
  app/            -> App root, router, providers
  components/
    ui/           -> Componentes reutilizables (Button, Card, Modal, etc.)
    layout/       -> AppLayout, Sidebar, ProtectedRoute
  features/
    auth/         -> Login, registro, perfil
    events/       -> CRUD de eventos, listados
    registrations/-> Inscripciones, mis inscripciones
    payments/     -> Gestión de pagos
    pairs/        -> Armado de parejas
    matches/      -> Carga de resultados
    ranking/      -> Ranking individual
    collaborators/-> Gestión de colaboradores
  hooks/          -> useAuth (context + hook)
  lib/            -> Firebase config
  types/          -> TypeScript types
  utils/          -> Constantes, validaciones Zod
functions/
  src/            -> Cloud Functions (ranking, waitlist, roles)
```

## Modelo de datos (Firestore)

| Colección | Propósito |
|---|---|
| `users` | Perfil y rol de cada usuario |
| `events` | Eventos de pádel con estado y cupo |
| `registrations` | Inscripciones (colección global, no subcolección) |
| `event_pairs` | Parejas armadas por evento |
| `matches` | Resultados de partidos |
| `rankings` | Ranking materializado (recalculado por Cloud Function) |
| `waitlist` | Lista de espera por evento |

## Roles y permisos

| | Admin | Colaborador | Jugador |
|---|---|---|---|
| CRUD eventos | Total | Crear/Editar | Solo lectura |
| Inscriptos/Pagos | Gestionar | Gestionar | Solo propios |
| Parejas/Resultados | Gestionar | Gestionar | Solo lectura |
| Colaboradores | Gestionar | - | - |
| Ranking | Ver | Ver | Ver |

## Seguridad

- **Firestore Rules:** Validación de rol en cada colección
- **Cloud Functions:** Verificación de auth + rol para operaciones sensibles
- **Frontend:** Rutas protegidas por rol, UI condicional

## Decisiones técnicas

1. **Registrations como colección global** (no subcolección): permite queries por usuario y por evento sin limitaciones
2. **Ranking materializado:** se recalcula via Cloud Function al crear/editar resultados, evita N+1 en lectura
3. **Datos desnormalizados** (userName en registrations y pairs): evita joins costosos, aceptable trade-off para MVP
4. **Cupo controlado con Transaction:** `currentRegistrations` se actualiza atómicamente para evitar race conditions
5. **Waitlist simplificada:** marca `notified: true` en Cloud Function; envío real de email requiere integrar servicio (SendGrid, etc.)

## Próximos pasos (post-MVP)

- [ ] Code splitting con lazy routes para reducir bundle size
- [ ] Envío real de emails (SendGrid/Resend)
- [ ] Custom claims en Firebase Auth para roles (en vez de leer Firestore en cada rule)
- [ ] Tests unitarios e integración
- [ ] PWA / app móvil (React Native compartiendo lógica de negocio)
- [ ] Categorías y fases de torneo
- [ ] Sistema de puntos más complejo
- [ ] Historial detallado de participaciones
