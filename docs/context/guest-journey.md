# Guest Journey — Full Lifecycle Map

StayMate guest lifecycle from lead capture through post-stay retention.

---

## Stage 1: Pre-Booking (Lead Capture)

### What happens
- Guest discovers property via Airbnb, Booking.com, or direct booking page
- Direct booking page shows availability calendar, pricing, property photos
- Guest submits inquiry or booking request

### Automations
- **V1**: None (relies on platform messaging)
- **V2**: Auto-reply to inquiries within 5 min (configurable template)
- **Future**: AI-powered instant response with availability + pricing

### Data available
- Source channel, inquiry date, requested dates, guest count

### Guest actions
- Browse listing, check availability, submit inquiry, book

### Host dashboard
- New inquiry notification, source channel attribution

### Ideal communication
- Sub-5-minute response to inquiries (critical for conversion)
- Personalized message referencing their specific dates and guest count
- Direct booking discount offer if inquiry comes from OTA

### Status: Partially built (direct booking page exists, auto-reply planned)

---

## Stage 2: Booking Confirmed

### What happens
- Payment processed, reservation confirmed
- Guest token created in StayMate (unique portal access link)
- Confirmation email/SMS sent with booking summary

### Automations
- **V1**: Guest token auto-created on booking confirmation
- **V2**: Welcome email with guest portal link sent automatically
- **Future**: Pre-arrival questionnaire (preferences, allergies, special requests)

### Data available
- Full booking details, guest contact info, payment status, guest token URL

### Guest portal shows
- Booking confirmation, property address (not yet — revealed at check-in time)
- House rules overview, cancellation policy

### Guest actions
- Access guest portal, review booking details, contact host

### Host dashboard
- Booking confirmed notification, guest profile card, revenue logged

### Ideal communication
- Immediate confirmation with booking ID and next-steps timeline
- "What to expect" overview: when they'll get check-in details, etc.

### Status: Built (guest token creation, portal access)

---

## Stage 3: Pre-Arrival (T-48h)

### What happens
- Check-in instructions become available
- Property prep checklist triggered for cleaner
- Smart lock code generated (if integrated)

### Automations
- **V1**: Manual message with check-in details
- **V2**: T-48h automation rule fires: sends check-in instructions, door code, WiFi, parking info
- **Future**: Smart home integration (thermostat pre-set, lights on for evening arrivals)

### Data available
- Check-in time, property access details, local recommendations, weather forecast

### Guest portal shows
- Check-in instructions, door code, WiFi password
- Property guidebook (house rules, appliance guides)
- Local area guide / recommendations
- Emergency contacts

### Guest actions
- Review check-in instructions, save door code, browse local guide

### Host dashboard
- Upcoming arrival card, prep status, cleaner assignment

### Ideal communication
- Friendly, detailed check-in instructions with photos of entrance/lockbox
- Local restaurant/activity recommendations personalized by season
- "I'm available if you need anything" assurance

### Status: Built (T-48h automation, check-in instructions, guidebook)

---

## Stage 4: Arrival Day

### What happens
- Guest arrives and checks in
- Door code works, property is ready
- First impression is critical for review score

### Automations
- **V1**: None
- **V2**: Check-in day morning message ("excited to host you today!")
- **V2**: T+2h post check-in time: "Did everything go smoothly?" follow-up
- **Future**: Smart lock detects first entry → triggers welcome automation

### Data available
- Scheduled check-in time, actual arrival (if smart lock), any pre-arrival messages

### Guest portal shows
- All check-in details, quick links to emergency info, host contact

### Guest actions
- Check in, test WiFi/appliances, report any issues

### Host dashboard
- "Guest arrived" status (manual or smart-lock triggered)

### Ideal communication
- Brief, warm welcome on arrival morning
- Quick check 2 hours post check-in to catch issues early
- Don't over-message — one check is enough

### Status: Partially built (arrival message template exists, follow-up automation planned)

---

## Stage 5: Mid-Stay (Concierge)

### What happens
- Guest is enjoying their stay
- Opportunity for upsell (late checkout, extra cleaning, local experiences)
- Issue detection window (respond fast to problems)

### Automations
- **V1**: None
- **V2**: Mid-stay check-in for stays 4+ nights (at day 3)
- **Future**: AI concierge in guest portal (restaurant recs, activity booking)

### Data available
- Current stay duration, remaining nights, any messages/issues reported, weather

### Guest portal shows
- Local recommendations, concierge chat, issue reporting form
- Upsell options: late checkout, mid-stay cleaning, experience add-ons

### Guest actions
- Use concierge features, report issues, request services, explore area

### Host dashboard
- Active stay card, any issues flagged, upsell conversion tracking

### Ideal communication
- Day 3 check-in for longer stays only (don't bother short stays)
- Proactive weather-based recommendations ("Rain tomorrow — here are indoor activities")
- Immediate response to any issue reports

### Status: Partially built (concierge features in portal, mid-stay automation planned)

---

## Stage 6: Pre-Departure (T-24h)

### What happens
- Checkout reminder with instructions
- Cleaner scheduled for turnover
- Guest prompted to leave review

### Automations
- **V1**: Manual checkout reminder
- **V2**: T-24h automation: checkout reminder with instructions (trash, linens, lockup)
- **V2**: Checkout time reminder morning-of
- **Future**: Smart lock code auto-expires at checkout time

### Data available
- Checkout time, next guest arriving (gap analysis), cleaning schedule

### Guest portal shows
- Checkout instructions, checkout time reminder
- "How was your stay?" preliminary feedback form

### Guest actions
- Review checkout instructions, start packing, leave preliminary feedback

### Host dashboard
- Upcoming departure, next booking gap, turnover schedule

### Ideal communication
- Simple, clear checkout instructions (not a long list — 3-4 items max)
- Thank you note expressing genuine appreciation
- Subtle "we'd love your review" without being pushy

### Status: Built (checkout automation, reminder templates)

---

## Stage 7: Post-Stay (Review & Retention)

### What happens
- Guest checks out
- Review request sent (timing is critical — within 24h)
- Return booking offer sent (7-14 days later)
- Guest data archived for future marketing

### Automations
- **V1**: None (relies on platform review prompts)
- **V2**: T+24h: "Thank you" email with review link
- **V2**: T+7d: Return booking discount offer (direct booking link)
- **Future**: Anniversary message (1 year later), seasonal campaign targeting

### Data available
- Full stay data, any feedback/ratings, revenue, channel, guest preferences

### Guest portal shows
- Thank you message, review link, return booking offer
- Photo memories (if property has camera-captured sunset views etc.)

### Guest actions
- Leave review, book return stay, share property with friends

### Host dashboard
- Review received notification, return booking conversion, guest LTV tracking

### Ideal communication
- Warm thank you within 24 hours referencing something specific about their stay
- Review request as a personal ask, not generic template
- Return offer 7-14 days later with direct booking discount (save on OTA fees)
- Don't spam — 2-3 post-stay messages maximum

### Status: Partially built (review request automation, return offer planned)

---

## What's Currently Built vs Missing

| Feature | Status | Priority |
|---|---|---|
| Guest token creation | Built | -- |
| Guest portal (check-in, guidebook) | Built | -- |
| T-48h check-in automation | Built | -- |
| Checkout reminder automation | Built | -- |
| Review request (T+24h) | Built | -- |
| Arrival day welcome message | Template exists, automation planned | Medium |
| Mid-stay check-in (4+ nights) | Planned | Medium |
| Post-stay return offer | Planned | High |
| AI concierge in portal | Not started | Low |
| Smart lock integration | Not started | Medium |
| Channel-aware messaging | Not started | Medium |
| Guest LTV tracking | Not started | High |
| Direct booking engine | Basic exists | High |
| Seasonal campaign system | Not started | Low |
