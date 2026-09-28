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

1. Run `supabase/migrations/001_initial_schema.sql` through `supabase/migrations/007_seven_day_card_expiry.sql` in the Supabase SQL Editor, in order. Migration 005 ensures the public card ID column stores short share slugs as text. Migration 006 publishes existing drafts as free cards and clears their paid flag. Migration 007 limits existing active cards to no more than seven days from when it is applied.
2. Set `NEXT_PUBLIC_SUPABASE_URL` to the project URL.
3. Set `SUPABASE_SERVICE_ROLE_KEY` to the project's **service-role** key as a server-only environment variable. Never expose it using a `NEXT_PUBLIC_` name.
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed site's canonical HTTPS URL.
5. Set `ADMIN_EMAILS` to the comma-separated admin email allowlist, `ADMIN_PASSWORD` to a long unique password, and `ADMIN_SESSION_SECRET` to a random secret of at least 32 characters. Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Sign in at `/admin`.
6. Set `CRON_SECRET` to a long random secret. Vercel sends it to the daily cleanup endpoint; requests without the matching authorization are rejected. Keep it server-only.

On Vercel, import the project and add the variables in **Project Settings → Environment Variables** for the environments you will deploy, then deploy the project. Vercel detects this as a Next.js application; `vercel.json` schedules daily cleanup. The scheduled job requires a Vercel plan that supports Cron Jobs. Keep all credentials server-only.

## Free card builder and music

- `/create` builds cards using the four bundled themes. `/card/demo` is the bilingual sample card. Photos are converted in the browser to WebP (up to six, 200 KB each); the API checks the file type and size again.
- All themes and all nine scenes are currently free. New cards publish immediately and expire after seven days. Migration 006 converts existing drafts and published cards to free access; migration 007 gives existing active cards up to seven more days from when it is applied, without extending cards already due sooner. Payment submission and admin approval are disabled.
- Card creators can add up to six photos. The builder compresses photos to WebP (maximum 200 KB apiece); recipients see a keepsake album and can tap a photo to expand it.
- Cards without an uploaded track start with “Happy Birthday to You,” a public-domain recording by Pracchia-78 hosted on Wikimedia Commons. The source and public-domain information are available from the music-info icon; playback begins on the recipient's first tap. Card creators may replace it with one MP3 file. The custom upload becomes the card's only track, so the default song is not played. Files larger than 1 MB are trimmed client-side at the last complete MP3 frame that fits, then checked against the 1 MB server limit; other formats and malformed MP3s are rejected. Creators must confirm they own their uploaded track or have permission to use it. Custom music pauses when the tab is hidden.
- `004_card_experience.sql` adds card theme/config/payment state fields and a service-role-only rate-limit RPC/table. `005_card_public_slug.sql` ensures `cards.public_id` accepts short share slugs. The app expects the existing `cards`, `card_photos`, and `payments` tables plus the existing `birthday-cards` Storage bucket from migrations 001–003.
- The scheduled cleanup removes free cards, photos, and uploaded music after their expiry. Audio is stored in the existing `birthday-cards` bucket under the card's random slug; no extra storage migration is required because `cards.music_url` and the bucket's `audio/mpeg` support already exist.

The `.gitignore` excludes local environment files, build output, and dependencies; commit `package-lock.json`, not real credentials.
