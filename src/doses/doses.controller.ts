import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DosesService } from './doses.service';
import { CreateScanDto } from './dto/create-scan.dto';

@ApiTags('doses')
@Controller('doses')
export class DosesController {
  constructor(private readonly dosesService: DosesService) {}

  @Post('scan')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra el escaneo NFC de un medicamento' })
  @ApiResponse({ status: 201, description: 'Dosis registrada exitosamente.' })
  @ApiResponse({
    status: 400,
    description:
      'Payload inválido o incompleto (p. ej. falta nfcTagId) o clientTimestamp futuro.',
  })
  @ApiResponse({
    status: 404,
    description: 'USER_NOT_FOUND: El usuario no existe.',
  })
  @ApiResponse({
    status: 409,
    description:
      'DUPLICATE_WARNING: Dosis doble detectada en < 1 minuto. El intento se registra con estado DUPLICATE_WARNING y la toma original no se modifica.',
  })
  async scanDose(@Body() createScanDto: CreateScanDto) {
    return this.dosesService.scanDose(createScanDto);
  }
}
