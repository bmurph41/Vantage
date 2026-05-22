/**
 * PostHog product analytics.
 *
 * No-op when VITE_POSTHOG_KEY is absent. Import once from main.tsx for init,
 * then call trackEvent / identifyUser anywhere in the app.
 */

import posthog from 'posthog-js';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
    sanitize_properties: (props) => {
      delete props.$ip;
      return props;
    },
  });

  initialized = true;
}

export function identifyUser(user: {
  id: string;
  orgId: string;
  role: string;
  orgName?: string;
}) {
  if (!initialized) return;
  posthog.identify(user.id, {
    orgId: user.orgId,
    role: user.role,
    orgName: user.orgName,
  });
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
