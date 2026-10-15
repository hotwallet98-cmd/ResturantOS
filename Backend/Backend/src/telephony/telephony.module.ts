import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DemoTelephonyProvider } from './demo-telephony.provider.js'
import { TELEPHONY_PROVIDER, type TelephonyProvider } from './telephony.types.js'
import { TwilioSonioxTelephonyProvider } from './twilio-soniox-telephony.provider.js'

/** Picks the TelephonyProvider from TELEPHONY_PROVIDER (demo | twilio). Default: demo. */
@Global()
@Module({
  providers: [
    {
      provide: TELEPHONY_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TelephonyProvider => {
        const name = (config.get<string>('TELEPHONY_PROVIDER') || 'demo').toLowerCase()
        const log = new Logger('Telephony')
        if (name === 'twilio') {
          log.warn('TELEPHONY_PROVIDER=twilio is a stub — verification calls will fail with 503')
          return new TwilioSonioxTelephonyProvider()
        }
        if (name !== 'demo') log.warn(`Unknown TELEPHONY_PROVIDER "${name}", using demo`)
        const scale = Number(config.get<string>('DEMO_CALL_TIME_SCALE') || 1)
        return new DemoTelephonyProvider(Number.isFinite(scale) && scale > 0 ? scale : 1)
      },
    },
  ],
  exports: [TELEPHONY_PROVIDER],
})
export class TelephonyModule {}
