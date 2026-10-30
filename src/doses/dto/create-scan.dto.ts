import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScanDto {
  @ApiProperty({ description: 'ID del usuario', example: 'uuid-usuario-123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'ID del tag NFC escaneado', example: 'nfc-tag-789' })
  @IsString()
  @IsNotEmpty()
  nfcTagId: string;

  @ApiProperty({ description: 'Nombre del medicamento', example: 'Ibuprofeno' })
  @IsString()
  @IsNotEmpty()
  medicationName: string;
}