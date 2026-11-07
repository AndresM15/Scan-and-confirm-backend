import { HttpException, HttpStatus, Logger } from '@nestjs/common';
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
    user: {
      upsert: jest.fn(),
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
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
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
          timestamp: { gte: expect.any(Date) },
        },
      });
      expect(prismaMock.doseLog.create).toHaveBeenCalledWith({
        data: scanDto,
      });
      expect(prismaMock.user.upsert).not.toHaveBeenCalled();
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
        message: 'Alerta: Escaneo duplicado en menos de 1 minuto.',
      });
      expect(prismaMock.doseLog.create).not.toHaveBeenCalled();
    });

    it('crea el usuario y reintenta el registro cuando el usuario no existe (P2003)', async () => {
      const createdDose = { id: 'dose-1', ...scanDto, status: 'TAKEN' };
      prismaMock.doseLog.findFirst.mockResolvedValue(null);
      prismaMock.doseLog.create
        .mockRejectedValueOnce({ code: 'P2003' })
        .mockResolvedValueOnce(createdDose);
      prismaMock.user.upsert.mockResolvedValue({ id: scanDto.userId });

      const result = await service.scanDose(scanDto);

      expect(result).toEqual(createdDose);
      expect(prismaMock.user.upsert).toHaveBeenCalledWith({
        where: { id: scanDto.userId },
        update: {},
        create: {
          id: scanDto.userId,
          email: expect.stringMatching(/^user123-\d+@test\.com$/),
          name: 'Usuario Test',
        },
      });
      expect(prismaMock.doseLog.create).toHaveBeenCalledTimes(2);
    });

    it('propaga cualquier otro error de la base de datos', async () => {
      const dbError = new Error('conexión perdida');
      prismaMock.doseLog.findFirst.mockRejectedValue(dbError);

      await expect(service.scanDose(scanDto)).rejects.toBe(dbError);
      expect(prismaMock.doseLog.create).not.toHaveBeenCalled();
      expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    });
  });
});
