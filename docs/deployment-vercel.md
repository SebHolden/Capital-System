# Deploy su Vercel

Guida per pubblicare **Seb Capital System** su [Vercel](https://vercel.com) con database PostgreSQL (obbligatorio: SQLite non funziona su serverless).

## Prerequisiti

- Repository su GitHub (es. `SebHolden/Capital-System`)
- Account [Vercel](https://vercel.com) collegato a GitHub
- Database PostgreSQL ([Neon](https://neon.tech), Vercel Postgres, Supabase, ecc.)

## 1. Database PostgreSQL

### Opzione A — Neon (consigliata)

1. Crea un progetto su [neon.tech](https://neon.tech)
2. Copia la connection string (formato `postgresql://...?sslmode=require`)
3. Conservala per il passo 3

### Opzione B — Vercel Postgres

1. Nel dashboard Vercel → **Storage** → **Create Database** → Postgres
2. Collega il database al progetto: Vercel imposta `DATABASE_URL` automaticamente

## 2. Importa il progetto su Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Seleziona il repo `Capital-System`
3. Framework: **Next.js** (rilevato automaticamente)
4. Non modificare Build Command: usa `vercel.json` → `npm run vercel-build`

## 3. Variabili d'ambiente (Production)

In **Project Settings → Environment Variables**, aggiungi:

| Variabile | Valore | Obbligatoria |
|-----------|--------|--------------|
| `DATABASE_URL` | `postgresql://...` da Neon/Vercel Postgres | Sì |
| `APP_PASSWORD` | Password forte per Basic auth | Sì |
| `APP_BASE_URL` | `https://tuo-progetto.vercel.app` (URL finale HTTPS) | Sì |
| `EXECUTION_MODE` | `mock` | Consigliato |
| `ENABLE_LIVE_TRADING` | `false` | Consigliato |
| `FINNHUB_API_KEY` | (opzionale) prezzi ETF/azioni | No |

`APP_BASE_URL` deve coincidere con il dominio deployato (aggiornalo se aggiungi un custom domain).

## 4. Primo deploy

1. Clic **Deploy**
2. Il build esegue automaticamente:
   - `prisma generate`
   - `prisma migrate deploy` (crea le tabelle)
   - `next build`
3. Dopo il deploy riuscito, **seed solo su DB vuoto** (una tantum):

   ```bash
   # Da locale, con DATABASE_URL del DB di produzione
   npm run db:seed
   ```

   Oppure usa `npx vercel env pull` e poi `npm run db:seed` in locale puntando al DB remoto.

4. Verifica: `GET https://tuo-progetto.vercel.app/api/health` → `"ok": true`, `"databaseReachable": true`

## 5. Accesso all'app

L'app è protetta da **HTTP Basic Auth** (`APP_PASSWORD`). Il browser chiederà username/password; l'username può essere qualsiasi stringa, la password è `APP_PASSWORD`.

## Sviluppo locale con PostgreSQL

Dopo la migrazione a PostgreSQL, anche in locale serve un `DATABASE_URL` postgres:

```bash
cp .env.example .env.local
# Imposta DATABASE_URL, APP_PASSWORD (opzionale in dev), ecc.

npm install
npx prisma migrate deploy
npm run db:seed   # solo DB vuoto
npm run dev
```

Per sviluppo senza Postgres cloud: Docker `postgres:16` su porta 5432, oppure un branch dev gratuito su Neon.

## Job schedulati (opzionale)

Su Vercel non girano cron di sistema. Opzioni:

- **Vercel Cron Jobs** — aggiungi route API protette e `crons` in `vercel.json`
- **GitHub Actions** — workflow schedulato che chiama `POST /api/autopilot/run-daily` con CSRF
- **Scheduler locale** — `npm run autopilot:daily` / `reports:daily` da Task Scheduler

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Build fallisce: `APP_PASSWORD is required` | Normale solo a **runtime** in production; se fallisce in build, verifica `instrumentation.ts` |
| `databaseReachable: false` | Controlla `DATABASE_URL`, SSL (`?sslmode=require` su Neon), IP allowlist del provider |
| 401 su tutte le pagine | Imposta `APP_PASSWORD`; in dev senza password l'auth è disabilitata |
| CSRF error su POST | `APP_BASE_URL` deve essere esattamente l'URL del sito (scheme + host) |
| Migrazioni falliscono | Esegui `npx prisma migrate deploy` in locale con lo stesso `DATABASE_URL` per vedere l'errore |

## Sicurezza staging

- `ENABLE_LIVE_TRADING=false`
- `EXECUTION_MODE=mock`
- Nessuna chiave broker live in env
- Password Vercel / Neon separate da quelle dell'app

## Riferimenti

- [docs/deployment-readiness.md](./deployment-readiness.md) — checklist generale
- [README](../README.md) — architettura e variabili
