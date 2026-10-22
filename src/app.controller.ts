import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('doses')
@Controller('doses')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Endpoint de prueba' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('scan')
  @ApiOperation({ summary: 'Registrar toma mediante escaneo del tag NFC' })
  @ApiResponse({ status: 201, description: 'Toma registrada exitosamente.' })
  @ApiResponse({ status: 409, description: 'Advertencia: Escaneo duplicado en < 1 min.' })
  registerDose(@Body() body: { nfcTagId: string; userId: string }) {
    return { status: 'ok', data: body };
  }
}