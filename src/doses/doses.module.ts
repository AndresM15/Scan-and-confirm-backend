import { Module } from '@nestjs/common';
import { DosesController } from './doses.controller';
import { DosesService } from './doses.service';

@Module({
  controllers: [DosesController],
  providers: [DosesService],
})
export class DosesModule {}