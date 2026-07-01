# Deployment Readiness

Guida per un deploy **privato in staging** di Seb Capital System. Non abilita trading live né esposizione pubblica.

## Scope

| Consentito ora | Non ancora |
|----------------|------------|
| Private staging | App pubblica |
| Password protected (`APP_PASSWORD`) | Signup pubblico |
| `EXECUTION_MODE=mock` | Trading live |
| `ENABLE_LIVE_TRADING=false` | Multi-utente |
| Paper signals e valutazione strategie | Esecuzione con capitale reale |

## Checklist pre-deploy

Esegui in locale (stesso ordine della CI):

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run architecture:check
```

Prima del primo deploy online:

```bash
npx prisma generate
npx prisma migrate deploy
```

## Variabili d'ambiente obbligatorie (production)

| Variabile | Valore staging | Note |
|-----------|----------------|------|
| `NODE_ENV` | `production` | Abilita validazione boot e auth |
| `APP_PASSWORD` | password forte | Obbligatoria; Basic auth su tutte le route tranne `/api/health` |
| `APP_BASE_URL` | `https://tuo-dominio.example` | Origin check CSRF su API mutanti |
| `EXECUTION_MODE` | `mock` | Default `mock` se assente |
| `ENABLE_LIVE_TRADING` | `false` | Non impostare `true` in staging |
| `DATABASE_URL` | presente | Vedi sezione database |
| `LIVE_TRADING_PASSPHRASE` | non impostata | Non usare in staging |
| Broker live keys | non impostate | Nessuna `ALPACA_API_KEY` live per staging |

Copia da [`.env.example`](../.env.example) e adatta al dominio deployato.

## Database

### Comandi

| Comando | Quando usarlo |
|---------|---------------|
| `npx prisma generate` | Ogni deploy |
| `npx prisma migrate deploy` | Production/staging — applica migrazioni |
| `npm run db:seed` | **Solo primo deploy** o DB vuoto di sviluppo |
| `npm run db:reset` | **Solo sviluppo** — cancella tutti i dati |

**Non eseguire** `db:seed` o `db:reset` su un database di staging/produzione che contiene dati reali.

### SQLite vs PostgreSQL

- **PostgreSQL** (obbligatorio su Vercel): `DATABASE_URL=postgresql://...` — Neon, Vercel Postgres, Supabase, ecc.
- **SQLite** non è più il provider Prisma di default; per deploy serverless usa sempre PostgreSQL.

Per deploy su Vercel vedi [deployment-vercel.md](./deployment-vercel.md).

## Backup e rollback

### Backup

- **SQLite:** copia periodica del file `.db` indicato in `DATABASE_URL`
- **PostgreSQL:** dump schedulato (`pg_dump`) o backup del provider cloud
- Tabelle critiche da preservare: `Position`, `TradeJournal`, `ExecutionLog`, `PaperSignal`, `DailySnapshot`

### Rollback

1. Ridistribuisci la build precedente (artifact o commit precedente)
2. Ripristina snapshot database se una migrazione ha causato problemi
3. Mantieni `ENABLE_LIVE_TRADING=false` e `EXECUTION_MODE=mock`
4. Verifica `GET /api/health` → `ok: true` e `databaseReachable: true`

## Sicurezza pre-deploy

- [ ] `APP_PASSWORD` impostata e non committata
- [ ] `APP_BASE_URL` corrisponde al dominio HTTPS deployato
- [ ] `ENABLE_LIVE_TRADING=false`
- [ ] Nessuna chiave broker live in env
- [ ] `LIVE_TRADING_PASSPHRASE` assente
- [ ] Log di produzione non contengono segreti (logger con redazione attivo)
- [ ] Health probe: `GET /api/health` (senza auth) per load balancer

## Health endpoint

```
GET /api/health
```

Risposta (nessun segreto):

```json
{
  "ok": true,
  "version": "0.1.0",
  "executionMode": "mock",
  "liveTradingEnabled": false,
  "databaseReachable": true,
  "timestamp": "2026-06-18T12:00:00.000Z"
}
```

- `ok` riflette `databaseReachable` (readiness)
- Non espone password, `DATABASE_URL`, chiavi broker o dati account

## Job schedulati (opzionale)

Dopo il deploy, configura scheduler OS per:

```bash
npm run paper-signals:run
npm run reports:daily
```

## Validazione all'avvio

In `NODE_ENV=production`, il server valida l'ambiente all'avvio (`instrumentation.ts`):

- Errori (es. `APP_PASSWORD` mancante) → processo termina con exit code 1
- Warning (es. SQLite in production) → log senza bloccare l'avvio
- Development: nessun crash per env mancante

## Riferimenti

- [README](../README.md) — setup e architettura
- [architecture-rules.md](./architecture-rules.md) — invarianti runtime
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — pipeline CI
