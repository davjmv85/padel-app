---
description: Type-check + build + deploy hosting + commit + push, todo en uno
argument-hint: [mensaje del commit]
---

Tu tarea es hacer un release completo del proyecto. Ejecutá los siguientes pasos en orden, parando si alguno falla:

1. **Type check**: corré `npx tsc -p tsconfig.app.json --noEmit`. Si hay errores, **STOP**: avisá al usuario y no sigas con los siguientes pasos.

2. **Build**: corré `npm run build`. Si falla, **STOP**: avisá y no sigas.

3. **Deploy hosting**: corré `firebase deploy --only hosting`. Esto deploya a los dos sites (`padel-hub` y `padel-hub-4b3a0`).

4. **Verificar cambios pendientes en git**: corré `git status` para ver si hay archivos modificados o nuevos. Si **NO hay cambios** que commitear, terminá acá: el deploy ya está hecho, no hay nada para commitear/pushear, avisale al usuario que ya está todo listo.

5. **Si hay cambios**: armá el commit usando los argumentos del usuario como mensaje:
   - Si el usuario pasó argumentos en `$ARGUMENTS`, usalos como mensaje.
   - Si **no pasó argumentos**, generá un mensaje breve y descriptivo basado en `git diff` (qué cambió, en qué área).
   - Hacé `git add -A` y `git commit -m "..."` (con co-author de Claude Opus 4.6 al final).

6. **Push**: corré `git push`.

7. **Resumen final**: dale al usuario un resumen breve: "Deployado en padel-hub.web.app + padel-hub-4b3a0.web.app. Commit pusheado: <sha>".

Reglas importantes:
- **Nunca** saltees el type check. Si falla, no deployes.
- **Nunca** uses `--no-verify` o similar para skipear hooks.
- **Nunca** hagas `git push --force`.
- Si tenés que ejecutar varios pasos secuenciales, usá `&&` para encadenarlos en una sola tool call cuando sea posible para ahorrar tokens.
- Si el usuario pasó algo como `--no-deploy` o `--only-commit` en `$ARGUMENTS`, respetá esa intención (saltá el deploy o solo commit/push).

Argumentos del usuario: $ARGUMENTS
