import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  // Prisma simulado: la prueba e2e no necesita una base de datos corriendo
  const prismaMock = {
    doseLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    // Misma configuración que src/main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/doses/scan (POST) registra la dosis', () => {
    const payload = {
      userId: 'user-123',
      nfcTagId: 'nfc-tag-789',
      medicationName: 'Ibuprofeno',
    };
    prismaMock.doseLog.findFirst.mockResolvedValue(null);
    prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1', ...payload });

    return request(app.getHttpServer())
      .post('/doses/scan')
      .send(payload)
      .expect(201)
      .expect({ id: 'dose-1', ...payload });
  });

  it('/doses/scan (POST) responde 404 si el usuario no existe', () => {
    prismaMock.doseLog.findFirst.mockResolvedValue(null);
    prismaMock.doseLog.create.mockRejectedValue({ code: 'P2003' });

    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({
        userId: 'no-existe',
        nfcTagId: 'nfc-tag-789',
        medicationName: 'Ibuprofeno',
      })
      .expect(404);
  });

  it('/doses/scan (POST) responde 409 con el mensaje acordado si hay un duplicado', () => {
    prismaMock.doseLog.findFirst.mockResolvedValue({ id: 'dose-previa' });

    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({
        userId: 'user-123',
        nfcTagId: 'nfc-tag-789',
        medicationName: 'Ibuprofeno',
      })
      .expect(409)
      .expect({
        status: 'DUPLICATE_WARNING',
        message:
          'Advertencia: Escaneo duplicado detectado en menos de 1 minuto',
      });
  });

  it('/doses/scan (POST) acepta clientTimestamp y lo guarda como timestamp', () => {
    const clientTimestamp = '2026-01-01T08:00:00.000Z';
    prismaMock.doseLog.findFirst.mockResolvedValue(null);
    prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({
        userId: 'user-123',
        nfcTagId: 'nfc-tag-789',
        medicationName: 'Ibuprofeno',
        clientTimestamp,
      })
      .expect(201)
      .then(() => {
        expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-123',
            nfcTagId: 'nfc-tag-789',
            medicationName: 'Ibuprofeno',
            timestamp: new Date(clientTimestamp),
          },
        });
      });
  });

  it('/doses/scan (POST) responde 400 si clientTimestamp no es una fecha válida', () => {
    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({
        userId: 'user-123',
        nfcTagId: 'nfc-tag-789',
        medicationName: 'Ibuprofeno',
        clientTimestamp: 'ayer',
      })
      .expect(400);
  });

  it('/doses/scan (POST) responde 400 si clientTimestamp es futuro', () => {
    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({
        userId: 'user-123',
        nfcTagId: 'nfc-tag-789',
        medicationName: 'Ibuprofeno',
        clientTimestamp: '2999-01-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('/doses/scan (POST) responde 400 si el payload está incompleto', () => {
    return request(app.getHttpServer())
      .post('/doses/scan')
      .send({ userId: 'user-123' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
