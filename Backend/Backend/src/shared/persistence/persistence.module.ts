import { Global, Module } from '@nestjs/common'
import { FlowReader } from './flow-reader.js'
import { UnitOfWork } from './unit-of-work.js'

/** Shared persistence kernel: per-restaurant unit of work (lock + change feed) and the live read model. */
@Global()
@Module({ providers: [UnitOfWork, FlowReader], exports: [UnitOfWork, FlowReader] })
export class PersistenceModule {}
