# StayMate — Claude Code Orientation

## What StayMate Is

StayMate is a **short-term rental digital concierge and guest portal app**.
It serves two audiences:
- **Hosts:** Property management, guest communication, booking management, analytics
- **Guests:** Pre-arrival, during-stay, and post-stay experience portal

**Positioning:** Institutional-grade STR management platform.
**Environment:** Replit (same workspace as MarinaMatch — keep codebases clearly separated)

---

## Brett's STR Properties (Real-World Context)

| Property | Platform | Type |
|---|---|---|
| Palm Paradise | Airbnb | Duplex unit, Palm Harbor FL |
| Harbor Hideaway | Airbnb | Duplex unit, Palm Harbor FL |
| The Palm Retreat | Booking.com, fvrentals.com | Standalone 4BR house |

These properties are the primary test cases for StayMate features.

---

## Critical Known Bug

**Guest portal route mismatch:**
```
Guest portal fetches:   GET /api/properties/:id
Backend serves:         GET /api/v1/properties/:id  (behind auth)
```

The fallback path in the guest portal hits the wrong route. Fix requires either:
1. Adding an unauthenticated `/api/properties/:id` endpoint for public guest data, OR
2. Updating the guest portal to use `/api/v1/properties/:id` with appropriate auth token

**Always verify this is resolved before guest portal work.**

---

## Architecture: Four-Cloud Packaging Model

StayMate packages into four deployment tiers:

| Tier | Target | Features |
|---|---|---|
| **Solo Host** | Individual hosts (1–3 properties) | Core guest portal, basic messaging |
| **Property Manager** | PMCs (4–50 properties) | Multi-property, team, analytics |
| **Enterprise** | Large PMCs (50+ properties) | Full platform, white-label, API |
| **Marketplace** | OTAs / aggregators | API-only integration layer |

---

## Technology Stack

Same base as MarinaMatch:
- React/TypeScript frontend
- Node.js/Express backend
- PostgreSQL with Drizzle ORM (same DB, different schema namespace)
- Replit environment

---

## Phase 1 Roadmap (17 Steps)

Current status: Architectural spec complete. Active build starting from Step 1.

1. Project setup & base routing
2. Authentication (host + guest, separate flows)
3. Property schema & CRUD
4. **Fix guest portal route bug** (see above)
5. Guest portal public access (token-based, no login required)
6. Welcome modal (Phase 1 feature — see feature build plan)
7. Pre-arrival check-in form
8. Video tour embed
9. Green cleaning opt-out
10. Service request system with SLA timestamps
11. Broadcast messaging (host → all guests)
12. Hostaway integration (sync bookings, guests, messages)
13. Twilio Verify (guest phone verification)
14. SendGrid (transactional emails)
15. Stripe Connect (damage deposits, upsells)
16. PriceLabs integration (dynamic pricing sync)
17. Guest analytics dashboard

---

## Feature Build Plan (7 Prioritized Features)

File: `STAYMATE_FEATURE_BUILD_PLAN.md` in workspace root.

| Priority | Feature | Notes |
|---|---|---|
| 1 | Welcome Modal | First thing guest sees on portal load |
| 2 | Video Tour Embed | YouTube/Vimeo embed per property |
| 3 | Green Cleaning Skip | Guest opt-out with reason capture |
| 4 | Pre-Arrival Check-In Form | Guest info, ETA, preferences |
| 5 | Service Request SLA Timestamps | Request → Acknowledged → Resolved |
| 6 | Broadcast Messaging | Host sends message to all current guests |
| 7 | Guest Analytics Dashboard | Check-ins, requests, ratings, revenue |

---

## Key Integration Specs

### Hostaway
- Sync bookings, guest records, messages, listings
- Webhook receiver for real-time booking events
- API credentials stored in environment variables

```bash
HOSTAWAY_ACCOUNT_ID=
HOSTAWAY_API_KEY=
```

### Twilio Verify
- Guest phone number verification on portal access
- OTP via SMS
```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

### SendGrid
- Transactional emails: booking confirmation, pre-arrival, check-out
- Template IDs stored in config
```bash
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
```

### Stripe Connect
- Damage deposit collection
- Upsell payments (early check-in, late check-out, extras)
- Host payouts via Connect
```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=
```

### PriceLabs
- Sync dynamic pricing recommendations to listings
- Read-only integration (PriceLabs → StayMate, not bidirectional)
```bash
PRICELABS_API_KEY=
```

### Smart Lock (Future)
- Remote lock code generation per booking
- Supported: August, Yale, Schlage via RemoteLock API

---

## Database Schema (Target — PostgreSQL)

Key tables (separate from MarinaMatch schema):

```sql
-- Properties
staymate_properties (id, host_id, name, address, platform_ids JSONB, settings JSONB)

-- Bookings (synced from Hostaway/Airbnb/Booking.com)
staymate_bookings (id, property_id, guest_id, check_in, check_out, platform, status)

-- Guests
staymate_guests (id, name, email, phone, verified_phone BOOLEAN)

-- Guest Portal Sessions (token-based, no login)
staymate_portal_sessions (id, booking_id, token UUID, expires_at, created_at)

-- Service Requests
staymate_service_requests (id, booking_id, category, description,
  status, requested_at, acknowledged_at, resolved_at)

-- Messages
staymate_messages (id, booking_id, direction, channel, content, sent_at, read_at)

-- Check-in Forms
staymate_checkin_forms (id, booking_id, eta, guest_count, preferences JSONB, submitted_at)
```

---

## Guest Portal Access (Token-Based)

Guests access the portal via a unique link — no login required:
```
https://staymate.app/guest/{booking_token}
```

The `booking_token` is a UUID generated at booking creation.

```typescript
// Public endpoint — no auth middleware
router.get('/guest/:token', async (req, res) => {
  const { token } = req.params;

  const session = await pool.query(
    `SELECT ps.*, b.*, p.name as property_name
     FROM staymate_portal_sessions ps
     JOIN staymate_bookings b ON ps.booking_id = b.id
     JOIN staymate_properties p ON b.property_id = p.id
     WHERE ps.token = $1 AND ps.expires_at > NOW()`,
    [token]
  );

  if (session.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid or expired link' });
  }

  res.json(mapGuestPortalData(session.rows[0]));
});
```

---

## Claude Code for StayMate

When working on StayMate:
1. Load this file first: `cat ~/workspace/docs/context/staymate-context.md`
2. Check `STAYMATE_SPEC.md` for full architectural detail
3. Check `STAYMATE_FEATURE_BUILD_PLAN.md` for feature specs
4. All StayMate routes should be prefixed `/api/staymate/` or `/api/v1/` (with auth)
5. Guest-public routes must NOT use `requireAuth` middleware
6. Keep StayMate tables in separate schema namespace (`staymate_*` prefix)

---

## Dev Server Notes

StayMate shares the Replit environment with MarinaMatch.
Same kill/restart pattern applies:
```bash
pkill -f 'tsx server' && npm run dev
```

Confirm routes are registered properly after any new route file addition.
