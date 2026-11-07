import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Injectable()
export class DosesService {
  private readonly logger = new Logger(DosesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scanDose(createScanDto: CreateScanDto) {
    const { userId, nfcTagId, medicationName } = createScanDto;

    try {
      // 1. Calculamos la fecha y hora de hace exactamente 60 segundos (1 minuto)
      const oneMinuteAgo = new Date(Date.now() - 60000);

      // 2. Buscamos directamente en la BD si existe un escaneo DESPUÉS de ese minuto
      const recentDose = await this.prisma.doseLog.findFirst({
        where: {
          userId,
          nfcTagId,
          medicationName,
          timestamp: {
            gte: oneMinuteAgo,
          },
        },
      });

      // 3. Si encuentra un registro reciente, lanzamos el error 409
      if (recentDose) {
        throw new HttpException(
          {
            status: 'DUPLICATE_WARNING',
            message: 'Alerta: Escaneo duplicado en menos de 1 minuto.',
          },
          HttpStatus.CONFLICT,
        );
      }

      // 4. Si pasa la validación (no hay duplicados), creamos el nuevo registro
      return await this.prisma.doseLog.create({
        data: {
          userId,
          nfcTagId,
          medicationName,
        },
      });
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Si el error es violación de clave foránea P2003 (el usuario de prueba no existe en la tabla User)
      if (error?.code === 'P2003') {
        this.logger.warn(`Usuario "${userId}" no existía en la base de datos. Creando usuario para permitir el registro...`);
        const safePrefix = userId.replace(/[^a-zA-Z0-9]/g, '') || 'user';
        await this.prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: `${safePrefix}-${Date.now()}@test.com`,
            name: 'Usuario Test',
          },
        });

        // Reintentamos crear la dosis
        return this.prisma.doseLog.create({
          data: {
            userId,
            nfcTagId,
            medicationName,
          },
        });
      }

      this.logger.error('Error al procesar el escaneo:', error);
      throw error;
    }
  }
}
