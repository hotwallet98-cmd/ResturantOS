import { BadGatewayException, Body, Controller, HttpCode, Logger, Module, Post, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IsIn, IsOptional } from 'class-validator'
import type { SonioxConfigRequest, SonioxConfigResponse } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser } from '../identity/decorators.js'

class SonioxConfigDto implements SonioxConfigRequest {
  @IsOptional()
  @IsIn(['transcribe_websocket', 'tts_rt'])
  usage?: 'transcribe_websocket' | 'tts_rt'
}

/** Soniox REST hosts per data-residency region (https://soniox.com/docs/data-residency). */
const SONIOX_HOSTS: Record<string, string> = {
  us: 'api.soniox.com',
  eu: 'api.eu.soniox.com',
  jp: 'api.jp.soniox.com',
  in: 'api.in.soniox.com',
}
const KEY_TTL_SECONDS = 300

@Controller('voice')
export class VoiceController {
  private readonly log = new Logger('Voice')

  constructor(private readonly config: ConfigService) {}

  /**
   * Temporary Soniox key for the browser / app, so SONIOX_API_KEY never leaves the server.
   * Soniox API: POST https://api.soniox.com/v1/auth/temporary-api-key
   *   { usage_type: "transcribe_websocket" | "tts_rt", expires_in_seconds: 1..3600, client_reference_id? } → 201 { api_key, expires_at }
   */
  @Post('soniox-config')
  @HttpCode(200)
  async sonioxConfig(@CurrentUser() user: AuthUser, @Body() dto: SonioxConfigDto): Promise<SonioxConfigResponse> {
    const apiKey = this.config.get<string>('SONIOX_API_KEY')
    if (!apiKey) throw new ServiceUnavailableException('Voice is not configured: set SONIOX_API_KEY in Backend/api/.env (get a key at https://console.soniox.com) and restart the API.')
    const region = (this.config.get<string>('SONIOX_REGION') || 'us').toLowerCase()
    const host = SONIOX_HOSTS[region] ?? SONIOX_HOSTS.us
    let res: Response
    try {
      res = await fetch(`https://${host}/v1/auth/temporary-api-key`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usage_type: dto.usage ?? 'transcribe_websocket', expires_in_seconds: KEY_TTL_SECONDS, client_reference_id: `${user.restaurantId ?? 'platform'}:${user.id}` }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (e) {
      this.log.error(`Soniox unreachable: ${e instanceof Error ? e.message : e}`)
      throw new BadGatewayException('Could not reach Soniox to create a temporary key')
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.log.error(`Soniox temporary key failed: ${res.status} ${body.slice(0, 300)}`)
      throw new BadGatewayException(`Soniox refused the temporary key request (${res.status}). Check SONIOX_API_KEY / SONIOX_REGION.`)
    }
    const data = (await res.json()) as { api_key: string; expires_at?: string }
    return region !== 'us' && SONIOX_HOSTS[region] ? { api_key: data.api_key, region } : { api_key: data.api_key }
  }
}

/** Voice: temporary Soniox API keys for the browser / apps. */
@Module({ controllers: [VoiceController] })
export class VoiceModule {}
