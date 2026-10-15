import { IsEmail, IsString, Matches, MinLength } from 'class-validator'
import type { LoginRequest, VerifyMfaRequest } from '@restaurantos/contracts'

export class LoginDto implements LoginRequest {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(1)
  password: string
}

export class VerifyMfaDto implements VerifyMfaRequest {
  @IsString()
  challengeId: string

  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code: string
}
