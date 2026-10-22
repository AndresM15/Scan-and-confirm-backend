import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Scan & Confirm API')
    .setDescription(
      'API para la validación instantánea de dosis y prevención de amnesia de rutina con NFC.',
    )
    .setVersion('1.0')
    .addTag('doses', 'Endpoints relacionados con la lectura y registro de dosis')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Swagger documentación corriendo en: http://localhost:${port}/api/docs`);
}
bootstrap();