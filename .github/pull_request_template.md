## Ticket de Jira

SCRUM-<n>: <!-- título del ticket -->

## ¿Qué cambia?

<!-- Describe en 2 o 3 líneas qué hace este PR y por qué. -->

## ¿Cómo se probó?

<!-- Comandos ejecutados, casos probados en Swagger o con curl, capturas si aplica. -->

---

## Checklist de revisión

### Ramas y commits
- [ ] La rama sale de la rama correcta y se llama `feature/SCRUM-<n>-<descripcion>`.
- [ ] El PR apunta a **`QA`** (nunca directo a `main`).
- [ ] No hay commits directos a `main` ni a `QA`.
- [ ] Los commits siguen el formato `tipo(SCRUM-<n>): descripción` (`feat`, `fix`, `test`, `ci`, `docs`...).

### Calidad del código
- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` no reporta errores.
- [ ] `npm test` y `npm run test:e2e` pasan (usar los scripts, no `npx jest`).
- [ ] El check de CI **Build, lint y tests** está en verde.
- [ ] Se agregaron o actualizaron tests para el comportamiento nuevo.
- [ ] No quedan `console.log` de depuración ni código comentado.

### Base de datos y configuración
- [ ] Si cambió `prisma/schema.prisma`, se incluye la migración nueva de `prisma/migrations`.
- [ ] No se suben secretos: el `.env` no está en el PR; las variables nuevas se agregaron a `.env.example`.
- [ ] Si cambió algún endpoint, la documentación de Swagger (`@ApiResponse`) y el README están actualizados.

### Revisión
- [ ] El PR fue revisado y aprobado por el Líder de Integración antes del merge.
- [ ] El ticket de Jira se movió al estado correspondiente.
