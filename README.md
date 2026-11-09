<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Backend de **Scan & Confirm**: API REST (NestJS + Prisma + PostgreSQL) que registra la toma de un medicamento al escanear un tag NFC y avisa si se escaneó de nuevo en menos de 1 minuto.
## Cómo ejecutar el proyecto (guía para el equipo)

### Requisitos
- **Node.js** y npm.
- **Docker Desktop**, abierto y corriendo (la base de datos PostgreSQL vive en un contenedor).
- Git.

### Primera vez (5 pasos)

```bash
# 1. Clonar y entrar
git clone git@github.com:AndresM15/Scan-and-confirm-backend.git
cd Scan-and-confirm-backend

# 2. Instalar dependencias
npm install

# 3. Crear tu archivo de entorno (no se sube a git)
cp .env.example .env

# 4. Levantar PostgreSQL en Docker, aplicar migraciones y cargar datos de prueba
npm run db:setup

# 5. Arrancar la API en modo desarrollo
npm run start:dev
```

Cuando arranque verás en consola la URL de Swagger. Con el `PORT` del `.env.example` es:

- API: `http://localhost:3000`
- Documentación / pruebas desde el navegador (Swagger): **`http://localhost:3000/api/docs`**

(Si tu `.env` define otro `PORT`, usa ese puerto.)

### Probar el endpoint

El seed crea un usuario de prueba con id `00000000-0000-4000-8000-000000000001`.

```bash
curl -X POST http://localhost:3000/doses/scan \
  -H 'Content-Type: application/json' \
  -d '{"userId":"00000000-0000-4000-8000-000000000001","nfcTagId":"nfc-tag-001","medicationName":"Ibuprofeno"}'
```

| Resultado | Cuándo |
|---|---|
| `201` | Dosis registrada (estado `TAKEN`). |
| `409` `DUPLICATE_WARNING` | Segundo escaneo del mismo usuario/tag/medicamento en menos de 1 minuto. |
| `404` `USER_NOT_FOUND` | El `userId` no existe. |
| `400` | Falta un dato obligatorio (`userId`, `nfcTagId` o `medicationName`). |

### Día a día

Después de la primera vez, normalmente solo necesitas:

```bash
npm run db:up        # si el contenedor está apagado (Docker Desktop abierto)
npm run start:dev
```

### Scripts de base de datos

| Script | Qué hace |
|---|---|
| `npm run db:setup` | Todo en uno: levanta PostgreSQL, migra y carga el seed. |
| `npm run db:up` / `npm run db:down` | Levanta / apaga el contenedor `scan-and-confirm-db`. Los datos se conservan en un volumen de Docker. |
| `npm run db:migrate` | Aplica las migraciones de Prisma. |
| `npm run db:seed` | Carga 2 usuarios y 5 dosis de ejemplo. Se puede repetir sin duplicar datos. |
| `npm run db:reset` | **Borra** la base, reaplica migraciones y vuelve a cargar el seed. |
| `npx prisma studio` | Explorador visual de la base de datos. |

Si cambias `prisma/schema.prisma`: `npx prisma migrate dev --name <cambio>` y sube la carpeta nueva de `prisma/migrations`.

### Pruebas

```bash
npm test             # unitarias
npm run test:e2e     # e2e (usan Prisma simulado: no necesitan la base)
npm run lint
npm run build
```

> Usa siempre `npm test`, no `npx jest`: el script incluye una opción de Node necesaria porque NestJS 12 es ESM.

### Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `Cannot connect to the Docker daemon` / `docker.sock` | Abre Docker Desktop y espera a que inicie. |
| `port is already allocated` (5433) | Otro programa usa el puerto. Cambia `POSTGRES_PORT` **y** el puerto de `DATABASE_URL` en tu `.env`, y vuelve a correr `npm run db:up`. |
| `Environment variable not found: DATABASE_URL` | Falta crear el `.env` (paso 3). |
| `Cannot find module '@prisma/client'` / `PrismaClient` sin exportar | Corre `npx prisma generate`. |
| `Cannot find module 'class-validator'` | Corre `npm install` (puede que tu rama esté desactualizada: haz `git pull`). |
| Quiero empezar con la base limpia | `npm run db:reset`. |
| Apagar todo y borrar los datos | `docker compose down -v`. |

### Flujo de trabajo

Nunca se hace commit directo a `main` ni a `QA`. Crea una rama `feature/SCRUM-<n>-<descripcion>`, haz commits tipo `feat(SCRUM-<n>): ...` y abre un PR hacia `QA` (más abajo, en "Reglas para Pull Requests").

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).


## Flujo de Trabajo y Ramas 

* **main:** Código estable listo para producción.
* **QA:** Rama de integración y pruebas. Todo el trabajo del equipo se une aquí primero.

## Reglas para Pull Requests (PR)

1. Nunca hacer commits directos a `main` ni a `QA`.
2. Todo desarrollo debe hacerse en una rama nueva que incluya el ID de Jira (Ejemplo: `feature/SCRUM-7-RF-01`).
3. Al terminar, abrir un Pull Request (PR) apuntando hacia la rama **`QA`**.
4. El PR debe ser revisado y aprobado por el Líder de Integración antes de hacer merge.
5. El código debe compilar correctamente y no tener errores para ser aceptado.