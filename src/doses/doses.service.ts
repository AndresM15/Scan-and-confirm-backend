import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScanDto } from './dto/create-scan.dto';

// Ventana en la que un segundo escaneo se considera duplicado (RN-01)
const DUPLICATE_WINDOW_MS = 60000;
// Tolerancia por diferencia de reloj entre el celular y el servidor
const CLOCK_SKEW_MS = 5000;

@Injectable()
export class DosesService {
  private readonly logger = new Logger(DosesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scanDose(createScanDto: CreateScanDto) {
    const { userId, nfcTagId, medicationName, clientTimestamp } = createScanDto;

    // Escaneo hecho sin conexión: se conserva la hora real del dispositivo (RN-03)
    const eventTime = clientTimestamp ? new Date(clientTimestamp) : undefined;

    if (eventTime && eventTime.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException({
        status: 'INVALID_CLIENT_TIMESTAMP',
        message: 'clientTimestamp no puede ser una fecha futura.',
      });
    }

    try {
      // 1. Ventana de duplicado: 60 segundos. Sin clientTimestamp es "el último
      //    minuto"; con clientTimestamp es 60 s alrededor de la hora del escaneo.
      const timestampFilter = eventTime
        ? {
            gte: new Date(eventTime.getTime() - DUPLICATE_WINDOW_MS),
            lte: new Date(eventTime.getTime() + DUPLICATE_WINDOW_MS),
          }
        : { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) };

      // 2. Buscamos directamente en la BD si existe un escaneo dentro de esa ventana
      const recentDose = await this.prisma.doseLog.findFirst({
        where: {
          userId,
          nfcTagId,
          medicationName,
          timestamp: timestampFilter,
        },
      });

      // 3. Si encuentra un registro reciente, lanzamos el error 409
      if (recentDose) {
        throw new HttpException(
          {
            status: 'DUPLICATE_WARNING',
            message:
              'Advertencia: Escaneo duplicado detectado en menos de 1 minuto',
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
          ...(eventTime && { timestamp: eventTime }),
        },
      });
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Si el error es violación de clave foránea P2003 (el usuario no existe en la tabla User), se rechaza el registro
      if (error?.code === 'P2003') {
        throw new NotFoundException({
          status: 'USER_NOT_FOUND',
          message: `El usuario "${userId}" no existe.`,
        });
      }

      this.logger.error('Error al procesar el escaneo:', error);
      throw error;
    }
  }
}
