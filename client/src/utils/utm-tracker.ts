// UTM Parameter and Session Tracking Utility for Lead Attribution
// This utility captures and stores UTM parameters and session data for lead attribution

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface SessionData {
  sessionId: string;
  landingPageUrl: string;
  referrerUrl: string;
  deviceType: string;
  ipAddress?: string;
  timestamp: number;
}

interface TouchpointData {
  source: string;
  medium?: string;
  campaign?: string;
  timestamp: number;
  url: string;
  referrer?: string;
}

interface AttributionData {
  originalSource: string;
  lastTouchSource: string;
  touchpoints: TouchpointData[];
  utmData: UTMParams;
  sessionData: SessionData;
}

class UTMTracker {
  private static instance: UTMTracker;
  private attribution: AttributionData | null = null;
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  public static getInstance(): UTMTracker {
    if (!UTMTracker.instance) {
      UTMTracker.instance = new UTMTracker();
    }
    return UTMTracker.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }

  private parseURLParameters(url: string = window.location.href): UTMParams {
    const urlParams = new URLSearchParams(new URL(url).search);
    
    return {
      utm_source: urlParams.get('utm_source') || undefined,
      utm_medium: urlParams.get('utm_medium') || undefined,
      utm_campaign: urlParams.get('utm_campaign') || undefined,
      utm_term: urlParams.get('utm_term') || undefined,
      utm_content: urlParams.get('utm_content') || undefined,
    };
  }

  private determineSourceFromParams(utmParams: UTMParams, referrer: string): string {
    // Priority 1: UTM Source
    if (utmParams.utm_source) {
      if (utmParams.utm_medium === 'cpc' || utmParams.utm_source.includes('google')) {
        return 'google_ads';
      }
      if (utmParams.utm_source.includes('facebook')) {
        return 'facebook_ads';
      }
      if (utmParams.utm_source.includes('linkedin')) {
        return 'linkedin';
      }
      if (utmParams.utm_source.includes('twitter')) {
        return 'twitter';
      }
      if (utmParams.utm_source.includes('email')) {
        return 'email';
      }
      return utmParams.utm_source;
    }

    // Priority 2: Referrer Analysis
    if (referrer) {
      const referrerDomain = new URL(referrer).hostname.toLowerCase();
      
      if (referrerDomain.includes('google.com')) {
        return utmParams.utm_medium === 'cpc' ? 'google_ads' : 'google';
      }
      if (referrerDomain.includes('facebook.com') || referrerDomain.includes('fb.com')) {
        return 'facebook';
      }
      if (referrerDomain.includes('linkedin.com')) {
        return 'linkedin';
      }
      if (referrerDomain.includes('twitter.com') || referrerDomain.includes('t.co')) {
        return 'twitter';
      }
      if (referrerDomain.includes('bing.com') || referrerDomain.includes('yahoo.com')) {
        return 'organic_search';
      }
      
      // Other external domains are referrals
      if (!referrerDomain.includes(window.location.hostname)) {
        return 'referral';
      }
    }

    // Priority 3: Default to direct
    return 'direct';
  }

  private initializeTracking(): void {
    try {
      // Get current page data
      const currentUrl = window.location.href;
      const referrer = document.referrer;
      const utmParams = this.parseURLParameters(currentUrl);
      
      // Determine the source
      const currentSource = this.determineSourceFromParams(utmParams, referrer);
      
      // Create session data
      const sessionData: SessionData = {
        sessionId: this.sessionId,
        landingPageUrl: currentUrl,
        referrerUrl: referrer,
        deviceType: this.getDeviceType(),
        timestamp: Date.now(),
      };

      // Create touchpoint
      const touchpoint: TouchpointData = {
        source: currentSource,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        timestamp: Date.now(),
        url: currentUrl,
        referrer: referrer || undefined,
      };

      // Check for existing attribution data
      const existingData = this.getStoredAttribution();
      
      if (existingData && this.isWithinSession(existingData.sessionData.timestamp)) {
        // Update existing session - last touch attribution
        this.attribution = {
          ...existingData,
          lastTouchSource: currentSource,
          touchpoints: [...existingData.touchpoints, touchpoint],
          sessionData: { ...existingData.sessionData, ...sessionData },
        };
      } else {
        // New session - first touch attribution
        this.attribution = {
          originalSource: currentSource,
          lastTouchSource: currentSource,
          touchpoints: [touchpoint],
          utmData: utmParams,
          sessionData,
        };
      }

      // Store the attribution data
      this.storeAttribution();
      
    } catch (error) {
      console.error('UTM Tracker initialization failed:', error);
    }
  }

  private isWithinSession(timestamp: number): boolean {
    // Consider it the same session if within 30 minutes
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    return Date.now() - timestamp < sessionTimeout;
  }

  private storeAttribution(): void {
    if (this.attribution) {
      try {
        localStorage.setItem('lead_attribution', JSON.stringify(this.attribution));
        
        // Also store in sessionStorage for immediate use
        sessionStorage.setItem('current_session', JSON.stringify({
          sessionId: this.sessionId,
          source: this.attribution.lastTouchSource,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error('Failed to store attribution data:', error);
      }
    }
  }

  private getStoredAttribution(): AttributionData | null {
    try {
      const stored = localStorage.getItem('lead_attribution');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve stored attribution:', error);
      return null;
    }
  }

  public getAttribution(): AttributionData | null {
    return this.attribution || this.getStoredAttribution();
  }

  public updateAttribution(updates: Partial<AttributionData>): void {
    if (this.attribution) {
      this.attribution = { ...this.attribution, ...updates };
      this.storeAttribution();
    }
  }

  public trackPageView(url?: string): void {
    const currentUrl = url || window.location.href;
    const utmParams = this.parseURLParameters(currentUrl);
    
    if (Object.keys(utmParams).some(key => utmParams[key as keyof UTMParams])) {
      // New UTM parameters detected, update attribution
      const newSource = this.determineSourceFromParams(utmParams, document.referrer);
      
      const touchpoint: TouchpointData = {
        source: newSource,
        medium: utmParams.utm_medium,
        campaign: utmParams.utm_campaign,
        timestamp: Date.now(),
        url: currentUrl,
        referrer: document.referrer || undefined,
      };

      if (this.attribution) {
        this.attribution.lastTouchSource = newSource;
        this.attribution.touchpoints.push(touchpoint);
        this.attribution.utmData = { ...this.attribution.utmData, ...utmParams };
        this.storeAttribution();
      }
    }
  }

  public getLeadAttributionData(): Partial<any> {
    const attribution = this.getAttribution();
    
    if (!attribution) {
      return {
        leadSource: 'direct',
        originalSource: 'direct',
        lastTouchSource: 'direct',
      };
    }

    return {
      leadSource: attribution.lastTouchSource,
      originalSource: attribution.originalSource,
      lastTouchSource: attribution.lastTouchSource,
      utmSource: attribution.utmData.utm_source,
      utmMedium: attribution.utmData.utm_medium,
      utmCampaign: attribution.utmData.utm_campaign,
      utmTerm: attribution.utmData.utm_term,
      utmContent: attribution.utmData.utm_content,
      landingPageUrl: attribution.sessionData.landingPageUrl,
      referrerUrl: attribution.sessionData.referrerUrl,
      deviceType: attribution.sessionData.deviceType,
      sessionId: attribution.sessionData.sessionId,
      touchpoints: JSON.stringify(attribution.touchpoints),
    };
  }

  public clearAttribution(): void {
    this.attribution = null;
    localStorage.removeItem('lead_attribution');
    sessionStorage.removeItem('current_session');
  }

  // Static methods for easy access
  public static getAttribution(): AttributionData | null {
    return UTMTracker.getInstance().getAttribution();
  }

  public static getLeadData(): Partial<any> {
    return UTMTracker.getInstance().getLeadAttributionData();
  }

  public static trackPageView(url?: string): void {
    UTMTracker.getInstance().trackPageView(url);
  }

  public static clearTracking(): void {
    UTMTracker.getInstance().clearAttribution();
  }
}

// Auto-initialize when the script loads
let tracker: UTMTracker;

export const initializeUTMTracking = (): void => {
  if (typeof window !== 'undefined') {
    tracker = UTMTracker.getInstance();
    
    // Track page views on navigation
    window.addEventListener('popstate', () => {
      tracker.trackPageView();
    });
    
    // Track hash changes
    window.addEventListener('hashchange', () => {
      tracker.trackPageView();
    });
  }
};

export const getLeadAttributionData = (): Partial<any> => {
  return UTMTracker.getLeadData();
};

export const trackPageView = (url?: string): void => {
  UTMTracker.trackPageView(url);
};

export const getAttributionData = (): AttributionData | null => {
  return UTMTracker.getAttribution();
};

export const clearTracking = (): void => {
  UTMTracker.clearTracking();
};

// Default export
export default UTMTracker;