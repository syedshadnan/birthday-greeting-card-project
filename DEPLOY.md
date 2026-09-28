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

1. Run `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_card_sharing.sql`, and `supabase/migrations/003_manual_payments.sql` in the Supabase SQL Editor.
2. Set `NEXT_PUBLIC_SUPABASE_URL` to the project URL.
3. Set `SUPABASE_SERVICE_ROLE_KEY` to the project's **service-role** key as a server-only environment variable. Never expose it using a `NEXT_PUBLIC_` name.
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed site's canonical HTTPS URL.
5. Set `ADMIN_EMAILS` to the comma-separated admin email allowlist, `ADMIN_PASSWORD` to a long unique password, and `ADMIN_SESSION_SECRET` to a random secret of at least 32 characters. Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Sign in at `/admin`.
6. Set `BKASH_PERSONAL_NUMBER` and `NAGAD_PERSONAL_NUMBER` to the 11-digit personal account numbers that should receive transfers. These numbers are shown publicly on the payment page.

On Vercel, import the project and add the variables in **Project Settings → Environment Variables** for the environments you will deploy, then deploy the project. Vercel detects this as a Next.js application; `vercel.json` records the framework. Keep all credentials server-only.

Customers make a manual transfer, enter the payer's phone and transaction ID, and receive a pending confirmation. The admin must check the personal account and explicitly verify the transaction at `/admin`; only then is the card published. This is not an automated payment gateway and cannot independently confirm transfers. Never approve a payment based only on its submitted transaction ID. Confirm that using personal accounts for your intended sales complies with bKash/Nagad terms and local requirements.

Card links and uploaded media expire after 30 days; scheduled database and storage cleanup is not configured. The `.gitignore` excludes local environment files, build output, and dependencies; commit `package-lock.json`, not real credentials.
