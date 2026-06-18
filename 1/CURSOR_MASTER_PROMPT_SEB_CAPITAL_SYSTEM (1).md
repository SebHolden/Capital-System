# Prompt master per Cursor - Seb Capital System v2

Voglio trasformare questo progetto Next.js esistente in una web app privata completa chiamata Seb Capital System.

Contesto:
- È una dashboard personale per gestione capitale, rischio, journal, backtest e, in fase avanzata, ordini tramite broker API.
- Non deve promettere rendimenti.
- Deve proteggere capitale e impedire decisioni impulsive.
- Deve partire da capitale ipotetico 10.000 euro.
- Deve avere tre execution mode: mock, paper, live.
- Live trading deve essere disabilitato di default e protetto da più blocchi.

Obiettivo tecnico:
Costruisci una versione completa e stabile, ma procedendo per milestone. Prima database, portfolio, journal e risk gate. Poi prezzi. Poi execution mock/paper. Poi backtest. Solo alla fine predisposizione live trading protetta.

Stack richiesto:
- Next.js App Router
- TypeScript
- Prisma
- SQLite in locale
- Tailwind CSS
- Zod per validazione
- Recharts per grafici
- API keys solo lato server in .env.local

Regole di sicurezza:
1. Nessuna API key deve finire nel client.
2. Nessun ordine live deve partire se ENABLE_LIVE_TRADING non è true.
3. Anche se ENABLE_LIVE_TRADING è true, ogni ordine deve passare da risk gate, journal, kill switch, limite importo e conferma manuale.
4. Se il risk gate restituisce RED o BLACK, non eseguire ordini reali.
5. Se il journal è assente o incompleto, non eseguire ordini.
6. Se il kill switch è attivo, blocca tutto.
7. Logga ogni ordine, simulazione e decisione.
8. Nessuna leva.
9. Nessun prelievo o trasferimento fondi via API.

Architettura desiderata:
- app/dashboard
- app/portfolio
- app/orders
- app/journal
- app/backtests
- app/strategies
- app/settings
- app/api/prices
- app/api/execution
- app/api/portfolio
- app/api/journal
- app/api/backtests
- lib/risk
- lib/portfolio
- lib/prices
- lib/execution
- lib/brokers
- lib/backtesting
- lib/strategies
- lib/security
- prisma/schema.prisma

Primo obiettivo:
Implementa Milestone 1 e 2:
- Tailwind e layout navigazione
- Prisma + SQLite
- schema iniziale
- seed con scenario 10.000 euro
- sostituisci SAMPLE_POSITIONS statico con dati da database
- crea pagine dashboard, portfolio, orders, journal, settings
- mantiene esistenti risk engine e broker layer, ma rendili più puliti e testabili

Schema minimo Prisma:
- UserSettings
- Asset
- Position
- PriceSnapshot
- TradeJournal
- OrderIntent
- RiskDecision
- ExecutionLog
- AuditLog

UI minima:
Dashboard:
- patrimonio totale
- liquidità
- investito
- allocazione per bucket
- stress test
- rischio complessivo
- kill switch status

Portfolio:
- lista posizioni
- aggiungi posizione
- modifica posizione
- elimina posizione

Orders:
- simulatore ordine
- risk decision
- pulsante mock execution
- niente live execution attiva

Journal:
- crea journal decisionale
- lista journal

Settings:
- modifica regole rischio
- kill switch
- execution mode visibile

Output richiesto:
- codice funzionante
- npm run typecheck senza errori
- npm run lint senza errori o con lint configurato correttamente
- README aggiornato
- .env.example aggiornato

Lavora in piccoli step. Dopo ogni milestone, riepiloga cosa hai modificato e quali comandi devo lanciare.
