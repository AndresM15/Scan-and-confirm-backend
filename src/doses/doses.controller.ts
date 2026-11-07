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
  @ApiResponse({ status: 400, description: 'Payload inválido o incompleto.' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_WARNING: Dosis doble detectada en < 1 minuto.' })
  async scanDose(@Body() createScanDto: CreateScanDto) {
    return this.dosesService.scanDose(createScanDto);
  }
}
