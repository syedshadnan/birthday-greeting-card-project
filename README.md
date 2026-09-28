# Wishwell

Wishwell is a Next.js birthday-card site with an existing template editor and a bilingual, nine-scene birthday story.

## Run and deploy

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill in the server credentials.
3. Run Supabase migrations `001_initial_schema.sql` through `007_seven_day_card_expiry.sql` in order. Migration 006 makes existing draft and published cards free and publishes drafts. Migration 007 limits existing active cards to no more than seven days from when it is applied.
4. Run `npm run dev` locally, or `npm run lint` and `npm run build` before deploying to Vercel.
5. Set the same environment variables in Vercel. See [DEPLOY.md](./DEPLOY.md) for the full setup, Storage bucket, and cron details.

## Free cards

Every theme and all nine story scenes are currently free. New cards are published immediately and expire after seven days. Migration `007_seven_day_card_expiry.sql` also limits existing active cards to seven days from when the migration is applied, without extending cards already due sooner. Payment submission and admin approval are disabled.

## Themes and music

Add themes in `src/lib/cards/themes.ts`, then add their visual styles in `src/card-polish.css`. The birthday story includes a photo album with tap-to-expand memories, a fold-open keepsake note, and a personalized wish picker. Creators can add up to six photos in the card builder; images are compressed to WebP before upload. Cards without an uploaded track play “Happy Birthday to You,” a public-domain recording by Pracchia-78 hosted on Wikimedia Commons. Creators can replace it with their own MP3; a custom upload is stored as the card's only track, so the default is not played. Files over 1 MB are trimmed to the last complete MP3 frame within the limit, and the creator must confirm they have permission to use it. See [DEPLOY.md](./DEPLOY.md) for details.
