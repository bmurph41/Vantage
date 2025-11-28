import passport from 'passport';
import { Strategy as SamlStrategy, Profile, VerifiedCallback } from '@node-saml/passport-saml';
import { db } from '../db';
import { ssoConfigurations, organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { enterpriseAuthService, type DeviceInfo } from './enterprise-auth-service';
import { logger } from '../lib/logger';
import { Request } from 'express';

export interface SamlConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  callbackUrl: string;
  identifierFormat?: string;
  wantAssertionsSigned?: boolean;
  signatureAlgorithm?: string;
}

export class SamlPassportService {
  private strategies: Map<string, SamlStrategy> = new Map();
  private readonly baseCallbackUrl: string;

  constructor() {
    this.baseCallbackUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.APP_URL || 'http://localhost:5000';
  }

  async initializeStrategy(orgId: string): Promise<SamlStrategy | null> {
    try {
      const config = await db.query.ssoConfigurations.findFirst({
        where: eq(ssoConfigurations.orgId, orgId)
      });

      if (!config || !config.isActive || !config.ssoUrl || !config.certificate) {
        return null;
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });

      if (!org?.ssoEnabled) {
        return null;
      }

      const samlConfig: SamlConfig = {
        entryPoint: config.ssoUrl,
        issuer: config.entityId || `${this.baseCallbackUrl}/saml/metadata/${orgId}`,
        cert: config.certificate,
        callbackUrl: `${this.baseCallbackUrl}/api/auth/saml/callback/${orgId}`,
        identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        wantAssertionsSigned: true,
        signatureAlgorithm: 'sha256',
      };

      const strategy = new SamlStrategy(
        {
          path: `/api/auth/saml/callback/${orgId}`,
          entryPoint: samlConfig.entryPoint,
          issuer: samlConfig.issuer,
          cert: samlConfig.cert,
          callbackUrl: samlConfig.callbackUrl,
          identifierFormat: samlConfig.identifierFormat,
          wantAssertionsSigned: samlConfig.wantAssertionsSigned,
          signatureAlgorithm: samlConfig.signatureAlgorithm,
          passReqToCallback: true,
        },
        async (req: Request, profile: Profile | null, done: VerifiedCallback) => {
          try {
            if (!profile) {
              return done(new Error('No profile returned from IdP'));
            }

            const attributeMapping = config.attributeMapping as Record<string, string> || {
              email: 'email',
              name: 'displayName',
              firstName: 'givenName',
              lastName: 'surname'
            };

            const email = this.extractAttribute(profile, attributeMapping.email) || profile.nameID;
            const firstName = this.extractAttribute(profile, attributeMapping.firstName);
            const lastName = this.extractAttribute(profile, attributeMapping.lastName);
            const displayName = this.extractAttribute(profile, attributeMapping.name);
            
            const name = displayName || 
              (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || email?.split('@')[0] || 'User');

            if (!email) {
              return done(new Error('Email not provided by IdP'));
            }

            const deviceInfo: DeviceInfo = {
              ipAddress: req.ip || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
              deviceType: this.detectDeviceType(req.headers['user-agent']),
              browser: this.extractBrowser(req.headers['user-agent']),
              os: this.extractOS(req.headers['user-agent']),
            };

            const result = await enterpriseAuthService.authenticateWithSso(
              profile.nameID || email,
              email,
              name,
              orgId,
              config.provider,
              deviceInfo
            );

            if (!result.success) {
              return done(new Error(result.error || 'SSO authentication failed'));
            }

            if (result.requiresMfa) {
              return done(null, { 
                ...result.user, 
                requiresMfa: true, 
                mfaToken: result.mfaToken 
              });
            }

            return done(null, { 
              ...result.user, 
              sessionToken: result.session?.sessionToken 
            });
          } catch (error) {
            logger.error({ error, orgId }, 'SAML authentication error');
            return done(error as Error);
          }
        },
        async (profile: Profile | null, done: VerifiedCallback) => {
          done(new Error('Logout callback not implemented'));
        }
      );

      this.strategies.set(orgId, strategy);
      passport.use(`saml-${orgId}`, strategy);
      
      logger.info({ orgId }, 'SAML strategy initialized');
      return strategy;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to initialize SAML strategy');
      return null;
    }
  }

  getStrategy(orgId: string): SamlStrategy | undefined {
    return this.strategies.get(orgId);
  }

  async getOrInitializeStrategy(orgId: string): Promise<SamlStrategy | null> {
    let strategy = this.strategies.get(orgId);
    if (!strategy) {
      strategy = await this.initializeStrategy(orgId) || undefined;
    }
    return strategy || null;
  }

  async refreshStrategy(orgId: string): Promise<void> {
    this.strategies.delete(orgId);
    passport.unuse(`saml-${orgId}`);
    await this.initializeStrategy(orgId);
  }

  generateMetadata(orgId: string): string | null {
    const strategy = this.strategies.get(orgId);
    if (!strategy) return null;

    try {
      return strategy.generateServiceProviderMetadata(null, null);
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to generate SAML metadata');
      return null;
    }
  }

  private extractAttribute(profile: Profile, attributeName: string): string | undefined {
    // Check common attribute locations
    const possiblePaths = [
      profile[attributeName as keyof Profile],
      (profile as any)[`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/${attributeName}`],
      (profile as any)[`http://schemas.microsoft.com/identity/claims/${attributeName}`],
      (profile as any)[`urn:oid:${this.getOidForAttribute(attributeName)}`],
    ];

    for (const value of possiblePaths) {
      if (value) {
        return Array.isArray(value) ? value[0] : String(value);
      }
    }

    return undefined;
  }

  private getOidForAttribute(name: string): string {
    const oidMap: Record<string, string> = {
      email: '0.9.2342.19200300.100.1.3',
      givenName: '2.5.4.42',
      surname: '2.5.4.4',
      displayName: '2.16.840.1.113730.3.1.241',
    };
    return oidMap[name] || '';
  }

  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private extractBrowser(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/msie|trident/i.test(userAgent)) return 'IE';
    return 'unknown';
  }

  private extractOS(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad/i.test(userAgent)) return 'iOS';
    return 'unknown';
  }
}

export const samlPassportService = new SamlPassportService();
