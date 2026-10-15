import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import type { LoginResponse, SessionUser, VerifyMfaResponse } from '@restaurantos/contracts'
import { AuthService } from './auth.service.js'
import type { AuthUser } from './auth.types.js'
import { CurrentUser, Public } from './decorators.js'
import { LoginDto, VerifyMfaDto } from './dto.js'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.email)
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyMfaDto): Promise<VerifyMfaResponse> {
    return this.auth.verifyMfa(dto.challengeId, dto.code)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): SessionUser {
    return user.session
  }
}
