import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DosesModule } from './doses/doses.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [DosesModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}