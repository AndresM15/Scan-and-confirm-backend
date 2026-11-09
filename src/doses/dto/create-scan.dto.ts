import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScanDto {
  @ApiProperty({ description: 'ID del usuario', example: 'uuid-usuario-123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'ID del tag NFC escaneado',
    example: 'nfc-tag-789',
  })
  @IsString()
  @IsNotEmpty()
  nfcTagId: string;

  @ApiProperty({ description: 'Nombre del medicamento', example: 'Ibuprofeno' })
  @IsString()
  @IsNotEmpty()
  medicationName: string;

  @ApiPropertyOptional({
    description:
      'Fecha y hora real del escaneo en el dispositivo (ISO 8601). Úsese al sincronizar escaneos hechos sin conexión; si se omite, el servidor usa la hora actual. No puede ser futura.',
    example: '2026-11-09T13:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  clientTimestamp?: string;
}
