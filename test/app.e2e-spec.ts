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
    user: {
      upsert: jest.fn(),
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
