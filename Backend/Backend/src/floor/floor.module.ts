import { Module } from '@nestjs/common'
import { TablesController } from './floor.controller.js'
import { FloorService } from './floor.service.js'

/** Floor: tables, reservations, seating, bill requests. */
@Module({ controllers: [TablesController], providers: [FloorService], exports: [FloorService] })
export class FloorModule {}
