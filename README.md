# Px4Dx3L Hub — Gestión de torneos de pádel

Plataforma web para organizar torneos de pádel de punta a punta: inscripciones, pagos, parejas, partidos, resultados, posiciones por evento y ranking general.

**Live:**
- https://padel-hub.web.app
- https://padel-hub-4b3a0.web.app

**Repo:** https://github.com/davjmv85/padel-app

---

## 1. El problema

Organizar torneos de pádel hoy es un caos:

- Grupos de WhatsApp desbordados para armar listas
- Planillas de Excel para controlar pagos
- Papelitos para las parejas
- Cero trazabilidad de resultados, ranking o posiciones
- Cupos que se pierden, pagos olvidados, inscripciones duplicadas
- Cada torneo arranca de cero, no hay historial

**Los organizadores pierden tiempo. Los jugadores pierden información.**

## 2. La solución

**Px4Dx3L Hub** centraliza toda la organización de torneos en una sola plataforma web, con automatizaciones que ahorran horas de trabajo. Un organizador con colaboradores puede armar eventos, inscribir jugadores, marcar pagos, armar parejas y generar partidos con un par de clicks. Los jugadores se registran, se inscriben y ven todo lo que pasa en el torneo — pero solo si pagaron.

---

## 3. Stack

### Frontend
- **React 18** + **Vite** (build rápido, cero overhead de SSR)
- **TypeScript strict** (seguridad de tipos en todo el proyecto)
- **Tailwind CSS v4** (utilidades CSS sin CSS custom)
- **React Router v6** (routing declarativo con layouts anidados)
- **React Hook Form + Zod** (formularios tipados con validación schema-based)
- **Lucide React** (iconos consistentes y livianos)
- **React Hot Toast** (notificaciones)

### Backend
- **Firebase Authentication** (email/password + Google, con verificación de email)
- **Cloud Firestore** (NoSQL, real-time, security rules por rol)
- **Firebase Hosting** (multi-site)
- **Telegram Bot API** (notificaciones fire-and-forget desde el cliente)

### Dev / deploy
- **Git + GitHub** (control de versiones)
- **Firebase CLI** (deploy)
- **GitHub CLI** (gestión del repo)

### Por qué este stack
- **Cero infra propia** que mantener (Firebase se ocupa de hosting, DB, auth)
- **Real-time** out-of-the-box con Firestore
- **Escalable** sin servidor intermedio
- **Free tier** generoso (plan Spark alcanza para clubs chicos)
- Preparado para **migrar a mobile** compartiendo servicios (React Native)

---

## 4. Estructura del proyecto

```
padel-app/
├── public/
│   ├── favicon.svg          → paleta de pádel + pelotita
│   ├── logo.svg             → Px4Dx3L Hub con pelotita
│   └── seed.html            → herramienta admin para crear jugadores masivamente
├── scripts/
│   └── seed-players.html    → copia del seed (source)
├── src/
│   ├── app/
│   │   ├── App.tsx          → root con ThemeProvider + AuthProvider
│   │   └── router.tsx       → rutas públicas / player / staff / admin
│   ├── components/
│   │   ├── ui/              → Button, Input, Card, Modal, Badge, ...
│   │   └── layout/          → AppLayout, ProtectedRoute
│   ├── features/
│   │   ├── auth/            → login, register, forgot password, profile, verify email
│   │   ├── events/          → CRUD eventos, listados player/admin, detalle con tabs
│   │   │   ├── services/groupService.ts → CRUD de event_groups (americano)
│   │   │   ├── services/reyService.ts   → generación de rondas con rotación (rey)
│   │   │   └── components/  → AmericanoConfigTab, AmericanoGroupsTab, AmericanoMatchesTab, AmericanoStandingsTab, ReyConfigTab, ReyRoundsTab, ReyInfoButton
│   │   ├── registrations/   → inscripción, cancelación, mis inscripciones
│   │   ├── pairs/           → service para crear/eliminar parejas
│   │   ├── matches/         → service para crear/editar/borrar partidos
│   │   ├── ranking/         → ranking global + recálculo desde cliente
│   │   └── collaborators/   → asignar/revocar rol collaborator
│   ├── hooks/
│   │   ├── useAuth.tsx      → context + hook de auth
│   │   └── useTheme.tsx     → context + hook de dark mode
│   ├── lib/
│   │   ├── firebase.ts      → init Firebase (Auth + Firestore + idioma español)
│   │   └── telegram.ts      → enviar mensajes al bot
│   ├── types/
│   │   └── index.ts         → AppUser, PadelEvent, Registration, EventPair, Match, etc.
│   ├── utils/
│   │   ├── constants.ts     → ROLES, EVENT_STATUSES, TOURNAMENT_TYPES, ...
│   │   ├── format.ts        → formatPrice, inverseScore, countSets, determineWinner
│   │   ├── validation.ts    → schemas Zod
│   │   ├── americano.ts     → lógica de fixtures de grupo, repechaje y bracket de eliminación
│   │   └── rey.ts           → lógica de rotación de canchas para Rey de Cancha
│   └── main.tsx             → entry point
├── firestore.rules          → security rules por colección
├── firestore.indexes.json   → índices compuestos
├── firebase.json            → multi-site hosting + rules + indexes
└── .firebaserc              → project ID
```

### Organización por feature
Cada feature tiene sus propias `pages`, `components`, `hooks` y `services` según necesite. Esto mantiene cohesión por dominio sin sobreingeniería.

---

## 5. Modelo de datos (Firestore)

### `users/{userId}`
Perfil de cada usuario (se crea en el primer login).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | mismo que el doc ID (auth uid) |
| `email` | string | email del usuario |
| `displayName` | string | "Nombre Apellido" |
| `firstName` | string | |
| `lastName` | string | |
| `position` | `'drive' \| 'reves' \| 'indistinto'` | posición preferida |
| `role` | `'admin' \| 'collaborator' \| 'player'` | rol en la app |
| `adminCreated?` | boolean | true si lo creó un admin con el seed (saltea verificación de email) |
| `photoURL?` | string | solo para login con Google |
| `createdAt`, `updatedAt` | Timestamp | auditoría |

### `events/{eventId}`
Evento de pádel (torneo).

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | nombre del evento |
| `location` | string | lugar |
| `date` | Timestamp | fecha del torneo (guardada a las 12:00 local para evitar bugs de timezone) |
| `time` | string | hora (HH:mm) |
| `maxCapacity` | number | cupo máximo |
| `price` | number | precio por jugador |
| `description?` | string | opcional |
| `status` | `'draft' \| 'published' \| 'closed' \| 'finished' \| 'cancelled'` | estado |
| `tournamentType` | `'liga' \| 'libre' \| 'americano' \| 'rey'` | tipo de torneo (default `liga`, inmutable) |
| `americanoConfig?` | object | config de americano: `{ minMatches, groupCount, directQualifiers }` |
| `americanoPhase?` | `'setup' \| 'groups' \| 'repechaje' \| 'elimination' \| 'finished'` | fase actual del americano |
| `reyConfig?` | object | config de rey: `{ courts: ReyCourt[], winnersCourtId, losersCourtId, seedMode }` |
| `currentRegistrations` | number | contador desnormalizado (se actualiza con transaction) |
| `createdBy` | string | userId del creador |
| `createdByEmail?` | string | email del creador (cache para mostrar en UI) |
| `createdByName?` | string | nombre completo del creador (cache para UI) |
| `createdAt`, `updatedAt` | Timestamp | |

### `registrations/{registrationId}`
Inscripción de un jugador a un evento. **Colección global** (no subcolección) para poder hacer queries por usuario.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | string | ref al evento |
| `userId` | string | ref al usuario |
| `userName` | string | cache desnormalizado |
| `userPosition` | PlayerPosition | cache |
| `paymentStatus` | `'pending' \| 'paid' \| 'cancelled'` | estado de pago |
| `paidMarkedBy?` | string | userId del staff que lo marcó |
| `paidAt?` | Timestamp | cuándo se marcó como pagado |
| `status` | `'active' \| 'cancelled'` | inscripción activa o dada de baja |
| `createdAt`, `updatedAt` | Timestamp | |

### `event_pairs/{pairId}`
Parejas armadas para un evento.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | string | ref al evento |
| `player1Id`, `player2Id` | string | refs a usuarios |
| `player1Name`, `player2Name` | string | cache desnormalizado |
| `round?` | number | solo en torneo `libre`, identifica la fecha. En `liga` queda vacío. |
| `createdAt` | Timestamp | |

### `matches/{matchId}`
Partidos entre parejas.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | string | ref al evento |
| `pairAId`, `pairBId` | string | refs a parejas |
| `scoreA`, `scoreB` | string | score en formato "6-4 6-3" |
| `winnerId` | string | pairId del ganador (vacío si aún no hay resultado) |
| `round?` | number | número de fecha/jornada (o ronda en rey) |
| `phase?` | `'group' \| 'repechaje' \| 'elimination'` | fase del partido (solo americano) |
| `groupNumber?` | number | número de grupo (solo americano, fase group) |
| `bracketRound?` | number | ronda del bracket (solo americano, fase elimination) |
| `bracketPosition?` | number | posición en el bracket (solo americano, fase elimination) |
| `courtId?` | string | id de cancha (solo rey) |
| `courtName?` | string | nombre de cancha cacheado (solo rey) |
| `createdBy` | string | userId |
| `createdAt`, `updatedAt` | Timestamp | |

### `event_groups/{groupId}`
Grupos de americano.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | string | ref al evento |
| `groupNumber` | number | número del grupo (1, 2, ...) |
| `pairIds` | string[] | refs a parejas del grupo |
| `createdAt` | Timestamp | |

### `rankings/{userId}`
Ranking global materializado por jugador. Se **recalcula desde el cliente** cada vez que se carga/edita/borra un match.

| Campo | Tipo | Descripción |
|---|---|---|
| `userId` | string | doc ID |
| `userName` | string | |
| `totalPoints` | number | = matchesWon en el MVP |
| `matchesWon` | number | partidos ganados |
| `matchesPlayed` | number | partidos jugados |
| `updatedAt` | Timestamp | |

### `waitlist/{waitlistId}`
Lista de espera para eventos llenos.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | string | |
| `userId` | string | |
| `userEmail` | string | |
| `notified` | boolean | se pisa a true cuando se libera un lugar |
| `createdAt` | Timestamp | |

### Decisiones de diseño importantes
- **Registrations como colección global**: permite queries por usuario y por evento sin limitaciones.
- **Datos desnormalizados** (userName en registrations, player1Name/player2Name en pairs): evita joins costosos, aceptable para MVP.
- **Contador `currentRegistrations`** se actualiza con `runTransaction` atómica para evitar race conditions.
- **Ranking materializado** en vez de calcularlo en cada render.
- **Fechas con offset horario**: el campo `date` se guarda a las 12:00 local para evitar que se "corra" un día atrás por UTC.

---

## 6. Roles y permisos

### Tres roles

| Rol | Descripción |
|---|---|
| **Administrador** | Control total: CRUD eventos, eliminar, gestionar colaboradores, todo |
| **Colaborador** | CRUD eventos (sin eliminar), gestionar inscripciones/pagos/parejas/partidos/resultados. No puede tocar colaboradores. |
| **Jugador** | Registrarse, inscribirse, cancelar propias, ver eventos públicos, ver ranking, ver detalles de torneo donde esté inscripto y haya pagado |

### Matriz de permisos

| Acción | Admin | Collaborator | Player |
|---|:---:|:---:|:---:|
| Crear / editar eventos | ✅ | ✅ | ❌ |
| Eliminar eventos | ✅ | ❌ | ❌ |
| Ver inscriptos (staff view) | ✅ | ✅ | ❌ |
| Marcar pagos | ✅ | ✅ | ❌ |
| Dar de baja jugadores | ✅ | ✅ | Solo propia |
| Armar parejas | ✅ | ✅ | ❌ |
| Crear partidos y cargar resultados | ✅ | ✅ | ❌ |
| Gestionar colaboradores | ✅ | ❌ | ❌ |
| Ver ranking general | ✅ | ✅ | ✅ |
| Inscribirse a eventos | ✅ | ✅ | ✅ |
| Ver inscriptos/parejas/partidos/posiciones de un evento | ✅ | ✅ | Solo si pagó |
| Eliminar evento cerrado (`closed`) | ❌ | ❌ | ❌ |
| Editar evento cerrado (`closed`) | ❌ | ❌ | ❌ |

### Página de inicio
- **Admin / Colaborador**: `/admin/events` (Gestión de Eventos). No hay Dashboard.
- **Jugador**: `/` (Eventos disponibles).

### Un staff también puede jugar
Admin y collaborator tienen en el sidebar las mismas rutas de player (Eventos, Mis Inscripciones, Perfil). Pueden inscribirse a los eventos, armar sus propias parejas, jugar, etc. — además de su rol de gestión.

---

## 7. Seguridad

### Tres capas

1. **Frontend**: rutas protegidas por rol (`ProtectedRoute` con `allowedRoles`), UI condicional por rol.
2. **Firestore Security Rules**: validación por colección, usando `get()` al doc del usuario para leer el rol.
3. **Cloud Functions (futuro)**: operaciones sensibles pueden mover su validación al server si hace falta.

### Rules clave

```javascript
// Users: crear sólo si sos dueño o admin (esto permite que el seed funcione)
match /users/{userId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && (isOwner(userId) || isAdmin());
  allow update: if isAuthenticated() && (isOwner(userId) || isAdmin());
}

// Events: staff crea y edita, solo admin elimina.
// Jugadores pueden actualizar SOLO currentRegistrations (al inscribirse atómicamente)
match /events/{eventId} {
  allow read: if isAuthenticated();
  allow create: if isStaff();
  allow update: if isAuthenticated() && (
    isStaff() ||
    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['currentRegistrations', 'updatedAt']))
  );
  allow delete: if isAdmin();
}

// Registrations: cualquier autenticado puede crear/leer/actualizar
// (la lógica de negocio se maneja en el código cliente)
match /registrations/{registrationId} {
  allow read, create, update: if isAuthenticated();
}

// Event pairs y matches: staff only
match /event_pairs/{pairId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isStaff();
}
match /matches/{matchId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isStaff();
}

// Rankings: solo staff puede escribir (se recalcula desde el cliente admin)
match /rankings/{rankingId} {
  allow read: if isAuthenticated();
  allow write: if isStaff();
}
```

### Verificación de email
- Nuevos registros con email/password envían email de verificación (en español)
- `ProtectedRoute` bloquea acceso hasta que `user.emailVerified === true` o `appUser.adminCreated === true`
- La pantalla de verificación tiene botones para reenviar email, recargar estado o cerrar sesión
- Google sign-in trae el email ya verificado
- Seeded users vienen con `adminCreated: true` y saltean la verificación

### Account linking y unlink
- Si un usuario tiene password + luego loguea con Google (mismo email), Firebase los linkea automáticamente (mismo UID)
- **Después del link**, el código automáticamente desvincula el provider `password`, dejando Google como único método

---

## 8. Funcionalidades detalladas

### 8.1 Autenticación y perfil

- **Registro con email y password** (con confirmación de password, nombre, apellido y posición)
- **Login con email/password**
- **Login con Google** (popup)
- **Recuperar contraseña** (Firebase envía email en español)
- **Verificación de email obligatoria** antes de acceder a la app (excepto Google y adminCreated)
- **Perfil editable**: nombre, apellido, posición preferida
- **Desvinculación automática** del provider password cuando se loguea con Google
- **Rol visible** en el perfil con badge

### 8.2 Gestión de eventos (admin / collaborator)

**CRUD completo**:
- Crear evento con nombre, lugar, fecha, hora, cupo, precio, descripción, estado, tipo de torneo
- Editar cualquier campo (excepto `tournamentType` que es inmutable después de crearlo)
- Eliminar (solo admin, con confirmación) — **eliminación en cascada**: borra registrations, pairs, matches, event_groups, waitlist, el evento, y recalcula ranking global.

**Estados del evento**:
- `draft` — no visible para jugadores
- `published` — visible, abierto a inscripciones
- `closed` — **estado FINAL**. No se puede editar ni eliminar desde la app. Tampoco se puede cambiar el estado desde el form. Para reabrirlo hay que tocar Firestore directamente. En el listado admin solo se muestra la acción "Ver".
- `finished` — finalizado. Bloquea edición de inscriptos, parejas, partidos y resultados. Se puede cambiar el `status` desde el form para desbloquear.
- `cancelled` — cancelado

**Tipos de torneo**:
- `liga`: parejas fijas para todo el torneo. Auto-armar genera round-robin de 3 rondas.
- `libre`: parejas cambian por fecha. Admin arma parejas por fecha, partidos solo se pueden crear dentro de una fecha existente.
- `americano`: grupos + repechaje + eliminación directa. Parámetros configurables (minMatches, groupCount, directQualifiers). Fases: setup → groups → repechaje → elimination → finished. El admin avanza de fase manualmente.
- `rey`: Rey de Cancha. Parejas fijas jugando rondas sucesivas en canchas ordenadas en línea. Ganador sube hacia la "cancha de ganadores", perdedor baja hacia la "cancha de perdedores". La posición en cancha refleja el nivel actual. Los cruces pueden repetirse (es parte del juego). Sin duración fija: se generan rondas mientras el admin quiera.

**Listado admin** con menú kebab por evento: **Gestionar**, **Editar**, **Eliminar** (solo admin).

**Vista de gestión** con pestañas:
- **Inscriptos** — lista con nombre, posición, estado de pago, kebab (marcar pago / dar de baja). Valida que no se pueda dar de baja un jugador en pareja.
- **Parejas** — depende del tipo:
  - Liga: lista única, botones "Auto-armar parejas", "Crear pareja" y "Borrar todas"
  - Libre: secciones por fecha. Botón "+ Nueva fecha" crea una fecha vacía (local). Dentro de cada fecha: "Auto-armar" y "+ Pareja"
- **Partidos** — agrupados por fecha:
  - Liga: botón "Auto-armar partidos" (round-robin 3 rondas)
  - Libre: un botón "+ Partido" por cada fecha (solo habilitado si la fecha tiene ≥2 parejas). Al crear, el modal solo muestra las parejas de esa fecha.
  - Cada partido tiene menú kebab con "Cargar resultado" / "Editar resultado" y "Borrar partido"
- **Posiciones** — tabla en vivo:
  - Liga: por pareja
  - Libre: por jugador individual
  - Orden: puntos → diferencia de sets → diferencia de games
- **Americano** (pestañas específicas cuando el tipo es `americano`):
  - **Config** — configurar minMatches, groupCount, directQualifiers (AmericanoConfigTab)
  - **Grupos** — asignar parejas a grupos, ver composición (AmericanoGroupsTab)
  - **Partidos** — partidos agrupados por fase: group, repechaje, elimination (AmericanoMatchesTab)
  - **Posiciones** — standings por grupo y generales (AmericanoStandingsTab)

**Header compacto** con badge de estado, breadcrumb para volver a la lista, meta info (tipo, cupo, precio, organizador) y botón de editar.

**Eventos finalizados** muestran banner amarillo y deshabilitan todas las acciones destructivas/de edición, excepto el cambio de estado.

### 8.3 Inscripciones y cupos

**Transacción atómica** al inscribirse:
1. Se valida duplicado (query antes de la transaction)
2. Dentro de la transaction se lee el evento, se valida cupo y estado
3. Se crea la registration
4. Se incrementa `currentRegistrations`
5. Se envía notificación Telegram (fire-and-forget)

**Cancelación**: solo si es propia (jugador) o por staff. Decrementa contador. Envía notificación Telegram.

**Lista de espera**: si el evento está lleno, botón "Avisarme cuando haya lugar" crea un doc en `waitlist`.

### 8.4 Pagos

- Estado por inscripción: `pending` / `paid` / `cancelled`
- Staff marca desde el menú kebab en la pestaña Inscriptos
- Al marcar se guarda `paidMarkedBy` y `paidAt`
- El estado es visible para el jugador
- **Gating**: un jugador inscripto pero no pagado NO ve las pestañas de detalle del torneo (solo ve info básica del evento). Cuando el staff marca el pago, se desbloquea el acceso.

### 8.5 Parejas

**Creación manual**: modal con dos selects de jugadores disponibles (filtrados por posición si hace falta). En libre, se asocia al `round` de la fecha.

**Auto-armado (con prioridad por posición)**:
1. Primero empareja drive + revés (mezcla aleatoria dentro de cada grupo)
2. Si sobran drives o revés, los completa con indistintos
3. Si quedan indistintos sueltos, los empareja entre sí
4. Solo como último recurso empareja dos del mismo lado

**Validaciones**:
- Un jugador no puede estar en dos parejas de la misma fecha (liga = todo el torneo)
- No se puede borrar una pareja si tiene partidos asociados
- "Borrar todas" saltea las que tienen partidos

### 8.6 Partidos

**Flujo**:
1. Admin crea el partido eligiendo solo las dos parejas (sin resultado)
2. Cada partido tiene su menú kebab con "Cargar/Editar resultado" y "Borrar partido"
3. Al cargar el resultado, el admin ingresa solo el score de la pareja A (ej: "6-4 6-3")
4. La pareja B se calcula automáticamente como inverso ("4-6 3-6")
5. El ganador se determina automáticamente por sets ganados

**Auto-armado**:
- **Liga**: round-robin rotation de 3 rondas. Cada pareja juega exactamente 3 partidos. Los partidos se guardan con `round` (1, 2, 3...) para agruparlos. Se saltean duplicados si ya existen partidos.
- **Libre**: genera todos los cruces dentro de cada fecha. Las parejas de fecha 1 juegan entre sí, las de fecha 2 entre sí, etc.

**Auto-armado americano** (`src/utils/americano.ts`):
- **Fase grupos**: fixture parcial round-robin dentro de cada grupo, garantizando al menos `minMatches` partidos por pareja (se iteran rondas del round-robin hasta que todas las parejas llegan al mínimo — necesario porque con grupos impares una pareja descansa por ronda). Partidos se crean con `phase: 'group'` y `groupNumber`.
- **Repechaje**: parejas que no clasificaron directamente compiten por los lugares restantes. Partidos con `phase: 'repechaje'`.
- **Eliminación**: bracket con seeding basado en posiciones de grupo. Partidos con `phase: 'elimination'`, `bracketRound` y `bracketPosition`.

**Separación "borrar resultado" vs "borrar partido"**:
- Partido sin resultado → kebab ofrece *Cargar resultado* / *Borrar partido*.
- Partido con resultado → kebab ofrece *Editar resultado* / *Borrar resultado*. Para borrar el partido entero hay que vaciar el resultado primero (o resetear desde Configuración).
- *Borrar resultado* usa `clearMatchResult` (limpia `scoreA/B` y `winnerId`), mantiene el cruce y recalcula ranking.

**Gating por fase (americano)**:
- `setup`: se puede editar todo (parejas, grupos, config).
- `groups` en adelante: parejas congeladas (banner amarillo + botones disabled). Para modificarlas hay que resetear el americano.
- Partidos de fases anteriores a la vigente: se puede cargar/editar/borrar el resultado, pero NO se puede eliminar el partido entero.

**Reset americano (zona de peligro en Configuración)**:
- Borra partidos, grupos y parejas; recalcula ranking; vuelve la fase a `setup`. Conserva la config.
- Confirmación por nombre exacto del evento.

### 8.7 Posiciones por evento

Tabla calculada en vivo desde el cliente en función de los matches del evento.

**Columnas**: Puesto, Pareja/Jugador, PJ, PG, PP, SG, SP, Set±, GG, GP, Game±, Pts

**Criterios de desempate**:
1. Puntos (1 por partido ganado) — desc
2. Diferencia de sets (SG - SP) — desc
3. Diferencia de games (GG - GP) — desc

**Por pareja (liga)** o **por jugador individual (libre)**. En libre, un jugador suma los puntos y sets de todas las parejas que integró en las diferentes fechas.

### 8.8 Ranking general

**Individual, global, acumulativo** entre todos los eventos. Visible para cualquier autenticado.

**Cálculo**: 1 punto por partido ganado para cada jugador de la pareja ganadora.

**Materialización**: después de crear/editar/borrar un match, el cliente admin llama a `recalculateRankings()` que:
1. Lee todos los matches y todas las parejas
2. Agrupa por jugador
3. Calcula puntos, partidos jugados, partidos ganados
4. Reemplaza la colección `rankings` en batch

**Ignora partidos sin resultado** (sin `winnerId`).

### 8.9 Gestión de colaboradores (admin only)

- Buscar usuario por email exacto
- Asignar rol `collaborator`
- Revocar (vuelve a `player`)
- Pantalla dedicada con lista de collaboradores actuales

### 8.10 Notificaciones Telegram

**Opción simple MVP**: el token del bot vive en `.env` (queda en el bundle, trade-off aceptado).

**Cuándo se envían**:
- Jugador se inscribe → mensaje con nombre, evento y cupo actualizado
- Jugador cancela → mensaje de baja con nombre, evento y cupo

Implementado en `src/lib/telegram.ts`, llamado fire-and-forget desde `registrationService.ts` — si falla la notificación, no rompe el flujo.

### 8.11 Seed de jugadores (admin)

Página HTML standalone en `/seed.html` para que un admin pueda crear muchos jugadores de una:

1. Login con Google del admin
2. Lista de eventos se carga al dropdown
3. Pega la lista en formato `Nombre|Apellido|email|posicion` (una línea por jugador)
4. Selecciona el evento
5. Click en "Crear e inscribir":
   - Por cada jugador, crea auth en Firebase (usando una **instancia secundaria** para no deslogear al admin)
   - Crea el user doc con `adminCreated: true` (así no necesita verificar email)
   - Lo inscribe al evento elegido con `paymentStatus: pending`
6. Actualiza el contador del evento al final

**Respeta el cupo**: antes de procesar, relee el evento para tener `currentRegistrations` fresco. Si el evento está lleno, aborta con error sin inscribir a nadie. Si la lista tiene más jugadores que cupo libre, procesa solo los primeros N y avisa del resto. Si el cupo se alcanza durante el procesamiento (por concurrencia o corte manual), saltea los restantes.

Maneja el caso "email ya existe" buscando el uid en Firestore y reutilizándolo.

### 8.12 Dark mode

- Toggle manual (sol/luna) disponible en el sidebar y en las páginas de auth
- Detecta `prefers-color-scheme` del sistema en la primera carga
- Se persiste en `localStorage`
- Implementado con `class="dark"` en `<html>` y todas las clases usan `dark:` variant
- Colores del dark mode alineados con el branding (azul oscuro tipo cancha de pádel)
- El main content tiene un fondo sutil con líneas de cancha de pádel (horizontal + vertical) como decoración

### 8.13 Branding

- **Logo**: "Px4Dx3L Hub" + pelotita de pádel. Las `x` son subíndices amarillos, el resto en dark con stroke blanco. "HUB" en rojo oscuro.
- **Favicon**: paleta de pádel oscura con contorno rojo, agujeros blancos, mango blanco con borde, líneas rojas de grip, y pelotita amarilla.
- **Paleta**:
  - Primario botones: `#cab628` (mostaza/amarillo pádel)
  - Danger botones: `#ba1f1e` (rojo)
  - Dark bg: `#101828`
- **Logo clickeable**: te lleva al dashboard (staff) o a eventos (player)
- **Cancha como fondo** del main en dark mode

### 8.14 Rey de Cancha

Modalidad donde las parejas rotan entre canchas según ganen o pierdan cada ronda. El orden de las canchas codifica el nivel actual de cada pareja.

**Accordions (orden)**: Inscriptos → Configuración → Parejas → Rondas → Posiciones.

**Configuración** (`ReyConfigTab`):
- **Canchas** ordenadas en una lista. Agregar/renombrar/eliminar/reordenar (↑↓). Una vez que hay rondas generadas, las canchas se bloquean.
- **Cancha de referencia de ganadores**: hacia donde sube el ganador. Por defecto la primera cancha de la lista.
- **Cancha de referencia de perdedores**: hacia donde baja el perdedor. Por defecto la última.
- **Modo de seed inicial**: `random` (reparte al azar) o `manual` (admin asigna pareja-a-cancha con selects).
- **Reset completo**: borra parejas, partidos y recalcula ranking. Confirmación por nombre de evento. Conserva la config.
- La config se puede guardar sin tener parejas todavía (muestra warning).

**Parejas**: reutiliza el flujo de liga (parejas fijas, auto-armar priorizando posición). Cuando ya hay rondas generadas, las parejas quedan congeladas con banner amarillo.

**Rondas** (`ReyRoundsTab`):
- **Ronda 1**: botón "Generar ronda 1". Si el modo es `manual`, abre un modal con selects por cancha; si es `random`, reparte al azar.
- **Cada ronda** muestra una card por cancha con el partido y un kebab para cargar/editar/borrar resultado o borrar partido (solo ronda actual sin resultado).
- **Sección "Descansan"** cuando hay más parejas que cupo (pares sobrantes por ronda).
- **"Generar ronda N+1"** se habilita cuando todos los resultados de la ronda actual están cargados.
- **No hay final forzado**: se siguen generando rondas mientras el admin quiera.

**Algoritmo de rotación** (`src/utils/rey.ts`):
1. Para cada partido resuelto, se calcula la próxima cancha del ganador y del perdedor con `nextCourtOrder(current, target) = current + sign(target - current)` (0 si ya está en la referencia).
2. Cada cancha queda con un "bucket" de parejas que la elegirán para la próxima ronda.
3. Si un bucket tiene >2 parejas, las excedentes van al pool de descanso priorizando a las que más jugaron (les toca descansar).
4. Si un bucket tiene <2, se completa desde el pool de descanso priorizando a las que menos jugaron.
5. Las parejas en descanso **no suman "partido jugado"**.
6. **Los cruces pueden repetirse**: es una consecuencia esperada del algoritmo (si A y B oscilan entre canchas adyacentes, se van a volver a cruzar). No se aplica anti-repetición.

**Posiciones**: se usa la tabla de standings por pareja compartida con liga (PJ, PG, PP, GG, GP, Game±, Pts).

**Ranking global**: se alimenta como siempre — `recalculateRankings()` después de cada cambio en matches.

**Ayuda para jugadores** (`ReyInfoButton`): icono ⓘ que despliega un modal con la explicación de la modalidad (cómo rotan las parejas, qué pasa si ganás/perdés, por qué se pueden repetir cruces, cuándo termina). Aparece:
- En el listado de eventos disponibles (`EventListPage`), junto al tipo "Rey de Cancha".
- En el detalle del evento para el jugador (`EventDetailPage`), en el header.
En ambos casos el click en el ⓘ hace `stopPropagation` para no disparar el link al detalle.

### 8.15 Vista del jugador (read-only)

La pantalla de detalle del evento para el jugador **refleja la del admin en accordions**, pero completamente read-only: sin botones de crear/editar/eliminar, sin kebabs de acciones, inputs disabled. Se reutilizan los mismos subcomponentes (`AmericanoConfigTab`, `AmericanoGroupsTab`, `AmericanoMatchesTab`, `AmericanoStandingsTab`, `ReyConfigTab`, `ReyRoundsTab`) pasándoles una prop `readOnly`.

**Gating**: los accordions de contenido solo se muestran si el jugador está **inscripto y pagó** (antes de pagar, ve solo info básica + mensaje amarillo).

**Orden de accordions (player)**:
- **Liga/Libre**: Inscriptos → Parejas → Partidos → Posiciones.
- **Americano**: Inscriptos → Parejas → Grupos → Posiciones → Partidos.
- **Rey de Cancha**: Inscriptos → Parejas → Rondas → Posiciones.

El accordion de **Configuración** no se muestra para el jugador (es configuración del admin).

**Detalles visuales**:
- El row del jugador actual (o su pareja) queda resaltado en azul en las tablas.
- Nombres de pareja incluyen su record `(W-L)` a la derecha, igual que en la vista admin.

### 8.16 UX polish

- **Breadcrumbs** en detalles de evento (admin y player) para volver al listado
- **Menús kebab** para acciones secundarias (no saturar la UI con botones)
- **Cursor pointer** en todos los elementos interactivos
- **Formato de precio** con separador de miles (22.000)
- **Fechas en es-AR**
- **Confirmaciones** para acciones destructivas (eliminar evento, borrar todo)
- **Reset con nombre**: las acciones de reset de americano y rey piden escribir el nombre exacto del evento (no un simple "sí/no")
- **Toast notifications** para feedback de acciones
- **Header mobile sticky** (`sticky top-0 z-30`) en toda la app
- **Accordion spacing**: `mt-4` por header para que el contenido abierto no quede pegado al siguiente accordion
- **Record (W-L) junto a la pareja**: en todos los listados (parejas, grupos, rondas, matches) aparece `(victorias-derrotas)` para ese evento, calculado con `computePairRecords` en `utils/format.ts`
- **Fix overflow iOS**: inputs `date`/`time` con `-webkit-appearance: none` + `min-width: 0` para que respeten el ancho del grid en Safari mobile
- **Listado admin**: muestra el tipo de torneo debajo de fecha/lugar
- **Sidebar "Gestión Eventos"**: ícono de tuerca (`Settings` de lucide) para diferenciar de "Eventos" del player
- **Estados vacíos** con ícono + mensaje explicativo
- **Loading states** con spinner
- **Responsive 100%** (PC, tablet, mobile)

---

## 9. Configuración local

### Prerequisitos
- Node.js 20+
- npm
- Firebase CLI (`npm i -g firebase-tools`)
- Cuenta de Firebase con acceso al proyecto `padel-hub-4b3a0`

### Pasos

```bash
# Clonar
git clone https://github.com/davjmv85/padel-app.git
cd padel-app

# Instalar dependencias
npm install

# Copiar env y completar
cp .env.example .env
# Editar .env con los valores del proyecto Firebase

# Login de Firebase CLI
firebase login

# Levantar dev server
npm run dev
```

### Variables de entorno (.env)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=padel-hub-4b3a0.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=padel-hub-4b3a0
VITE_FIREBASE_STORAGE_BUCKET=padel-hub-4b3a0.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_EMULATORS=false
VITE_TELEGRAM_BOT_TOKEN=...
VITE_TELEGRAM_CHAT_ID=...  # uno o varios IDs separados por coma: 123,456,789
```

### Crear un usuario admin manualmente

El primer usuario se registra como `player`. Para convertirlo en admin:
1. Firebase Console → Firestore → colección `users` → tu documento
2. Cambiar campo `role` de `"player"` a `"admin"`
3. Refrescar la app

---

## 10. Deployment

### Hosting

El proyecto usa **Firebase Hosting con multi-site**:
- `padel-hub` (principal)
- `padel-hub-4b3a0` (alias del project ID)

Configurado en `firebase.json`:

```json
"hosting": [
  { "site": "padel-hub-4b3a0", "public": "dist", ... },
  { "site": "padel-hub", "public": "dist", ... }
]
```

### Comandos

```bash
# Build + deploy full (hosting + rules + indexes)
npm run build && firebase deploy

# Solo hosting
npm run build && firebase deploy --only hosting

# Solo security rules
firebase deploy --only firestore:rules

# Solo indexes (pueden tardar varios minutos en construirse)
firebase deploy --only firestore:indexes
```

### Dominios autorizados de Auth

Cuando agregues un site nuevo, ir a **Firebase Console → Authentication → Settings → Authorized domains** y agregarlo, sino el login con Google no funciona.

---

## 11. Scripts y herramientas

### Seed de jugadores
Disponible en `/seed.html` del site. Más info en sección 8.11.

### Templates de emails
En **Firebase Console → Authentication → Templates** se pueden personalizar los textos de verificación y reset password (idioma español configurado desde código con `auth.languageCode = 'es'`).

### Bot de Telegram
Creado con `@BotFather`. Token y chat ID en `.env`. El bot debe haber recibido al menos un `/start` antes de poder enviar mensajes.

---

## 12. Decisiones técnicas notables

- **No hay Cloud Functions deployadas** (el proyecto está en plan Spark gratuito). Todas las operaciones que antes iban a Cloud Functions (recalcular ranking, notificaciones) se hacen desde el cliente admin. Trade-off aceptado para MVP.
- **Ranking se recalcula desde el cliente**: cuando un staff carga/edita/borra un match, el cliente lee todos los matches + parejas y hace un batch write. No es ideal a escala pero funciona bien hasta cientos de partidos.
- **Token de Telegram en frontend**: queda visible en el bundle JS. Acceptable para un MVP interno porque el bot solo manda notificaciones al chat del organizador, no hay riesgo de abuso crítico.
- **Firestore composite indexes**: están declarados en `firestore.indexes.json` y se deployan con el resto. Los servicios tienen fallbacks que evitan crashes si un índice aún no está construido.
- **Fechas con `T12:00:00`**: evitan bugs de timezone donde una fecha elegida como "10/04/2026" se guardaba como UTC medianoche y se mostraba como 9/04.
- **Instancia secundaria de Firebase en el seed**: permite crear users sin deslogear al admin. Después de crear cada uno, se hace signOut del secondary y deleteApp para liberar recursos.
- **Posiciones calculadas en memoria, ranking materializado**: las posiciones son ephemeral y baratas de calcular; el ranking es consultado por muchos y se guarda.
- **Modo libre reusa el modelo de parejas**: agregando un campo `round` opcional en vez de crear una colección nueva.
- **Americano usa `event_groups` como colección separada**: permite queries por evento y manipulación independiente de la composición de grupos. Los campos `phase`, `groupNumber`, `bracketRound` y `bracketPosition` en matches permiten filtrar y agrupar partidos por fase sin colecciones adicionales.
- **Rey de Cancha no tiene colección de canchas**: se guardan como array dentro de `reyConfig` en el evento. Es un conjunto chico (<20) y siempre se lee/escribe junto con la config. Los partidos referencian por `courtId` + `courtName` (cache).
- **Rondas de Rey se derivan de matches**: no hay doc "round" ni "state". Los partidos con `round = N` son la ronda N; el estado (ganadores, perdedores, descansos) se recomputa leyendo los matches. Simplifica mucho: un solo source of truth.
- **Orden de accordions en americano**: Inscriptos → Configuración → Parejas → Grupos → Posiciones → Partidos (Posiciones antes que Partidos porque es más consultado durante el torneo). Rey: Inscriptos → Configuración → Parejas → Rondas → Posiciones.
- **Posiciones en americano** muestra solo tablas por grupo + "no clasificados con bye". El bracket eliminatorio y repechaje viven en "Partidos", no en "Posiciones" (evita duplicación).
- **Vista del player = vista del admin con `readOnly`**: en vez de mantener dos implementaciones, se reutilizan los mismos subcomponentes de tabs y se les pasa una prop `readOnly` que oculta barras de acciones, kebabs y zonas de peligro. Reduce duplicación.
- **Eliminación de evento en cascada**: `deleteEventCascade` borra registrations, pairs, matches, event_groups, waitlist + el evento + recalcula ranking. Evita orphans en las inscripciones del jugador.
- **`closed` como estado final**: no hay CTA de reopen en UI. Intencional — fuerza pasar por DB para reabrir un torneo cerrado (evita re-aperturas accidentales que mezclen ranking).
- **Dashboard eliminado**: el landing staff es directamente `/admin/events`. `/admin` queda como redirect para links viejos.

---

## 13. Trivia y curiosidades

- El nombre **Px4Dx3L** viene de la jerga del pádel: "la saca x 4" (por la línea de 4 metros) y "x 3" (por la de 3 metros). No es leetspeak aleatorio.
- El proyecto original se llamaba `padel-events` y un filtro automático de Google Cloud lo flagueó como phishing por el subdominio `px4dx3l.web.app` (confundió el leetspeak). El proyecto actual (`padel-hub-4b3a0`) se creó de cero para evitar el problema, con un nombre neutral.
- Mismo código en dos sites (`padel-hub` y `padel-hub-4b3a0`) por conveniencia. Un solo deploy los actualiza a ambos.
- El logo tiene un agujero conceptual en el medio de la paleta donde irían las letras "HUB" del nombre completo del producto.
