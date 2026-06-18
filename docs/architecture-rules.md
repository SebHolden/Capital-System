# Architecture Rules

Regole **obbligatorie** per Seb Capital System. Ogni nuova feature, integrazione o refactor deve rispettarle.

Violare una regola core richiede decisione esplicita documentata e review — non implementazione silenziosa.

---

## 1. Core invariants

### 1.1 Nessuna strategia chiama un broker

Le strategie in `lib/strategies/` sono **funzioni pure**. Generano segnali o parametri; non piazzano ordini.

```
Strategy → (signal only) → Backtest / PaperSignal / UI
```

**Mai:** `Strategy → Broker`

### 1.2 Nessun backtest crea un ordine reale

`lib/backtesting/engine.ts` simula trade su dati storici. Output: metriche, equity curve, `BacktestRun` — non `OrderIntent` eseguibili verso broker.

### 1.3 Nessun paper signal esegue live

`PaperSignal` e promotion (`Strategy.status = PROMOTED`) abilitano il **monitor paper**, non LIVE automatico.

Promotion ≠ permesso LIVE. LIVE richiede la checklist completa (sezione 3).

### 1.4 Pipeline ordine obbligatoria

Ogni ordine (MOCK, PAPER, LIVE) deve attraversare:

```
Journal → Risk Gate → Execution Mode Check → Broker Adapter → Audit Log
```

| Step | Modulo | Funzione chiave |
|------|--------|-----------------|
| Journal | `lib/security/` | `validateJournalForOrder()` |
| Risk Gate | `lib/risk/gate.ts` | `evaluateRiskGate()` |
| Execution Mode | `lib/execution/` | `executeOrder()` — MOCK/PAPER/LIVE |
| Broker Adapter | `lib/brokers/` | `getBroker(mode).placeOrder()` |
| Audit Log | `lib/security/` | `writeAuditLog()` |

**Mai** saltare un passaggio. **Mai** creare shortcut Signal → Broker.

### 1.5 Dati esterni tracciati

Ogni dato esterno (prezzo, storico, snapshot broker) deve avere:

- **source** — provider o origine (es. `finnhub`, `coingecko`, `manual`, `alpaca`)
- **timestamp** — quando è stato acquisito (`capturedAt`, `fetchedAt`)
- **staleness** — `fresh` | `stale` | `missing` | `manual`

Implementazione: `PriceSnapshot` in `prisma/schema.prisma`, check `stalePriceCheck` in `lib/risk/checks/`.

Un BUY con prezzo stale o mancante deve essere **bloccato** dal Risk Gate.

### 1.6 Python engine read-only (trading)

Qualsiasi motore Python futuro ([future-python-sidecar.md](./future-python-sidecar.md)):

- Non chiama broker.
- Non scrive `OrderIntent` / `ExecutionLog` direttamente.
- Importa solo risultati research/backtest via API layer TypeScript.

---

## 2. Execution modes

| Mode | Default | Broker | Capitale reale |
|------|---------|--------|----------------|
| MOCK | Sì (`EXECUTION_MODE=mock`) | MockBroker | No |
| PAPER | No | PaperBroker / Alpaca paper | No (conto paper) |
| LIVE | No | LiveBroker / Alpaca live | Sì — solo con checklist |

Default env: `EXECUTION_MODE=mock`, `ENABLE_LIVE_TRADING=false`.

---

## 3. LIVE execution checklist

LIVE è **disabilitato by default**. Tutte le condizioni devono essere vere simultaneamente:

| # | Requisito | Verifica |
|---|-----------|----------|
| 1 | `ENABLE_LIVE_TRADING=true` | Env server-only |
| 2 | `LIVE_TRADING_PASSPHRASE` configurata e valida | `verifyLivePassphrase()` |
| 3 | `confirmLive: true` nel body ordine | Schema Zod execution |
| 4 | Almeno una strategia `PROMOTED` | `hasPromotedStrategy()` |
| 5 | Kill switch **spento** | `checkKillSwitch()` |
| 6 | Limiti LIVE rispettati | `checkLiveOrderLimits()` — per-order, daily, monthly |
| 7 | Risk Gate approva (GREEN, non blocked) | `evaluateRiskGate()` |
| 8 | Journal completo e valido | `validateJournalForOrder()` |
| 9 | Audit log su ogni tentativo | `writeAuditLog()` — successo e rifiuto |
| 10 | Idempotency key valida | `assertIdempotencyKey()` |

Se un requisito fallisce dopo risk approval, l'ordine deve essere marcato **REJECTED** con `ExecutionLog` e audit — mai lasciato in `PENDING` orfano.

---

## 4. Flusso quant end-to-end

```
Research → Strategy → Backtest → PaperSignal → Risk Gate → Execution → Broker
                ↑                                    ↑
         (Python sidecar futuro)              (Journal obbligatorio)
              import only                    (unico path ordini)
```

Nessun path alternativo è permesso.

---

## 5. Anti-patterns

| Anti-pattern | Perché è vietato |
|--------------|------------------|
| Signal → Broker diretto | Bypassa journal, risk, audit, idempotency |
| Backtest che crea `OrderIntent` LIVE | Confonde simulazione con capitale reale |
| Paper signal → auto LIVE | Promotion non implica esecuzione reale |
| Sidecar Python con credenziali broker | Violazione read-only trading |
| Replay idempotency senza `ExecutionLog` | Risposta fuorviante su ordine incompleto |
| Deploy production senza `APP_PASSWORD` | App finanziaria pubblica non autenticata |
| API key broker nel client o in `.env` esposto | Leak credenziali |
| Strategia che importa SDK exchange | Accoppiamento strategy/venue vietato |

---

## 6. Decision log

### Perché TypeScript resta l'unico runtime di execution

1. **Audit trail unico** — ogni ordine passa da `lib/execution/` con `AuditLog` e `ExecutionLog` coerenti.
2. **Risk Gate unico** — un solo punto di enforcement (`lib/risk/gate.ts`); nessun bypass via Python o script.
3. **Semplicità operativa** — un processo Next.js + SQLite (futuro Postgres) vs orchestrazione multi-runtime per ordini.
4. **Sicurezza** — segreti LIVE e broker restano server-only in env TypeScript, non distribuiti al sidecar.

Python è ammesso **solo** come sidecar research read-only, con import controllato.

### Perché non Lean / Nautilus / Freqtrade in-process

- Stack diverso (C#, Rust, Python bot) — alto costo integrazione.
- Rischio di dual execution path.
- I **principi** Lean (layer separation) sono adottati; il **runtime** resta Seb Capital System TypeScript.

---

## 7. Riferimenti codice

| Concetto | Path |
|----------|------|
| Risk Gate | `lib/risk/gate.ts`, `lib/risk/checks/` |
| Execution | `lib/execution/index.ts`, `lib/execution/liveGate.ts` |
| Idempotency | `lib/execution/idempotency.ts` |
| Broker adapters | `lib/brokers/` |
| Strategies (pure) | `lib/strategies/` |
| Backtesting | `lib/backtesting/engine.ts` |
| Paper signals | `lib/paper-signals/` |
| Journal validation | `lib/security/index.ts` |
| Live limits | `lib/security/live.ts` |
| CSRF + Origin | `lib/security/csrf.ts`, `lib/security/origin.ts` |
| Auth middleware | `middleware.ts` |

---

## Documenti correlati

- [Reference Architecture](./reference-architecture.md)
- [Future Python Sidecar](./future-python-sidecar.md)
