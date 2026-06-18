# Seb Capital System

Dashboard personale per gestione capitale, rischio, journal decisionale e simulazione ordini.

**Disclaimer:** strumento personale — nessuna promessa di rendimento. Progettato per proteggere il capitale e impedire decisioni impulsive.

## Stack

- Next.js App Router + TypeScript
- Prisma + SQLite (locale)
- Tailwind CSS
- Zod (validazione API)
- Recharts (grafici)

## Setup

```bash
# 1. Installa dipendenze
npm install

# 2. Configura ambiente
cp .env.example .env.local

# 3. Database
npx prisma migrate dev
npm run db:seed

# 4. Avvia dev server
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) — redirect automatico a `/dashboard`.

## Comandi

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Build produzione |
| `npm run typecheck` | Controllo TypeScript |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Migrazioni Prisma |
| `npm run db:seed` | Seed scenario €10.000 |
| `npm run db:reset` | Reset DB + seed |
| `npm run paper-signals:run` | Pipeline segnali paper (scheduler) |
| `npm run reports:daily` | Snapshot report giornaliero + `PortfolioSnapshot` |
| `npm run test` | Vitest (risk, reports, live limits) |

## Architettura

```
app/
  dashboard/     # Panoramica patrimonio e rischio
  portfolio/     # CRUD posizioni
  orders/        # Simulatore + mock execution + impatto ordine
  journal/       # Journal decisionale
  settings/      # Regole rischio, kill switch
  backtests/     # Backtest strategie DCA/rebalance/MA
  strategies/    # Paper trading signals e monitor
  api/           # REST API server-only

lib/
  risk/          # Risk gate (GREEN→BLACK), baselines, drawdown, trading hours
  portfolio/     # Calcoli portafoglio
  execution/     # Pipeline ordini
  brokers/       # Mock / Paper / Live (Alpaca)
  journal/       # Scoring journal, completeness, quality summary
  security/      # Kill switch, audit, journal validation
  prices/        # CoinGecko, Finnhub, resolve, cache, history
  backtesting/   # Runner backtest, metriche, benchmark
  strategies/    # Definizioni strategie
  paper-signals/ # Generazione e monitor segnali paper

prisma/
  schema.prisma  # 15 modelli dati
  seed.ts        # Scenario iniziale €10.000
```

## Quant Architecture

Flusso end-to-end (nessun path diretto Signal → Broker):

```
Research → Strategy → Backtest → PaperSignal → Risk Gate → Execution → Broker
```

| Addendum | Path nel repo |
|----------|----------------|
| Research layer | `lib/research/`, `/research`, `GET /api/research/summary` |
| Storico prezzi DB | `HistoricalPrice`, `lib/prices/history.ts` (DB-first), import CSV |
| Strategie | `lib/strategies/`, `/strategies` |
| Backtest + OOS | `lib/backtesting/`, walk-forward in `walkForward.ts` |
| Paper signals | `lib/paper-signals/` (alias `lib/paper/`) |
| Segnali UI | `/signals` (sola lettura) |
| Risk gate | `lib/risk/gate.ts`, check modulari in `lib/risk/checks/` |
| Execution audit | `/execution`, `GET /api/execution/logs` |
| Execution | `lib/execution/` (MOCK / PAPER / LIVE) |

Check di sicurezza aggiuntivi nel gate:

- **Stale/missing price** — blocca BUY se il prezzo è stale o mancante
- **Rejected cooldown** — blocca ordini dopo un REJECTED recente (`rejectedOrderCooldownMinutes`)
- **Averaging down** — opzionale (`rejectAveragingDown`)

## Documentazione architettura

Documentazione di riferimento (solo testo, nessuna integrazione attiva):

| Documento | Contenuto |
|-----------|-----------|
| [docs/architecture-rules.md](docs/architecture-rules.md) | Regole obbligatorie: pipeline ordini, LIVE checklist, anti-pattern |
| [docs/reference-architecture.md](docs/reference-architecture.md) | Cosa imparare da Alpaca-py, Freqtrade, VectorBT, Backtrader, Zipline, NautilusTrader, Lean, Hummingbot |
| [docs/future-python-sidecar.md](docs/future-python-sidecar.md) | Design sidecar Python read-only per research (non implementato) |

## Allineamento spec (gap remediation)

- **allowedAmount** — enforced in esecuzione (ordine rifiutato se importo > massimo consentito)
- **FX EUR** — quote Finnhub USD convertite via `lib/prices/fx.ts`
- **CSRF** — token double-submit su route mutanti (execution, settings, portfolio, journal, backtests, paper-signals, prices refresh, broker sync)
- **Auth deploy** — `middleware.ts` con `APP_PASSWORD` (obbligatoria in production, opzionale in development)
- **EXECUTION_MODE env** — sincronizzato al DB al primo `getUserSettings()`; runtime da Settings UI
- **BrokerAccountSnapshot** — sync Alpaca paper/live via Settings o `POST /api/broker/sync`
- **Risk avanzato** — single-crypto cap, pump lookback, volatilità, revenge trading, concentrazione, leva
- **Portfolio** — import CSV broker, peso % posizioni, PnL realizzato + unrealized
- **Capitale sperimentale** — `experimentalCapital` / `experimentalCashBalance` separati dal main
- **Dashboard** — esposizione per categoria/asset, risk score 0–100, operazioni consentite/vietate
- **Strategie** — Momentum, Buy the dip, Volatility filter, Core satellite + gate OOS per paper
- **Broker** — interfaccia estesa (`getAccount`, `getPositions`, `cancelOrder`); stub Coinbase/Kraken/IB

## Scenario iniziale (seed)

- Capitale ipotetico: **€10.000** (cash €5.500 + investito €4.500)
- Liquidità: **€5.500**
- Investito: **€4.500** (SWDA, EIMI, SGLD, BTC)
- Riserva minima liquidità: **€1.000**
- Max allocazione crypto: **15%**
- 1 journal completo
- Execution mode: **MOCK**

## Regole di sicurezza

1. Nessuna API key nel client — solo in `.env.local` lato server
2. `ENABLE_LIVE_TRADING=false` di default — nessun ordine live
3. **Deploy production:** imposta `APP_PASSWORD` (obbligatoria) e `APP_BASE_URL` (Origin check CSRF)
4. Ogni ordine passa da: risk gate → journal → kill switch → limiti importo
4. Risk `RED` o `BLACK` → ordine bloccato (`BLACK` solo con kill switch)
5. Journal assente/incompleto → ordine bloccato
6. Kill switch attivo → tutto bloccato
7. Ogni decisione loggata in `AuditLog`
8. Nessuna leva
9. Nessun prelievo/trasferimento fondi via API

## Variabili ambiente

Vedi [`.env.example`](.env.example):

```env
DATABASE_URL="file:./dev.db"
EXECUTION_MODE=mock   # sync opzionale al DB al boot
ENABLE_LIVE_TRADING=false
# APP_BASE_URL=http://localhost:3000
# APP_PASSWORD=       # Obbligatoria in production (NODE_ENV=production)
FX_PROVIDER=exchangerate.host
EUR_USD_RATE=         # fallback offline USD->EUR
```

## Price engine (Milestone 3)

- **Crypto**: CoinGecko (EUR), sempre attivo senza API key
- **ETF/Azioni**: Finnhub se `FINNHUB_API_KEY` è impostata, altrimenti fallback su prezzo medio (`manual`)
- Ogni refresh salva `PriceSnapshot` con status `fresh` / `stale` / `missing` / `manual`
- Cache in-memory configurabile (`PRICE_CACHE_SECONDS`, default 60s)
- Prezzi stale dopo `PRICE_STALE_MINUTES` (default 15 min)

**Valuta:** il portfolio locale è espresso in **EUR**. Crypto da CoinGecko in EUR; quote Finnhub USD convertite via `lib/prices/fx.ts`. Snapshot Alpaca broker in USD (conto separato dal patrimonio ipotetico).

**Limiti Finnhub:** copertura principalmente US. ETF UCITS europei (es. SWDA su Xetra) potrebbero non essere disponibili — in quel caso resta il prezzo medio manuale.

### API prezzi

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/prices` | GET | Prezzi risolti per asset in portfolio |
| `/api/prices/refresh` | POST | Aggiorna prezzi (tutti o `?assetId=`) |
| `/api/prices/crypto` | GET | `?symbols=BTC,ETH` |
| `/api/prices/equity` | GET | `?symbols=AAPL` |

Test refresh:

```bash
curl -X POST http://localhost:3000/api/prices/refresh
```

## Risk engine (Milestone 4)

Controlli aggiuntivi nel risk gate:

- **Perdita giornaliera/mensile**: baseline automatica a inizio giorno/mese (timezone configurabile); blocca **BUY** se supera `maxDailyLossPct` / `maxMonthlyLossPct`
- **Drawdown**: high-water mark su `peakPortfolioValue`; blocca **BUY** oltre `maxDrawdownPct`
- **Bucket experimental**: limite su allocazione `SPECULATIVE` (`maxExperimentalPct`)
- **Finestra oraria**: blocca tutti gli ordini fuori da `tradingStartHour`–`tradingEndHour` se abilitata
- **SELL** sempre valutato per de-risking anche con limiti perdita/drawdown attivi

Dashboard mostra PnL giorno/mese, budget perdita residuo, drawdown e stato finestra trading.

Simulatore ordini mostra allocazione bucket prima/dopo e stress test sul patrimonio post-ordine.

## Journal decisionale (Milestone 5)

Campi obbligatori per ogni journal:

- Titolo/motivo, tesi, rischi, invalidazione, stato emotivo (testo)
- Orizzonte temporale, perdita massima accettabile (€), regola di uscita
- Emotion score (1–10), confidence score (1–10), flag trade pianificato

**Scoring anti-impulso:**

| Condizione | Effetto ordine |
|------------|----------------|
| Journal incompleto o emotion ≥ 8 | RED — bloccato |
| Emotion 6–7, confidence ≤ 3, non pianificato | YELLOW — risk gate declassato (min ORANGE) |
| Testi troppo brevi | penalità score + warning |

Dashboard: sezione qualità decisionale con metriche ultimi 30 giorni.

## Stato M1-M10

- Database Prisma con persistenza reale
- Risk gate con riserva liquidità, limite crypto, `allowedAmount`, baselines M4
- Simulatore ordini con impatto before/after e stress test
- Esecuzione MOCK/PAPER/LIVE unificata con audit log, idempotency e rate limit
- Journal M5 con scoring emozione/fiducia e dashboard qualità
- Backtest engine M7 con strategie DCA, rebalance, MA cross
- Paper signals M8 con monitor 7/30gg, MAE/MFE e promozione strategie
- Live trading protetto M9 con passphrase, limiti dedicati e checklist broker
- Reports M10 con snapshot giornalieri, review settimanale e report mensile esportabile

**Checklist verifica M5:**

- Journal completo richiesto per esecuzione (`journalId` obbligatorio)
- Emotion score ≥ 8 blocca l'ordine (RED)
- Dropdown ordini mostra solo journal eleggibili (scoring runtime)
- Avvisi journal visibili separatamente nel pannello risk decision
- Seed riallinea `isComplete` e `qualityScore` via `rescoreAllJournals`

## Milestone 6 — Execution mock/paper

Pipeline unificata `POST /api/execution` con:

- **MOCK** — fill immediato locale con `brokerOrderId` mock
- **PAPER** — Alpaca paper opzionale (simboli USA); fallback slippage simulato per asset EU (es. SWDA, EIMI nel seed)
- **Idempotency key** — stessa chiave entro 24h → risposta cached, nessun doppio ordine
- **Rate limit** — default 10 esecuzioni/min (`EXECUTION_RATE_LIMIT_PER_MIN`)
- **Double confirmation** — checkbox `confirmRisk` obbligatoria in UI prima dell'esecuzione
- **LIVE** — Alpaca live protetto (M9): passphrase, limiti dedicati, strategia PROMOTED, checklist broker

Route legacy `/api/execution/mock` resta come wrapper deprecato. `/api/execution/simulate` invariata (solo risk, no esecuzione).

**Variabili env (server-only):**

```env
EXECUTION_RATE_LIMIT_PER_MIN=10
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets
```

## Milestone 7 — Backtesting

Motore backtest su `/backtests` con API `GET/POST /api/backtests`:

- **Strategie:** DCA mensile, ribilanciamento mensile, moving average cross (20/50)
- **Serie storiche:** CoinGecko per crypto (BTC), Finnhub per equity USA, fallback sintetico per ETF EU (SWDA, EIMI)
- **Metriche:** rendimento, CAGR, volatilità, max drawdown, Sharpe, Sortino, win rate, holding medio, worst/best month, recovery
- **Benchmark:** buy-and-hold sullo stesso asset
- **Persistenza:** `Strategy`, `BacktestRun`, `BacktestTrade`

Le strategie in M7 sono **non esecutive** — nessun collegamento a ordini reali o broker.

**Variabili env (server-only):**

```env
BACKTEST_DEFAULT_COMMISSION_BPS=10
BACKTEST_DEFAULT_SLIPPAGE_BPS=10
BACKTEST_MAX_YEARS=5
```

## Milestone 8 — Paper trading signals

Monitor segnali su `/strategies` senza esecuzione ordini:

- **Attivazione paper** — solo dopo backtest idoneo (soglie env)
- **Generazione segnali** — da strategie `PAPER_ACTIVE` via engine M7
- **Monitor** — current / 7d / 30d, MAE, MFE, rule followed
- **Promozione** — `PROMOTED` se track paper stabile (prerequisito M9, non abilita live)

**Scheduler locale:**

```bash
npm run paper-signals:run
```

Documenta Task Scheduler (Windows) o cron per esecuzione giornaliera.

**Variabili env (server-only):**

```env
PAPER_MIN_BACKTEST_RETURN_PCT=0
PAPER_MAX_BACKTEST_DRAWDOWN_PCT=25
PAPER_PROMOTION_MIN_SIGNALS=3
PAPER_PROMOTION_MIN_AVG_30D_PCT=0
PAPER_MAX_MAE_PCT=15
```

## Milestone 9 — Live trading protetto

Esecuzione LIVE su Alpaca con doppio gate env e conferme UI:

- **ENABLE_LIVE_TRADING=true** — flag server obbligatorio
- **LIVE_TRADING_PASSPHRASE** — verificata server-side (timing-safe) per ogni ordine; mai loggata in audit
- **Strategia PROMOTED** — almeno una strategia promossa da paper (M8) prima di qualsiasi LIVE
- **Limiti dedicati** — `maxLiveOrderAmount`, `maxDailyLiveAmount` e `maxMonthlyLiveAmount` in Settings (separati da mock/paper)
- **Checklist broker** — `GET /api/live/checklist` + pannello in Ordini e Settings
- **Conferma UI** — `confirmRisk` + `confirmLive` + passphrase nel modal LIVE
- **Kill switch** — blocca LIVE come qualsiasi esecuzione
- **Solo simboli USA Alpaca** — ETF EU seed (SWDA, EIMI) non eseguibili in LIVE

**API:**

- `POST /api/execution` con `mode: "LIVE"`, `confirmLive: true`, `livePassphrase`
- Errori tipizzati: 401 passphrase, 403 prerequisiti/env, 429 limiti LIVE

**Variabili env (server-only):**

```env
ENABLE_LIVE_TRADING=false
LIVE_TRADING_PASSPHRASE=
ALPACA_LIVE_BASE_URL=https://api.alpaca.markets
LIVE_DEFAULT_MAX_ORDER_AMOUNT=500
LIVE_DEFAULT_MAX_DAILY_AMOUNT=2000
LIVE_DEFAULT_MAX_MONTHLY_AMOUNT=10000
```

**Avvertenze:** la passphrase non va mai nel client bundle (solo invio per-request). LIVE usa denaro reale — testare prima in MOCK/PAPER.

## Milestone 10 — Reports

Report su `/reports` con export CSV/JSON:

- **Giornaliero** — patrimonio, PnL, risk, operazioni del giorno, warning prezzi; upsert `PortfolioSnapshot`
- **Settimanale** — performance da snapshot, journal review, errori decisionali, esposizione
- **Mensile** — PnL/drawdown, decision quality score, benchmark vs `REPORTS_BENCHMARK_SYMBOL` (default BTC), strategie best/worst, trade impulsivi; persistenza `MonthlyReport`

**API:**

- `GET /api/reports/daily?date=YYYY-MM-DD&format=json|csv`
- `GET /api/reports/weekly?start=YYYY-MM-DD&format=json|csv`
- `GET /api/reports/monthly?month=YYYY-MM&format=json|csv`

**Variabili env (opzionale):**

```env
REPORTS_BENCHMARK_SYMBOL=BTC
```

**Scheduler snapshot giornaliero:**

```bash
npm run reports:daily
```

Windows Task Scheduler: azione `npm run reports:daily` nella cartella progetto, trigger giornaliero (es. 23:00). Linux/macOS: `cron` con `0 23 * * * cd /path/to/project && npm run reports:daily`.

## PostgreSQL (migrazione opzionale)

SQLite è sufficiente per uso personale locale. Considera PostgreSQL quando:

- serve backup/restore centralizzato o hosting remoto
- crescono snapshot storici e report (volume dati)
- più utenti o agenti accedono allo stesso DB

**Passi:**

1. Crea database PostgreSQL e imposta `DATABASE_URL` in `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/seb_capital?schema=public"
   ```
2. In [`prisma/schema.prisma`](prisma/schema.prisma) cambia `provider = "postgresql"` nel datasource (solo se migri definitivamente).
3. Applica schema: `npx prisma migrate deploy`
4. Seed: `npm run db:seed`

**SQLite → PostgreSQL:** per MVP conviene `npm run db:reset` sul nuovo DB e re-import portfolio; per dati produzione esportare tabelle critiche (`Position`, `TradeJournal`, `ExecutionLog`) via script custom.

## Definition of Success (checklist manuale)

| # | Criterio | Verifica |
|---|----------|----------|
| 1 | Non superare limiti | Ordine oltre `maxOrderAmount` / LIVE limits → bloccato |
| 2 | Decisioni tracciate | `AuditLog`, `RiskDecision`, report M10 |
| 3 | Capitale sperimentale | Budget dedicato `experimentalCapital` + liquidità `experimentalCashBalance` + bucket `SPECULATIVE` |
| 4 | Live dopo mock/paper | LIVE richiede PROMOTED + checklist M9 |
| 5 | Misurare nel tempo | `/reports` decision quality + snapshot |
| 6 | Ridurre impulsività | Emotion ≥ 8 blocca; journal obbligatorio |
| 7 | Coerenza strategia | Paper → promozione → gate LIVE |

## Roadmap

| Milestone | Stato | Contenuto |
|-----------|-------|-----------|
| M1-M2 | Completata | DB, portfolio, journal, risk gate, UI, mock execution |
| M3 | Completata | Price engine CoinGecko + Finnhub opzionale, snapshot, UI stale |
| M4 | Completata | Perdita giorno/mese, drawdown, orari, experimental, simulatore avanzato |
| M5 | Completata | Journal completo, scoring emozione/fiducia, dashboard qualità |
| M6 | Completata | Pipeline esecuzione MOCK/PAPER, idempotency, rate limit, Alpaca opzionale |
| M7 | Completata | Backtest DCA/rebalance/MA, metriche, benchmark, UI |
| M8 | Completata | Paper signals, monitor 7/30gg, promozione strategie |
| M9 | Completata | Live trading protetto: passphrase, limiti, Alpaca live, checklist, UI |
| M10 | Completata | Report daily/weekly/monthly, decision quality, benchmark, export CSV/JSON |
