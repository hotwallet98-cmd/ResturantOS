import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common'
import { CurrentUser, Roles } from '../identity/decorators.js'
import type { AuthUser } from '../identity/auth.types.js'
import { AdminService } from './admin.service.js'

type Payload = Record<string, unknown>

@Controller('admin')
@Roles('super_admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard') dashboard() { return this.admin.dashboard() }
  @Get('tenants/activity') tenantActivity() { return this.admin.tenantActivity() }
  @Get('tenants') tenants() { return this.admin.tenants() }
  @Post('tenants') createTenant(@Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.createTenant(body, user) }
  @Patch('tenants/:id') updateTenant(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.updateTenant(id, body, user) }

  @Get('onboarding') onboarding() { return this.admin.list('onboarding') }
  @Post('onboarding') submitOnboarding(@Body() body: Payload, @CurrentUser() user: AuthUser) { const id = String(body.id ?? `APP-${Date.now()}`); return this.admin.put('onboarding', id, { ...body, id, submittedAt: body.submittedAt ?? new Date().toISOString() }, user, { action: 'Created onboarding application', category: 'Tenant' }) }
  @Patch('onboarding/:id') updateOnboarding(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('onboarding', id, body, user, { action: 'Updated onboarding application', category: 'Tenant' }) }

  @Get('plans') plans() { return this.admin.plans() }
  @Post('plans') createPlan(@Body() body: Payload, @CurrentUser() user: AuthUser) { const id = String(body.id ?? `P-${Date.now()}`); return this.admin.put('plan', id, { ...body, id }, user, { action: 'Created plan', category: 'Billing' }) }
  @Put('plans/:id') savePlan(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('plan', id, body, user, { action: 'Updated plan', category: 'Billing' }) }
  @Get('modules/pricing') modules() { return this.admin.modules() }
  @Patch('modules/pricing/:id') modulePrice(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('module_price', id, body, user, { action: 'Updated module pricing', category: 'Billing' }) }
  @Get('subscriptions/changes') planChanges() { return this.admin.list('plan_change') }
  @Post('subscriptions/changes') createPlanChange(@Body() body: Payload, @CurrentUser() user: AuthUser) { const id = String(body.id ?? randomId('PC')); return this.admin.put('plan_change', id, { ...body, id }, user, { action: 'Created plan change', category: 'Billing' }) }
  @Get('subscriptions') subscriptions() { return this.admin.subscriptions() }
  @Patch('subscriptions/:id') updateSubscription(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.updateSubscription(id, body, user) }
  @Get('invoices') invoices() { return this.admin.list('invoice') }
  @Patch('invoices/:id') updateInvoice(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('invoice', id, body, user, { action: 'Updated invoice', category: 'Billing' }) }
  @Get('billing/renewal-rules') renewalRules() { return this.admin.list('renewal_rule') }
  @Patch('billing/renewal-rules/:id') renewalRule(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('renewal_rule', id, body, user, { action: 'Updated renewal rule', category: 'Billing' }) }
  @Get('billing/analytics') billing() { return this.admin.billingAnalytics() }

  @Get('users') users() { return this.admin.platformUsers() }
  @Post('users') inviteUser(@Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.invitePlatformUser(body, user) }
  @Patch('users/:id') updateUser(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.updatePlatformUser(id, body, user) }
  @Get('roles') roles() { return this.admin.roles() }
  @Put('roles/:id') saveRole(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('platform_role', id, body, user, { action: 'Updated platform role', category: 'User' }) }
  @Get('assignments') assignments() { return this.admin.list('admin_assignment') }
  @Put('assignments/:id') saveAssignment(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('admin_assignment', id, body, user, { action: 'Updated admin assignment', category: 'User' }) }
  @Get('access-logs') accessLogs() { return this.admin.accessLogs() }

  @Get('security/suspicious') suspicious() { return this.admin.list('suspicious_activity') }
  @Patch('security/suspicious/:id') updateSuspicious(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('suspicious_activity', id, body, user, { action: 'Updated suspicious activity', category: 'Security' }) }
  @Get('security/policy') policy() { return this.admin.singleton('security_policy', securityPolicyDefaults) }
  @Put('security/policy') savePolicy(@Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('security_policy', 'default', body, user, { action: 'Updated security policy', category: 'Security' }) }
  @Get('security/password-resets') resets() { return this.admin.list('password_reset') }
  @Get('security/sessions') sessions() { return this.admin.sessions() }
  @Delete('security/sessions/:id') revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.admin.revokeSession(id, user) }
  @Get('security/login-activity') logins() { return this.admin.loginActivity() }
  @Get('security/audit-logs') audits() { return this.admin.auditLogs() }

  @Get('config/settings') settings() { return this.admin.singleton('global_settings', globalSettingsDefaults) }
  @Put('config/settings') saveSettings(@Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('global_settings', 'default', body, user, { action: 'Updated global settings', category: 'Config' }) }
  @Get('config/integrations') integrations() { return this.admin.integrations() }
  @Patch('config/integrations/:id') integration(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('integration', id, body, user, { action: 'Updated integration', category: 'Config' }) }
  @Get('config/ai-models') aiModels() { return this.admin.list('ai_model') }
  @Put('config/ai-models/:id') aiModel(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('ai_model', id, body, user, { action: 'Updated AI model', category: 'Config' }) }
  @Get('config/feature-flags') flags() { return this.admin.list('feature_flag') }
  @Patch('config/feature-flags/:id') flag(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('feature_flag', id, body, user, { action: 'Updated feature flag', category: 'Config' }) }
  @Get('config/ai-usage') aiUsage() { return this.admin.aiUsage() }
  @Get('config/ai-limits') aiLimits() { return this.admin.singleton('ai_limits', aiLimitsDefaults) }
  @Put('config/ai-limits') saveAiLimits(@Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('ai_limits', 'default', body, user, { action: 'Updated AI limits', category: 'Config' }) }

  @Get('support/tickets') tickets() { return this.admin.list('support_ticket') }
  @Patch('support/tickets/:id') ticket(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('support_ticket', id, body, user, { action: 'Updated support ticket', category: 'Support' }) }
  @Get('monitoring/services') services() { return this.admin.serviceStatuses() }
  @Get('monitoring/latency') latency() { return [] }
  @Get('monitoring/errors') errors() { return this.admin.list('system_error') }
  @Patch('monitoring/errors/:id') error(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.patch('system_error', id, body, user, { action: 'Updated system error', category: 'Support' }) }
  @Get('incidents') incidents() { return this.admin.list('incident') }
  @Put('incidents/:id') incident(@Param('id') id: string, @Body() body: Payload, @CurrentUser() user: AuthUser) { return this.admin.put('incident', id, body, user, { action: 'Updated incident', category: 'Support' }) }
}

const securityPolicyDefaults = { mfaRequired: true, mfaMethods: { authenticator: true, sms: false, email: false, securityKey: false }, mfaGraceDays: 0, rememberDeviceDays: 14, passwordMinLength: 12, passwordRequireSymbols: true, passwordRequireNumbers: true, passwordRequireMixedCase: true, passwordExpiryDays: 90, passwordHistory: 5, lockoutAttempts: 5, resetLinkMinutes: 30, sessionIdleMinutes: 30, sessionMaxHours: 12, singleSession: false, ipAllowlist: '' }
const globalSettingsDefaults = { platformName: 'RestaurantOS', supportEmail: '', defaultCurrency: 'USD', defaultTimezone: 'UTC', defaultLanguage: 'English', dataRegion: 'Local PostgreSQL', maintenanceMode: false, allowSelfSignup: false, requireVerification: true, dataRetentionDays: 730 }
const aiLimitsDefaults = { starter: 500, growth: 3000, pro: 10000, enterprise: 50000, hardStop: false, alertAt: 80, monthlyBudget: 0 }
const randomId = (prefix: string) => `${prefix}-${Date.now()}`
