import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DosesService } from './doses.service';

describe('DosesService', () => {
  let service: DosesService;

  // Prisma simulado: los tests no tocan la base de datos
  const prismaMock = {
    doseLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const scanDto = {
    userId: 'user-123',
    nfcTagId: 'nfc-tag-789',
    medicationName: 'Ibuprofeno',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Silencia los logs del servicio durante las pruebas
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DosesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DosesService>(DosesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('scanDose', () => {
    it('registra la dosis cuando no hay un escaneo previo en el último minuto', async () => {
      const createdDose = {
        id: 'dose-1',
        ...scanDto,
        timestamp: new Date(),
        status: 'TAKEN',
      };
      prismaMock.doseLog.findFirst.mockResolvedValue(null);
      prismaMock.doseLog.create.mockResolvedValue(createdDose);

      const result = await service.scanDose(scanDto);

      expect(result).toEqual(createdDose);
      expect(prismaMock.doseLog.findFirst).toHaveBeenCalledWith({
        where: {
          ...scanDto,
          status: { not: 'DUPLICATE_WARNING' },
          timestamp: { gte: expect.any(Date) },
        },
      });
      expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
        data: scanDto,
      });
    });

    it('busca duplicados solo dentro de los últimos 60 segundos', async () => {
      const now = new Date('2026-11-06T19:00:00.000Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      prismaMock.doseLog.findFirst.mockResolvedValue(null);
      prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

      await service.scanDose(scanDto);

      const { where } = prismaMock.doseLog.findFirst.mock.calls[0][0];
      expect(where.timestamp.gte).toEqual(new Date(now - 60000));
    });

    it('lanza 409 DUPLICATE_WARNING si la misma dosis se escaneó hace menos de 60 segundos', async () => {
      prismaMock.doseLog.findFirst.mockResolvedValue({
        id: 'dose-previa',
        ...scanDto,
        timestamp: new Date(Date.now() - 30000),
        status: 'TAKEN',
      });

      const error = await service.scanDose(scanDto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as HttpException).getResponse()).toEqual({
        status: 'DUPLICATE_WARNING',
        message:
          'Advertencia: Escaneo duplicado detectado en menos de 1 minuto',
      });
    });

    it('guarda el intento duplicado con estado DUPLICATE_WARNING (SCRUM-24)', async () => {
      prismaMock.doseLog.findFirst.mockResolvedValue({ id: 'dose-previa' });

      await service.scanDose(scanDto).catch(() => undefined);

      expect(prismaMock.doseLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
        data: { ...scanDto, status: 'DUPLICATE_WARNING' },
      });
    });

    it('ignora los intentos DUPLICATE_WARNING al buscar la toma reciente', async () => {
      prismaMock.doseLog.findFirst.mockResolvedValue(null);
      prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

      await service.scanDose(scanDto);

      const { where } = prismaMock.doseLog.findFirst.mock.calls[0][0];
      expect(where.status).toEqual({ not: 'DUPLICATE_WARNING' });
    });

    it('responde 409 aunque falle el guardado del intento duplicado', async () => {
      prismaMock.doseLog.findFirst.mockResolvedValue({ id: 'dose-previa' });
      prismaMock.doseLog.create.mockRejectedValue(new Error('BD caída'));

      const error = await service.scanDose(scanDto).catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    });

    describe('con clientTimestamp (escaneo hecho sin conexión)', () => {
      const now = new Date('2026-11-09T14:00:00.000Z').getTime();
      const offlineTime = new Date('2026-11-09T13:00:00.000Z');

      beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(now);
      });

      it('guarda la hora real del dispositivo como timestamp', async () => {
        prismaMock.doseLog.findFirst.mockResolvedValue(null);
        prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

        await service.scanDose({
          ...scanDto,
          clientTimestamp: offlineTime.toISOString(),
        });

        expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
          data: { ...scanDto, timestamp: offlineTime },
        });
      });

      it('busca duplicados en 60 segundos alrededor de la hora del escaneo', async () => {
        prismaMock.doseLog.findFirst.mockResolvedValue(null);
        prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

        await service.scanDose({
          ...scanDto,
          clientTimestamp: offlineTime.toISOString(),
        });

        const { where } = prismaMock.doseLog.findFirst.mock.calls[0][0];
        expect(where.timestamp).toEqual({
          gte: new Date(offlineTime.getTime() - 60000),
          lte: new Date(offlineTime.getTime() + 60000),
        });
      });

      it('lanza 409 si ya hay una dosis a menos de 60 segundos de esa hora', async () => {
        prismaMock.doseLog.findFirst.mockResolvedValue({ id: 'dose-previa' });

        const error = await service
          .scanDose({ ...scanDto, clientTimestamp: offlineTime.toISOString() })
          .catch((e: unknown) => e);

        expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        // El intento se guarda con la hora real del dispositivo
        expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
          data: {
            ...scanDto,
            status: 'DUPLICATE_WARNING',
            timestamp: offlineTime,
          },
        });
      });

      it('rechaza con 400 un clientTimestamp futuro', async () => {
        const future = new Date(now + 60 * 60 * 1000).toISOString();

        const error = await service
          .scanDose({ ...scanDto, clientTimestamp: future })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          status: 'INVALID_CLIENT_TIMESTAMP',
          message: 'clientTimestamp no puede ser una fecha futura.',
        });
        expect(prismaMock.doseLog.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.doseLog.create).not.toHaveBeenCalled();
      });

      it('tolera una diferencia de reloj de pocos segundos', async () => {
        prismaMock.doseLog.findFirst.mockResolvedValue(null);
        prismaMock.doseLog.create.mockResolvedValue({ id: 'dose-1' });

        await expect(
          service.scanDose({
            ...scanDto,
            clientTimestamp: new Date(now + 2000).toISOString(),
          }),
        ).resolves.toBeDefined();
      });
    });

    it('rechaza con 404 USER_NOT_FOUND cuando el usuario no existe (P2003)', async () => {
      prismaMock.doseLog.findFirst.mockResolvedValue(null);
      prismaMock.doseLog.create.mockRejectedValue({ code: 'P2003' });

      const error = await service.scanDose(scanDto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getStatus()).toBe(
        HttpStatus.NOT_FOUND,
      );
      expect((error as NotFoundException).getResponse()).toEqual({
        status: 'USER_NOT_FOUND',
        message: 'El usuario "user-123" no existe.',
      });
      // No se crea ningún usuario ni se reintenta el registro
      expect(prismaMock.doseLog.create).toHaveBeenCalledTimes(1);
    });

    it('propaga cualquier otro error de la base de datos', async () => {
      const dbError = new Error('conexión perdida');
      prismaMock.doseLog.findFirst.mockRejectedValue(dbError);

      await expect(service.scanDose(scanDto)).rejects.toBe(dbError);
      expect(prismaMock.doseLog.create).not.toHaveBeenCalled();
    });
  });
});
