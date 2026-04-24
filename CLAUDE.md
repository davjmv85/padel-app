# CLAUDE.md — contexto persistente para Claude Code

Este archivo se carga automáticamente al inicio de cada sesión. Sirve para que Claude tenga el contexto del proyecto sin tener que re-leer todo.

## Proyecto

**Px4Dx3L Hub** — plataforma web para organizar torneos de pádel.

- **Repo**: https://github.com/davjmv85/padel-app
- **Local clonado**: C:\Users\pituj\GitHub\padel-app
- **Sites en producción**:
  - https://padel-hub.web.app
  - https://padel-hub-4b3a0.web.app
- **Firebase project**: `padel-hub-4b3a0` (CLI logueado con `jmv.dev256@gmail.com`)
- **Documentación completa**: ver `C:\Users\pituj\GitHub\padel-app\README.md` 

## Stack

- React 18 + Vite + TypeScript (strict)
- Tailwind CSS v4 con dark mode (`class` strategy)
- React Router v6
- React Hook Form + Zod
- Firebase Auth + Firestore + Hosting (multi-site)
- Telegram Bot API (notificaciones)

## Comandos clave

```bash
# Dev local
npm run dev

# Type check (correr SIEMPRE antes de build/deploy)
npx tsc -p tsconfig.app.json --noEmit

# Build
npm run build

# Deploy hosting (a los dos sites)
firebase deploy --only hosting

# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes (puede tardar minutos)
firebase deploy --only firestore:indexes

# Deploy completo
firebase deploy
```

## Estructura clave

```
src/
  app/                    → router, App root
  components/
    ui/                   → Button, Input, Card, Modal, Badge, ConfirmDialog, etc.
    layout/               → AppLayout (sidebar + main), ProtectedRoute
  features/
    auth/                 → login, register, profile, verify email
    events/               → list/detail player y admin, form, americano tabs (Config, Groups, Matches, Standings)
                            services/groupService.ts → CRUD de event_groups
    registrations/        → service, my registrations page
    pairs/                → service
    matches/              → service
    ranking/              → service (recálculo desde cliente), page
    collaborators/        → service, page
  hooks/
    useAuth.tsx           → context + hook auth
    useTheme.tsx          → context + hook dark mode
  lib/
    firebase.ts           → init Firebase + lang español
    telegram.ts           → enviar mensajes al bot
  types/index.ts          → AppUser, PadelEvent, Registration, EventPair, Match, etc.
  utils/
    constants.ts          → ROLES, EVENT_STATUSES, TOURNAMENT_TYPES, etc.
    format.ts             → formatPrice, inverseScore, countSets, determineWinner, buildDisplayName
    validation.ts         → schemas Zod
    americano.ts          → lógica de fixtures de grupo, repechaje y bracket de eliminación
public/
  favicon.svg             → paleta de pádel + pelotita
  logo.svg                → "Px4Dx3L Hub" + pelotita
  seed.html               → herramienta admin para crear jugadores masivamente
firestore.rules           → security rules
firestore.indexes.json    → composite indexes
firebase.json             → multi-site hosting config
```

## Modelos Firestore (resumen)

- `users/{uid}` — perfil del usuario. Campos: email, displayName, firstName, lastName, **nickname?**, position, role (admin/collaborator/player), adminCreated?
- `events/{id}` — torneo. Campos: name, location, date, time, maxCapacity, price, status (draft/published/closed/finished/cancelled), **tournamentType (liga/libre/americano/rey)**, currentRegistrations, createdBy, createdByEmail, createdByName, **americanoConfig?** (minMatches, groupCount, directQualifiers), **americanoPhase?** (setup/groups/repechaje/elimination/finished), **reyConfig?** (courts[], winnersCourtId, losersCourtId, seedMode)
- `registrations/{id}` — colección global. Campos: eventId, userId, userName (cache), userPosition (cache), paymentStatus (pending/paid/cancelled), status (active/cancelled)
- `event_pairs/{id}` — parejas. Campos: eventId, player1Id/Name, player2Id/Name, **round?** (solo libre)
- `matches/{id}` — partidos. Campos: eventId, pairAId, pairBId, scoreA, scoreB, winnerId, **round?**, **phase?** ('group'|'repechaje'|'elimination'), **groupNumber?**, **bracketRound?**, **bracketPosition?**
- `event_groups/{id}` — grupos de americano. Campos: eventId, groupNumber, pairIds[]
- `rankings/{userId}` — ranking global materializado. totalPoints, matchesWon, matchesPlayed
- `waitlist/{id}` — lista de espera. eventId, userId, userEmail, notified

## Roles

- **admin**: control total
- **collaborator**: gestionar eventos sin eliminar, sin tocar collaboradores
- **player**: inscribirse, ver eventos, ranking, propias inscripciones

Un staff (admin/collaborator) puede ALSO jugar como player.

## Tipos de torneo

- **`liga`**: parejas fijas para todo el torneo. Auto-armar genera round-robin de 3 rondas. Posiciones por pareja.
- **`libre`**: parejas cambian por fecha. Cada `event_pair` tiene `round`. Auto-armar parejas evita repetir combinaciones de fechas anteriores. Auto-armar partidos genera todos los cruces dentro de cada fecha. Posiciones por jugador individual.
- **`americano`**: grupos + repechaje + eliminación directa. Parámetros configurables: `minMatches` (mínimo de partidos por pareja), `groupCount`, `directQualifiers` (clasificados directos por grupo). Fases: `setup → groups → repechaje → elimination → finished`. El admin avanza de fase manualmente.
- **`rey`**: Rey de Cancha. Múltiples canchas con orden numérico. Cada ronda, ganadores suben un escalón hacia `winnersCourtId` y perdedores bajan un escalón hacia `losersCourtId`. Las parejas que no entran en una ronda descansan y se priorizan en la siguiente. Configuración (`ReyConfig`): lista de `ReyCourt[]` (id, name, order), `winnersCourtId`, `losersCourtId`, `seedMode` (`random` | `manual`). Lógica en `utils/rey.ts`, servicio en `features/events/services/reyService.ts`, componentes: `ReyConfigTab.tsx`, `ReyRoundsTab.tsx`, `ReyInfoButton.tsx`.

## Convenciones del proyecto

### Código
- TypeScript strict, sin `any` salvo casos justificados
- Components funcionales, hooks
- Imports con alias `@/` (configurado en `vite.config.ts` y `tsconfig.app.json`)
- Cada feature tiene su propia carpeta con `pages/`, `components/`, `hooks/`, `services/` según necesite
- Servicios Firestore en `features/{feature}/services/`
- Validaciones con Zod en `utils/validation.ts`

### Estilos
- Solo Tailwind, no CSS custom (excepto el fondo de cancha en `index.css`)
- Dark mode: SIEMPRE incluir variantes `dark:` cuando se usen colores
- **Colores brand**:
  - Primario botones: `#cab628` (mostaza)
  - Danger: `#ba1f1e`
  - Dark bg principal: `#101828`
- Botones interactivos llevan `cursor-pointer` (Tailwind v4 lo removió del default)

### Nombres
- "Apodo" / `nickname` es opcional. El `displayName` se calcula con `buildDisplayName(firstName, lastName, nickname)` en `utils/format.ts`.
- Todos los nombres cacheados (en registrations, pairs, matches, rankings) usan ese `displayName`.
- Cuando un usuario actualiza su perfil, se propaga el nuevo nombre a sus `registrations` activas.

### Fechas
- Las fechas de eventos se guardan a las 12:00 local (`new Date(data.date + 'T12:00:00')`) para evitar bugs de timezone.
- Display con `toLocaleDateString('es-AR')`.

### Telegram
- Token y chat ID en `.env` (queda en bundle, trade-off MVP).
- `sendTelegramMessage()` en `lib/telegram.ts` es fire-and-forget — no rompe el flujo si falla.
- Se llama desde `registrationService.ts` en register y unregister.

## Reglas operativas IMPORTANTES

1. **Antes de cualquier deploy**, correr `npx tsc -p tsconfig.app.json --noEmit` para validar tipos. Si falla, NO deployar.
2. **Nunca borrar** sin confirmación: archivos, branches, registros de Firestore, etc.
3. **Cuando el deploy termina**, decirle al usuario que puede testear (no asumir que está OK).
4. **Cualquier feature nueva** que afecte modelo de datos: actualizar `types/index.ts`, `utils/validation.ts`, los services correspondientes y el `README.md`.
5. **Eventos en estado `finished`**: bloquear edición de inscriptos, parejas, partidos. Solo permitir cambio de status.
6. **Posiciones**: en liga son por pareja, en libre son por jugador.
7. **Auto-armar parejas en libre**: NUNCA debe repetir combinaciones de fechas anteriores (la repetición se hace solo manualmente).
8. **Tab Inscriptos** (jugador): solo se muestra si el jugador está inscripto Y pagó.
9. **Cuando se cargan/editan/borran matches**: llamar a `recalculateRankings()` después.
10. **Americano**: el avance de fase es explícito — el admin debe avanzar de fase manualmente (no se avanza automáticamente al completar partidos).

## Cuentas

- **Admin Firebase CLI**: `jmv.dev256@gmail.com` (creó el proyecto `padel-hub-4b3a0`)
- **GitHub**: `davjmv85` (repo y commits)
- **Auth**: `davjmv85@gmail.com` y `jmvieiro@gmail.com` son admins en la app

## Decisiones técnicas que se mantuvieron

- **No hay Cloud Functions deployadas** (plan Spark gratuito). Todo se hace desde el cliente admin.
- **Ranking recalculado en cliente** — funciona hasta cientos de partidos.
- **Token de Telegram en frontend** — aceptable para MVP interno.
- **Multi-site hosting** — un build, dos URLs, mismo proyecto Firebase.
- **No usar Cloud Functions** ni instancias propias mientras el plan sea Spark.

## Cosas que NO hay que hacer

- ❌ Cambiar `tournamentType` de un evento ya creado (UI lo bloquea, pero la lógica asume que no se cambia)
- ❌ Crear pairs sin pasar por `createPair` del service (valida duplicados)
- ❌ Crear matches sin pasar por `createMatch` del service
- ❌ Permitir borrar parejas con partidos asociados
- ❌ Permitir dar de baja jugadores que estén en una pareja del evento
- ❌ Hardcodear el azul de Tailwind para un botón primario (usar el color de la marca `#cab628`)
- ❌ Usar `bg-gray-800` o variaciones distintas a las que ya están establecidas en dark mode
- ❌ Subir secretos al repo (el `.env` está en `.gitignore`)
- ❌ Olvidarse de correr `tsc --noEmit` antes de deployar
