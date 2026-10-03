# Wishwell deployment

## Hosting

This app uses Next.js Route Handlers for card creation and retrieval, so it needs a Node.js-compatible Next.js host. A static-only upload of `dist/` will not work. From the project root, run:

```sh
npm ci
npm run lint
npm run build
npm run start
```

## Supabase

Card links are stored in Supabase so recipients can open them on another device. Before hosting:

1. Run `supabase/migrations/001_initial_schema.sql` through `supabase/migrations/021_simplified_verification_admin_controls.sql` in the Supabase SQL Editor, in order. Migration 005 ensures the public card ID column stores share IDs as text. Migration 006 publishes existing drafts as free cards and clears their paid flag. Migration 007 limits active cards to seven days. Migration 008 adds the password salt, bcrypt hash, and optional hint columns used by protected cards. Migration 009 creates the `profiles` table, default role assignment, trigger-based creation from Supabase Auth users, and RLS policies. Migration 010 adds nullable card ownership and a one-time anonymous claim token. Migration 011 gates newly created cards until an authenticated owner unlocks sharing and preserves existing cards. Migration 012 adds fixed-price pending orders and preserves the legacy `payments` table. Migration 013 independently enforces card ownership in the orders insert policy. Migration 014 adds admin-managed receiving accounts and links new orders to the selected account. Migration 015 makes activation atomic per payment method. Migration 016 adds the permanently retained, RLS-protected inbound webhook event table. Migration 018 scopes trust mappings per payment method. Migration 019 adds approval source tracking. Migration 020 enforces one paid order per card, makes automatic SMS verification atomic, replaces unrestricted admin approval with evidence-bound approval, and makes card security fields server-managed. Migration 021 simplifies automatic verification to the fixed 99 BDT rule and adds admin card lock, evidence-preserving card delete, and admin approval with optional SMS evidence.
2. Set `NEXT_PUBLIC_SUPABASE_URL` to the project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the anon key for browser auth.
3. Set `SUPABASE_SERVICE_ROLE_KEY` to the project's **service-role** key as a server-only environment variable. Never expose it using a `NEXT_PUBLIC_` name.
4. Set `NEXT_PUBLIC_SITE_URL` to the canonical base URL used by the app. The auth callback uses `${NEXT_PUBLIC_SITE_URL}/auth/callback`, so local development should be `http://localhost:3000` and production should be the deployed HTTPS domain.
5. In the Supabase dashboard, enable Email/Password and Google OAuth, then add the auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`
6. Set `ADMIN_EMAILS` to the comma-separated admin email allowlist, `ADMIN_PASSWORD` to a long unique password, and `ADMIN_SESSION_SECRET` to a random secret of at least 32 characters. Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Sign in at `/admin`.
7. Set `CRON_SECRET` to a long random secret. Vercel sends it to the daily cleanup endpoint; requests without the matching authorization are rejected. Keep it server-only.
8. Card password protection is enabled by default. Set `NEXT_PUBLIC_CARD_PREMIUM_ENABLED=false` at build time to disable it.
9. Set `SMS_WEBHOOK_SECRET` to a random server-only secret of at least 32 characters. The external SMS reader must send JSON `POST` requests to `/api/webhooks/sms` with the secret in the `X-SMS-Webhook-Secret` header. The payload must include string fields named `event_id`, `source`, and `event_type`; the complete JSON payload is stored as an unparsed event. Never use a `NEXT_PUBLIC_` name for this secret.
10. Automatic verification needs only the authenticated webhook: a supported bKash or Nagad received-money SMS for exactly 99 BDT, whose provider matches the order payment method and whose sender matches the customer wallet on exactly one pending order, with a transaction ID that has not already been credited. The optional `trusted_source` and `receiving_account` payload fields are stored as evidence only.

On Vercel, import the project and add the variables in **Project Settings → Environment Variables** for the environments you will deploy, then deploy the project. Vercel detects this as a Next.js application; `vercel.json` schedules daily cleanup. The scheduled job requires a Vercel plan that supports Cron Jobs. Keep all credentials server-only.

The authenticated `/admin` dashboard lists generated cards in pages of 50, including their saved message, photos, and expiry date. Admins can permanently delete a card; this removes its database record and uploaded assets, and detaches any related payment record.

## Free card builder and music

- `/create` builds cards using the original themes. `/card/demo` is the bilingual sample card. Photos are converted in the browser to WebP (up to eight, 200 KB each); the API checks the file type and size again.
- All themes and all nine scenes are currently free. New cards publish immediately and expire after seven days. Migration 006 converts existing drafts and published cards to free access; migration 007 gives existing active cards up to seven more days from when it is applied, without extending cards already due sooner. Payment submission and admin approval are disabled.
- Card creators can add up to eight photos. The builder compresses photos to WebP (maximum 200 KB apiece); recipients see a keepsake album and can tap a photo to expand it.
- Cards without an uploaded track start with “Happy Birthday to You,” a public-domain recording by Pracchia-78 hosted on Wikimedia Commons. The source and public-domain information are available from the music-info icon; playback begins on the recipient's first tap. Card creators may replace it with one MP3 file. The custom upload becomes the card's only track, so the default song is not played. Files larger than 1 MB are trimmed client-side at the last complete MP3 frame that fits, then checked against the 1 MB server limit; other formats and malformed MP3s are rejected. Creators must confirm they own their uploaded track or have permission to use it. Custom music pauses when the tab is hidden.
- New shared cards require a password of at least six characters. The server stores a bcrypt hash (12 rounds) and its salt, rate-limits unlock attempts, and returns content only after a valid short-lived signed HTTP-only cookie is set. The QR encodes only the card link. Run migration 008 before deploying protected-card creation.
- Cards created before password protection was enabled have no stored password hash and remain accessible through their existing share links.
- Legacy links to the retired six-card premium collection route back to the original template gallery. Existing cards with those themes continue in the original birthday-story reader.
- `004_card_experience.sql` adds card theme/config/payment state fields and a service-role-only rate-limit RPC/table. `005_card_public_slug.sql` ensures `cards.public_id` accepts short share slugs. The app expects the existing `cards`, `card_photos`, and `payments` tables plus the existing `birthday-cards` Storage bucket from migrations 001–003.
- The scheduled cleanup removes free cards, photos, and uploaded music after their expiry. Audio is stored in the existing `birthday-cards` bucket under the card's random slug; no extra storage migration is required because `cards.music_url` and the bucket's `audio/mpeg` support already exist.

The `.gitignore` excludes local environment files, build output, and dependencies; commit `package-lock.json`, not real credentials.
