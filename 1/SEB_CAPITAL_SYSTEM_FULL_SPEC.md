# Seb Capital System - Specifica completa v2

## 1. Visione

Seb Capital System è una web app privata per gestire capitale, investimenti, rischio, backtest, journal decisionale e, solo in fasi avanzate, ordini automatici tramite broker API.

Obiettivo principale: costruire un sistema personale che protegge il capitale, riduce errori impulsivi, misura le decisioni e permette di testare strategie prima di usare soldi veri.

Non è un sistema che promette rendimento garantito. È un sistema operativo personale per investire con metodo.

## 2. Principi non negoziabili

1. Prima protezione del capitale, poi rendimento.
2. Nessun ordine live nella v1.
3. Ogni ordine deve passare da risk gate.
4. Ogni ordine deve avere journal obbligatorio.
5. Ogni strategia deve passare da backtest e paper trading.
6. Nessuna leva nella fase iniziale.
7. Nessun all-in.
8. Separazione netta tra capitale principale e capitale sperimentale.
9. API key mai esposte al browser.
10. Live trading possibile solo con doppio consenso esplicito.

## 3. Modalità operative

### 3.1 Mock mode

Default. Non invia ordini reali. Simula ordini, salvataggi, PnL e stato portafoglio.

Variabili:

```env
EXECUTION_MODE=mock
ENABLE_LIVE_TRADING=false
```

### 3.2 Paper mode

Invia ordini a broker paper trading. Serve per testare integrazione e logica senza soldi veri.

Variabili:

```env
EXECUTION_MODE=paper
ENABLE_LIVE_TRADING=false
```

### 3.3 Live mode

Invia ordini reali. Deve essere bloccato da più controlli.

Variabili richieste:

```env
EXECUTION_MODE=live
ENABLE_LIVE_TRADING=true
LIVE_TRADING_PASSPHRASE=frase_privata_definita_dall_utente
```

Live mode deve richiedere:

- passphrase manuale
- conferma esplicita nella UI
- journal completo
- risk gate verde o massimo giallo con riduzione importo
- kill switch non attivo
- importo entro limiti giornalieri/mensili

## 4. Stack tecnico consigliato

### 4.1 Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui opzionale
- Recharts per grafici
- React Hook Form + Zod per form

### 4.2 Backend

- Route Handlers Next.js
- Server Actions solo per funzioni non sensibili
- Prisma ORM
- SQLite in locale per MVP
- PostgreSQL quando il progetto diventa stabile

### 4.3 Dati esterni

- Crypto prices: CoinGecko o Coinbase public market data
- Stock/ETF prices: Finnhub, Alpaca market data o Interactive Brokers in futuro
- FX EUR/USD: exchangerate.host, ECB data o provider scelto

### 4.4 Broker execution

- Fase 1: MockBroker
- Fase 2: Alpaca Paper per stocks/ETF USA
- Fase 3: Interactive Brokers per strumenti più completi, solo se necessario
- Fase 4: Coinbase Advanced o Kraken per crypto, solo dopo sicurezza API

## 5. Architettura logica

```text
seb-capital-system/
  app/
    dashboard/
    portfolio/
    orders/
    journal/
    backtests/
    strategies/
    settings/
    api/
      prices/
      execution/
      portfolio/
      journal/
      backtests/
  components/
    dashboard/
    portfolio/
    risk/
    orders/
    journal/
    charts/
  lib/
    brokers/
    prices/
    risk/
    portfolio/
    execution/
    backtesting/
    strategies/
    journal/
    security/
    db/
  prisma/
    schema.prisma
```

## 6. Moduli della versione completa

## 6.1 Dashboard principale

Schermata iniziale con:

- patrimonio totale
- liquidità
- investito totale
- PnL giornaliero
- PnL totale
- esposizione per categoria
- esposizione per singolo asset
- rischio complessivo
- drawdown corrente
- stress test
- operazioni consentite oggi
- operazioni vietate oggi
- stato kill switch

Metriche:

```text
Net worth
Cash ratio
Invested ratio
Crypto allocation
ETF allocation
Stock allocation
Experimental allocation
Max drawdown
Current drawdown
Monthly PnL
Monthly loss budget remaining
Risk score 0-100
```

## 6.2 Portfolio manager

Funzioni:

- inserire posizioni manualmente
- modificare quantità e prezzo medio
- importare CSV broker
- vedere valore aggiornato
- vedere peso percentuale
- vedere PnL realizzato e non realizzato
- dividere asset per bucket

Bucket consigliati:

```text
Cash
Core ETF
Stocks
Crypto core
Crypto experimental
Strategy lab
```

## 6.3 Price engine

Responsabilità:

- recuperare prezzi da API esterne
- normalizzare simboli
- gestire cambio valuta
- salvare storico prezzi
- cache per evitare rate limit
- fallback su ultimo prezzo valido

Regola:

Se una API fallisce, il sistema non deve crashare. Deve segnare il prezzo come stale.

Stato prezzo:

```text
fresh
stale
missing
manual
```

## 6.4 Risk engine

È il cuore del sistema.

Controlli principali:

- liquidità minima
- crypto max allocation
- experimental max allocation
- singolo asset max allocation
- singola crypto max allocation
- perdita massima giornaliera
- perdita massima mensile
- concentrazione eccessiva
- correlazione eccessiva
- volatilità eccessiva
- drawdown oltre soglia
- trading fuori orario personale
- journal assente o troppo breve
- asset troppo salito negli ultimi giorni
- tentativo di recuperare perdita
- leva non consentita

Verdetti:

```text
GREEN: consentito
YELLOW: consentito con cautela o importo ridotto
RED: sconsigliato, non eseguibile in automatico
BLACK: bloccato in modo assoluto
```

## 6.5 Order simulator

Prima di ogni ordine mostra:

- situazione prima
- situazione dopo
- nuova allocazione
- nuova liquidità
- impatto sul rischio
- perdita potenziale in stress test
- verdetto risk gate
- importo massimo consentito

Input:

```text
symbol
side
asset kind
amount EUR
order type
limit price optional
journal
acknowledge risk
```

Output:

```text
risk decision
allowed amount
position impact
cash impact
allocation impact
execution eligibility
```

## 6.6 Execution engine

Responsabilità:

- ricevere ordini dalla UI
- validare ordine con Zod
- chiamare risk engine
- applicare kill switch
- scegliere broker adapter
- inviare ordine solo se permesso
- salvare execution log
- gestire errori broker
- impedire retry pericolosi

Regola fondamentale:

Il broker adapter non può essere chiamato direttamente dalla UI. Solo il backend può inviare ordini.

## 6.7 Broker adapters

Interfaccia comune:

```ts
interface BrokerAdapter {
  name: string;
  mode: ExecutionMode;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  placeOrder(order: ValidatedOrder): Promise<BrokerOrderResult>;
  cancelOrder(orderId: string): Promise<BrokerCancelResult>;
}
```

Adapter:

```text
MockBroker
AlpacaBroker
InteractiveBrokersBroker
CoinbaseBroker
KrakenBroker
```

Priorità sviluppo:

1. MockBroker completo
2. AlpacaBroker paper
3. AlpacaBroker live con limiti durissimi
4. Coinbase/Kraken solo dopo journal, audit log e kill switch
5. Interactive Brokers solo se serve davvero

## 6.8 Journal decisionale

Obbligatorio prima di ogni operazione.

Campi:

```text
reason
thesis
time horizon
max acceptable loss
exit rule
emotion score 1-10
confidence 1-10
is this planned?
what would invalidate this trade?
```

Sistema anti-impulso:

Se emotion score alto o journal troppo breve, il trade diventa giallo o rosso.

## 6.9 Strategy engine

Permette di definire strategie non esecutive all'inizio.

Tipi:

```text
DCA monthly
Rebalance monthly
Momentum
Moving average cross
Buy the dip
Volatility filter
Core satellite allocation
```

Ogni strategia deve avere:

```text
name
description
assets
entry rules
exit rules
rebalance frequency
risk limits
benchmark
```

## 6.10 Backtesting engine

Responsabilità:

- prendere serie storiche
- simulare strategia
- applicare commissioni
- applicare slippage stimato
- calcolare metriche
- confrontare con benchmark

Metriche:

```text
total return
CAGR
volatility
max drawdown
Sharpe ratio
Sortino ratio
win rate
number of trades
average holding period
worst month
best month
time to recover
```

Regola:

Nessuna strategia può andare in paper trading se non supera backtest minimo e test fuori campione.

## 6.11 Paper trading monitor

Mostra segnali generati e risultato simulato.

Metriche:

```text
signal date
signal type
planned entry
current result
7d result
30d result
max adverse excursion
max favorable excursion
rule followed yes/no
```

## 6.12 Reports

Report giornaliero:

- valore portafoglio
- PnL giorno
- rischio attuale
- operazioni consentite
- warning

Report settimanale:

- performance
- errori decisionali
- journal review
- esposizione
- rispetto regole

Report mensile:

- performance vs benchmark
- drawdown
- operazioni impulsive
- strategie migliori/peggiori
- decision quality score

## 6.13 Settings

Pannello per modificare:

- capitale iniziale
- riserva minima
- limiti crypto
- limiti singolo asset
- limiti perdita
- broker abilitato
- execution mode
- kill switch
- passphrase live
- orari trading bloccati

## 6.14 Security layer

Misure:

- API key solo in `.env.local`
- nessuna API key nel client
- CSRF protection per azioni sensibili
- rate limit route execution
- audit log immutabile
- kill switch globale
- live trading disabilitato di default
- conferma manuale per ogni ordine live
- importo massimo per ordine live
- limite massimo giornaliero
- limite massimo mensile
- nessun prelievo via API
- chiavi broker con permessi minimi

## 7. Database schema concettuale

Entità:

```text
UserSettings
Asset
Position
PriceSnapshot
TradeJournal
OrderIntent
RiskDecision
ExecutionLog
BrokerAccountSnapshot
Strategy
BacktestRun
BacktestTrade
PaperSignal
MonthlyReport
AuditLog
```

## 8. Prisma schema iniziale

```prisma
model UserSettings {
  id                       String   @id @default(cuid())
  baseCurrency             String   @default("EUR")
  minCashReserveEur        Float    @default(5000)
  maxCryptoAllocation      Float    @default(0.10)
  maxExperimentalAllocation Float   @default(0.05)
  maxSingleAssetAllocation Float    @default(0.15)
  maxSingleCryptoAllocation Float   @default(0.05)
  maxDailyLoss             Float    @default(0.02)
  maxMonthlyLoss           Float    @default(0.05)
  leverageAllowed          Boolean  @default(false)
  killSwitchEnabled        Boolean  @default(false)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}

model Asset {
  id        String   @id @default(cuid())
  symbol    String
  name      String
  kind      String
  currency  String
  provider  String?
  providerSymbol String?
  createdAt DateTime @default(now())
  positions Position[]
  prices    PriceSnapshot[]
}

model Position {
  id           String   @id @default(cuid())
  assetId      String
  asset        Asset    @relation(fields: [assetId], references: [id])
  quantity     Float
  averagePrice Float?
  bucket       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PriceSnapshot {
  id        String   @id @default(cuid())
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id])
  price     Float
  currency  String
  source    String
  status    String
  capturedAt DateTime @default(now())
}

model TradeJournal {
  id                   String   @id @default(cuid())
  symbol               String
  side                 String
  amountEur            Float
  reason               String
  thesis               String
  timeHorizon          String
  maxAcceptableLossEur Float
  exitRule             String
  emotionScore         Int
  confidenceScore      Int
  planned              Boolean
  invalidation         String
  createdAt            DateTime @default(now())
}

model OrderIntent {
  id             String   @id @default(cuid())
  symbol         String
  side           String
  amountEur      Float
  orderType      String
  status         String
  journalId      String?
  riskDecisionId String?
  createdAt      DateTime @default(now())
}

model RiskDecision {
  id               String   @id @default(cuid())
  verdict          String
  title            String
  allowedAmountEur Float
  reasonsJson      String
  warningsJson     String
  createdAt        DateTime @default(now())
}

model ExecutionLog {
  id              String   @id @default(cuid())
  broker          String
  mode            String
  symbol          String
  side            String
  amountEur       Float
  accepted        Boolean
  externalOrderId String?
  message         String
  rawJson         String?
  createdAt       DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  severity  String
  payloadJson String?
  createdAt DateTime @default(now())
}
```

## 9. Roadmap di implementazione Cursor

## Milestone 1 - Stabilizzare la base

Obiettivo: progetto pulito, typecheck, lint, routing.

Task:

- sistemare struttura app
- aggiungere Tailwind
- aggiungere componenti UI base
- spostare dashboard in `/dashboard`
- creare layout navigazione
- creare pagine portfolio, orders, journal, settings

## Milestone 2 - Database

Obiettivo: persistenza reale.

Task:

- installare Prisma
- usare SQLite locale
- creare schema iniziale
- seed scenario 10.000 euro
- sostituire SAMPLE_POSITIONS con query DB
- creare repository layer

## Milestone 3 - Portfolio e prezzi

Obiettivo: portafoglio reale con prezzi aggiornabili.

Task:

- creare asset manager
- creare positions CRUD
- creare price provider interface
- implementare CoinGecko provider
- implementare Finnhub o Alpaca market data provider
- salvare PriceSnapshot
- mostrare stale price warning

## Milestone 4 - Risk engine completo

Obiettivo: semaforo robusto.

Task:

- aggiungere controlli di perdita giornaliera/mensile
- aggiungere cash reserve
- aggiungere concentrazione
- aggiungere journal validation
- aggiungere trading time block
- aggiungere kill switch
- aggiungere allowed amount calculation
- salvare RiskDecision su DB

## Milestone 5 - Journal obbligatorio

Obiettivo: impedire trading impulsivo.

Task:

- form journal completo
- scoring emozione/fiducia
- collegare journal a OrderIntent
- bloccare ordine se journal incompleto
- dashboard qualità decisionale

## Milestone 6 - Execution mock/paper

Obiettivo: esecuzione sicura.

Task:

- completare MockBroker
- completare AlpacaBroker paper
- creare execution route unica
- loggare tutto su ExecutionLog
- aggiungere idempotency key
- aggiungere rate limit
- aggiungere double confirmation

## Milestone 7 - Backtesting

Obiettivo: test strategie.

Task:

- strategy model
- backtest runner
- DCA strategy
- rebalance strategy
- moving average strategy
- metriche performance
- benchmark comparison
- salvataggio BacktestRun

## Milestone 8 - Paper trading signals

Obiettivo: segnali senza soldi veri.

Task:

- scheduler manuale o cron locale
- generazione segnali
- salvataggio PaperSignal
- monitor risultati a 7/30 giorni
- promozione strategia solo se stabile

## Milestone 9 - Live trading protetto

Obiettivo: live solo con limiti stretti.

Task:

- live passphrase
- max live order amount
- max daily live amount
- max monthly live loss
- kill switch UI
- confirm modal
- audit log
- broker permissions checklist

## Milestone 10 - Reports

Obiettivo: miglioramento continuo.

Task:

- daily report
- weekly review
- monthly report
- decision quality score
- performance vs benchmark
- export CSV/JSON

## 10. Definition of success

Il sistema ha successo se:

```text
1. Non permette operazioni oltre i limiti.
2. Tutte le decisioni sono tracciate.
3. Il capitale sperimentale resta separato dal capitale principale.
4. Ogni trade live è preceduto da mock/paper/backtest.
5. Dopo 3 mesi sai quali decisioni funzionano e quali no.
6. Le operazioni impulsive diminuiscono.
7. Il portafoglio resta coerente con la tua strategia.
```

