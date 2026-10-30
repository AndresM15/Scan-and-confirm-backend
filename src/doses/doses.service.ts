import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Injectable()
export class DosesService {
  constructor(private prisma: PrismaService) {}

  async scanDose(createScanDto: CreateScanDto) {
    const { userId, nfcTagId, medicationName } = createScanDto;

    // 1. Buscar la última dosis usando 'timestamp' en lugar de 'createdAt'
    const lastDose = await this.prisma.doseLog.findFirst({
      where: { userId, nfcTagId, medicationName },
      orderBy: { timestamp: 'desc' }, 
    });

    // 2. Validar la regla de 1 minuto usando 'timestamp'
    if (lastDose) {
      const diffInMinutes = (new Date().getTime() - lastDose.timestamp.getTime()) / 60000;

      if (diffInMinutes < 1) {
        throw new HttpException(
          {
            status: 'DUPLICATE_WARNING',
            message: 'Alerta: Escaneo duplicado en menos de 1 minuto.',
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    // 3. Crear el nuevo registro
    return this.prisma.doseLog.create({
      data: {
        userId,
        nfcTagId,
        medicationName,
      },
    });
  }
}