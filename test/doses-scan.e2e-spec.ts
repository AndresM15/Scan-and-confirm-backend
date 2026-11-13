import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// SCRUM-27: pruebas e2e de los flujos principales de POST /doses/scan
// (201 éxito, 400 payload inválido, 409 escaneo duplicado).
//
// La app completa (rutas, ValidationPipe, controlador y servicio) corre de
// verdad; solo se reemplaza Prisma por una tabla DoseLog en memoria que se
// comporta como la base: guarda los registros, filtra por usuario, tag,
// medicamento y ventana de tiempo, y rechaza usuarios inexistentes (P2003).
// Así `npm run test:e2e` no necesita PostgreSQL.

type DoseRecord = {
  id: string;
  userId: string;
  nfcTagId: string;
  medicationName: string;
  timestamp: Date;
  status: string;
};

type DoseWhere = {
  userId?: string;
  nfcTagId?: string;
  medicationName?: string;
  status?: { not?: string };
  timestamp?: { gte?: Date; lte?: Date };
};

const USUARIO_EXISTENTE = '00000000-0000-4000-8000-000000000001';

function crearDoseLogEnMemoria(usuarios: string[]) {
  const registros: DoseRecord[] = [];
  let secuencia = 0;

  const cumple = (r: DoseRecord, where: DoseWhere = {}) =>
    (where.userId === undefined || r.userId === where.userId) &&
    (where.nfcTagId === undefined || r.nfcTagId === where.nfcTagId) &&
    (where.medicationName === undefined ||
      r.medicationName === where.medicationName) &&
    (where.status?.not === undefined || r.status !== where.status.not) &&
    (where.timestamp?.gte === undefined ||
      r.timestamp >= where.timestamp.gte) &&
    (where.timestamp?.lte === undefined || r.timestamp <= where.timestamp.lte);

  return {
    registros,
    findFirst: jest.fn(async ({ where }: { where?: DoseWhere } = {}) => {
      return registros.find((r) => cumple(r, where)) ?? null;
    }),
    create: jest.fn(
      async ({ data }: { data: Partial<DoseRecord> & { userId: string } }) => {
        // Igual que PostgreSQL: la llave foránea a User falla con P2003
        if (!usuarios.includes(data.userId)) {
          throw Object.assign(new Error('Foreign key constraint failed'), {
            code: 'P2003',
          });
        }
        secuencia += 1;
        const registro: DoseRecord = {
          id: `dose-${secuencia}`,
          status: 'TAKEN',
          timestamp: new Date(),
          ...(data as Omit<DoseRecord, 'id' | 'status' | 'timestamp'>),
        };
        registros.push(registro);
        return registro;
      },
    ),
  };
}

describe('POST /doses/scan (e2e) - SCRUM-27', () => {
  let app: INestApplication<App>;
  let doseLog: ReturnType<typeof crearDoseLogEnMemoria>;

  const escaneoValido = {
    userId: USUARIO_EXISTENTE,
    nfcTagId: 'nfc-tag-789',
    medicationName: 'Ibuprofeno',
  };

  const escanear = (payload: unknown) =>
    request(app.getHttpServer())
      .post('/doses/scan')
      .send(payload as object);

  beforeEach(async () => {
    doseLog = crearDoseLogEnMemoria([USUARIO_EXISTENTE]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ doseLog })
      .compile();

    app = moduleFixture.createNestApplication();
    // Misma configuración que src/main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('201 - escaneo registrado', () => {
    it('registra la dosis y devuelve el registro creado', async () => {
      const res = await escanear(escaneoValido).expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        ...escaneoValido,
        status: 'TAKEN',
      });
      expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      expect(doseLog.registros).toHaveLength(1);
    });

    it('busca duplicados solo dentro del último minuto', async () => {
      const antes = Date.now();
      await escanear(escaneoValido).expect(201);

      const { where } = doseLog.findFirst.mock.calls[0][0]!;
      expect(where).toMatchObject(escaneoValido);
      const desde = where!.timestamp!.gte!.getTime();
      expect(desde).toBeGreaterThanOrEqual(antes - 60000 - 1000);
      expect(desde).toBeLessThanOrEqual(Date.now() - 60000 + 1000);
    });

    it('ignora campos que no están en el contrato', async () => {
      await escanear({
        ...escaneoValido,
        status: 'MANUAL',
        campoExtra: 'no debe guardarse',
      }).expect(201);

      expect(doseLog.create).toHaveBeenCalledWith({ data: escaneoValido });
    });

    it('permite el mismo tag con otro medicamento', async () => {
      await escanear(escaneoValido).expect(201);
      await escanear({
        ...escaneoValido,
        medicationName: 'Acetaminofén',
      }).expect(201);

      expect(doseLog.registros).toHaveLength(2);
    });

    it('permite el mismo medicamento con otro tag NFC', async () => {
      await escanear(escaneoValido).expect(201);
      await escanear({ ...escaneoValido, nfcTagId: 'nfc-tag-otro' }).expect(
        201,
      );

      expect(doseLog.registros).toHaveLength(2);
    });

    it('permite repetir la dosis cuando ya pasó más de 1 minuto', async () => {
      doseLog.registros.push({
        id: 'dose-anterior',
        ...escaneoValido,
        status: 'TAKEN',
        timestamp: new Date(Date.now() - 61000),
      });

      await escanear(escaneoValido).expect(201);
      expect(doseLog.registros).toHaveLength(2);
    });
  });

  describe('400 - payload inválido', () => {
    const casosInvalidos: [string, unknown][] = [
      ['body vacío', {}],
      [
        'falta userId',
        { nfcTagId: 'nfc-tag-789', medicationName: 'Ibuprofeno' },
      ],
      [
        'falta nfcTagId',
        { userId: USUARIO_EXISTENTE, medicationName: 'Ibuprofeno' },
      ],
      [
        'falta medicationName',
        { userId: USUARIO_EXISTENTE, nfcTagId: 'nfc-tag-789' },
      ],
      ['userId vacío', { ...escaneoValido, userId: '' }],
      ['nfcTagId vacío', { ...escaneoValido, nfcTagId: '' }],
      ['medicationName vacío', { ...escaneoValido, medicationName: '' }],
      ['userId numérico', { ...escaneoValido, userId: 123 }],
      ['nfcTagId nulo', { ...escaneoValido, nfcTagId: null }],
      [
        'medicationName como objeto',
        { ...escaneoValido, medicationName: { nombre: 'x' } },
      ],
    ];

    it.each(casosInvalidos)(
      'responde 400 cuando hay %s y no toca la base',
      async (_caso, payload) => {
        const res = await escanear(payload).expect(400);

        expect(res.body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          message: expect.any(Array),
        });
        expect(doseLog.findFirst).not.toHaveBeenCalled();
        expect(doseLog.create).not.toHaveBeenCalled();
      },
    );

    it('indica qué campo falló en el mensaje', async () => {
      const res = await escanear({
        userId: USUARIO_EXISTENTE,
        nfcTagId: 'nfc-tag-789',
      }).expect(400);

      expect(res.body.message.join(' ')).toContain('medicationName');
    });

    it('responde 400 cuando el body no es JSON válido', async () => {
      await request(app.getHttpServer())
        .post('/doses/scan')
        .set('Content-Type', 'application/json')
        .send('{"userId": ')
        .expect(400);

      expect(doseLog.create).not.toHaveBeenCalled();
    });
  });

  describe('409 - escaneo duplicado (SCRUM-24)', () => {
    it('rechaza el segundo escaneo idéntico dentro del mismo minuto', async () => {
      await escanear(escaneoValido).expect(201);

      const res = await escanear(escaneoValido).expect(409);

      expect(res.body).toMatchObject({
        status: 'DUPLICATE_WARNING',
        message: expect.stringContaining('1 minuto'),
      });
    });

    it('guarda el intento con estado DUPLICATE_WARNING sin modificar la toma original', async () => {
      await escanear(escaneoValido).expect(201);
      const original = { ...doseLog.registros[0] };

      await escanear(escaneoValido).expect(409);

      expect(doseLog.registros).toHaveLength(2);
      expect(doseLog.registros[0]).toEqual(original);
      expect(doseLog.registros[1]).toMatchObject({
        ...escaneoValido,
        status: 'DUPLICATE_WARNING',
      });
    });

    it('guarda el intento cuando ya hay una toma de hace segundos', async () => {
      doseLog.registros.push({
        id: 'dose-reciente',
        ...escaneoValido,
        status: 'TAKEN',
        timestamp: new Date(Date.now() - 30000),
      });

      await escanear(escaneoValido).expect(409);

      expect(doseLog.create).toHaveBeenCalledTimes(1);
      expect(doseLog.registros).toHaveLength(2);
      expect(doseLog.registros[1].status).toBe('DUPLICATE_WARNING');
    });

    it('registra cada intento repetido mientras dure la ventana', async () => {
      await escanear(escaneoValido).expect(201);
      await escanear(escaneoValido).expect(409);
      await escanear(escaneoValido).expect(409);

      expect(doseLog.registros.map((r) => r.status)).toEqual([
        'TAKEN',
        'DUPLICATE_WARNING',
        'DUPLICATE_WARNING',
      ]);
    });

    it('los intentos duplicados no prolongan la ventana de 1 minuto', async () => {
      // Toma a los -80 s; intento duplicado guardado a los -30 s
      doseLog.registros.push(
        {
          id: 'toma',
          ...escaneoValido,
          status: 'TAKEN',
          timestamp: new Date(Date.now() - 80000),
        },
        {
          id: 'intento',
          ...escaneoValido,
          status: 'DUPLICATE_WARNING',
          timestamp: new Date(Date.now() - 30000),
        },
      );

      // La última toma real fue hace más de 1 minuto: debe aceptarse
      await escanear(escaneoValido).expect(201);
    });
  });
});
