# Padel App - Plataforma de Gestión de Torneos de Pádel

---

## El problema

Organizar torneos de pádel hoy es un caos:
- Grupos de WhatsApp para anotar jugadores
- Planillas de Excel para controlar pagos
- Listas en papel para armar parejas
- Cero trazabilidad de resultados y ranking
- Cupos que se pierden, pagos que no se registran, jugadores que se anotan dos veces

**Los organizadores pierden tiempo. Los jugadores pierden información.**

---

## La solución

**Px4Dx3L Hub** es una plataforma web que centraliza toda la organización de eventos de pádel en un solo lugar.

Una herramienta simple, rápida y profesional para organizadores y jugadores.

---

## Funcionalidades

### Para el organizador

**Gestión completa de eventos**
- Crear eventos con nombre, lugar, fecha, hora, cupo y precio
- Controlar el estado del evento: borrador, publicado, cerrado, finalizado, cancelado
- Editar o cancelar eventos en cualquier momento

**Control de inscripciones**
- Ver en tiempo real cuántos jugadores se anotaron
- Control automático de cupo máximo (no se permite sobre-inscripción)
- Dar de baja jugadores si es necesario
- Lista de espera automática: si el evento se llena, los jugadores pueden pedir que se les avise cuando se libere un lugar

**Gestión de pagos**
- Marcar quién pagó y quién no, directo desde la plataforma
- Estado de pago por jugador: pendiente, pagado, cancelado
- Visualización clara del estado financiero del evento

**Armado de parejas**
- Crear parejas manualmente desde los jugadores inscriptos
- Validación automática: un jugador no puede estar en dos parejas del mismo evento
- Editar o eliminar parejas en cualquier momento

**Carga de resultados**
- Registrar resultados partido por partido
- Definir ganador por partido
- Editar resultados si hay correcciones

**Ranking automático**
- Ranking individual calculado automáticamente al cargar resultados
- 1 punto por partido ganado para cada jugador de la pareja ganadora
- Ranking visible para todos los usuarios
- Preparado para agregar reglas más complejas en el futuro (puntos por fase, categorías, bonus)

**Equipo de trabajo**
- Asignar colaboradores que ayuden a gestionar eventos
- Los colaboradores pueden crear eventos, gestionar inscripciones, cargar resultados
- Solo el administrador controla los permisos

---

### Para el jugador

**Registro simple**
- Crear cuenta con email o iniciar sesión con Google en un click
- Perfil con nombre, apellido y posición preferida (drive, revés o indistinto)

**Descubrimiento de eventos**
- Ver todos los eventos publicados con fecha, lugar, precio y cupos disponibles
- Ver el detalle completo de cada evento

**Inscripción instantánea**
- Anotarse a un evento con un solo click
- Ver si hay lugar disponible o si el evento está completo
- Cancelar inscripción si cambian los planes
- Si el evento está lleno: activar alerta para ser notificado cuando se libere un lugar

**Historial y seguimiento**
- Ver todas las inscripciones activas en "Mis Inscripciones"
- Ver el estado de pago de cada evento
- Consultar el ranking general

---

## Seguridad

- Autenticación segura con Firebase (email/password + Google)
- 3 roles con permisos diferenciados: administrador, colaborador, jugador
- Validación de permisos tanto en el frontend como en el backend
- Un jugador no puede alterar datos que no le corresponden
- Reglas de seguridad en base de datos que protegen cada operación

---

## Tecnología

- **Aplicación web** moderna, rápida y responsive
- Funciona en cualquier dispositivo: PC, tablet, celular
- **No requiere instalación** - se accede desde el navegador
- Arquitectura preparada para escalar a app móvil nativa en una segunda fase
- Hosting en la nube con disponibilidad 24/7
- Base de datos en tiempo real

---

## Diseño

- Interfaz limpia y profesional
- Modo claro y modo oscuro
- Diseño inspirado en la cancha de pádel
- Navegación intuitiva con sidebar
- Formularios claros y mensajes de confirmación
- Estados vacíos bien resueltos (nunca una pantalla en blanco)

---

## Diferenciadores

| Hoy (sin Padel App) | Con Padel App |
|---|---|
| WhatsApp desbordado | Todo centralizado en una plataforma |
| Excel para pagos | Control de pagos integrado |
| No hay control de cupo real | Cupo automático con lista de espera |
| Resultados en papel | Resultados digitales con ranking automático |
| Cada torneo empieza de cero | Ranking acumulativo entre eventos |
| Solo el organizador sabe qué pasa | Transparencia total para jugadores |

---

## Roadmap futuro

- **Notificaciones por email** (cupo liberado, recordatorios de evento)
- **App móvil nativa** (iOS/Android) compartiendo la misma base
- **Categorías de jugadores** (principiante, intermedio, avanzado)
- **Sistema de puntos avanzado** (bonus por torneo, por fase, por racha)
- **Integración de pagos online** (MercadoPago, transferencias)
- **Estadísticas avanzadas** por jugador (% victorias, mejor compañero, rendimiento por cancha)
- **Torneos recurrentes** (semanales, mensuales, ligas)

---

## Modelo de negocio (propuestas)

- **Freemium**: gratis hasta X eventos por mes, plan pago para organizadores frecuentes
- **Comisión por inscripción**: pequeño porcentaje si se integra cobro online
- **Suscripción para clubes**: plan mensual para canchas/clubes que organizan torneos regularmente
- **White-label**: versión personalizada con marca del club o liga

---

## Estado actual

**MVP funcional y deployado** con:
- Registro y login (email + Google)
- CRUD completo de eventos
- Inscripciones con control de cupo
- Lista de espera
- Gestión de pagos
- Armado de parejas
- Carga de resultados
- Ranking automático
- Múltiples formatos de torneo: liga, libre, Americano (grupos + rondas + bracket), Rey de Cancha
- Duplicación de eventos con inscripciones y parejas
- Gestión de colaboradores
- Modo claro/oscuro
- Seguridad por roles
- Deploy en producción

**Live en:** https://padel-hub.web.app

---

*Padel App - Organizá torneos como un profesional.*
