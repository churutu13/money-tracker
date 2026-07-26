# Denaro

Web app personale, mobile-first e installabile come PWA per separare con chiarezza:

- saldi dei conti;
- spese già sostenute e impegni futuri;
- fondi fiscali;
- risparmi e investimenti;
- crediti non ancora incassati;
- debito delle carte;
- soldi realmente liberi.

EUR e CHF sono sempre calcolati e mostrati separatamente. Tutti gli importi sono salvati come interi in centesimi.

## Funzionalità MVP

- Supabase Auth con registrazione, conferma email, login e logout.
- Dashboard mensile con liquidità, impegni, tasse, risparmi, investimenti, soldi liberi, previsione di fine mese, pagamenti imminenti e progressione delle spese fisse.
- Conti e contanti con saldo iniziale, inclusione nella liquidità e riconciliazione tramite rettifica neutra.
- Movimenti CRUD: entrate, uscite, trasferimenti, rimborsi, accantonamenti, investimenti, disinvestimenti e pagamento carta.
- Budget mensile CRUD, duplicazione idempotente e flusso atomico “segna come pagato”.
- Spese ricorrenti con generazione idempotente delle occorrenze mensili.
- Fondi fiscali separati per EUR e CHF.
- Crediti e rimborsi ricevuti, collegati al conto senza classificarli come stipendio.
- Patrimonio e bucket: gli importi classificano saldi esistenti e non vengono aggiunti una seconda volta.
- Gestione Amex: la spesa aumenta subito il debito carta; il pagamento dell’estratto riduce il conto e il debito senza creare una seconda uscita.
- Avvio completamente vuoto: conti e dati vengono inseriti dall’utente.
- Modalità locale persistente quando le variabili Supabase non sono presenti.
- PWA con manifest, icona, dark mode e navigazione mobile/desktop.

## Stack

- Next.js 16 con App Router
- React 19 e TypeScript strict
- Tailwind CSS e componenti in stile shadcn/ui basati su Radix UI
- Supabase Auth, Postgres e Row Level Security
- React Hook Form + Zod
- Recharts
- date-fns

## Avvio locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apri `http://localhost:3000`.

Senza `.env.local` l’app parte in modalità locale e conserva le modifiche esclusivamente nel `localStorage` del dispositivo. Con le variabili Supabase configurate, autenticazione e dati usano Supabase.

Versione GitHub Pages:

<https://churutu13.github.io/money-tracker/>

Comandi di qualità:

```bash
npm run lint
npm run typecheck
npm run build
npm audit
```

## Configurazione Supabase

1. Crea un progetto su Supabase.
2. Apri **SQL Editor** ed esegui, nell’ordine:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/seed.sql`
3. In **Authentication → URL Configuration** imposta:
   - Site URL locale: `http://localhost:3000`
   - Redirect URL locale: `http://localhost:3000/auth/callback`
   - aggiungi gli equivalenti URL di produzione al deploy.
4. Copia Project URL e chiave anon/publishable in `.env.local`.
5. Registrati nell’app.
6. Registrati e inserisci i dati dall’app: il seed non contiene dati finanziari.

Non inserire mai la `service_role` nel progetto frontend.

## Variabili ambiente

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Sono intenzionalmente le sole variabili pubbliche. Le autorizzazioni non dipendono dalla segretezza della chiave anonima, ma dalle policy RLS legate a `auth.uid()`.

## Architettura

```text
App Router pages
      │
      ▼
FinanceProvider ── modalità locale → localStorage
      │
      └────────── modalità reale → Supabase client + Auth
                                      │
                                      ▼
                              RPC atomiche Postgres
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
                   saldi          movimenti       entità collegate
                                      │
                                      ▼
                              RLS per auth.uid()
```

Le pagine leggono uno stato finanziario condiviso. In modalità reale le operazioni che toccano più entità sono funzioni Postgres atomiche:

- `record_transaction`
- `update_transaction`
- `delete_transaction`
- `mark_budget_item_paid`
- `record_receivable_payment`
- `reconcile_account`
- `duplicate_budget_month`
- `ensure_recurring_budget`
- `create_savings_bucket`

Se una parte fallisce, Postgres annulla l’intera operazione e non lascia saldi incoerenti.

## Schema dati

| Area | Tabelle principali |
| --- | --- |
| Utente | `profiles` |
| Conti | `accounts`, `account_balance_adjustments` |
| Classificazione | `categories`, `tags` |
| Movimenti | `transactions`, `transaction_tags` |
| Budget | `budget_months`, `budget_items`, `budget_item_tags`, `recurring_items` |
| Rate | `installment_plans`, `installment_payments` |
| Carte | `credit_cards`, `credit_card_cycles` |
| Tasse | `tax_funds` |
| Crediti | `receivables`, `receivable_payments` |
| Debiti | `payables`, `payable_payments` |
| Risparmio | `savings_buckets`, `bucket_allocations` |

Ogni tabella privata contiene `user_id`, chiavi esterne, timestamp e policy RLS. Le allocazioni bucket sono protette da un trigger che impedisce di superare il saldo del conto. Le occorrenze ricorrenti hanno un indice univoco `(user_id, recurring_item_id, expected_date)`.

## Regole contabili applicate

- Un trasferimento personale modifica due saldi ma non entra nei totali di entrate/uscite.
- Un credito non incassato è patrimonio potenziale, non liquidità.
- Un rimborso ricevuto aumenta il conto e riduce il credito, ma è distinto dallo stipendio.
- Un acquisto con carta riduce il saldo della carta (debito più alto), non il conto corrente.
- Il pagamento carta riduce il conto e aumenta il saldo carta verso zero; non è una nuova spesa.
- Un fondo fiscale resta nel patrimonio ma viene sottratto dai soldi liberi.
- Un bucket classifica parte di un conto e non genera valore aggiuntivo.
- Nessuna conversione implicita tra EUR e CHF.

## PWA

Su iPhone apri il sito in Safari e scegli **Condividi → Aggiungi alla schermata Home**. Su macOS usa **File → Aggiungi al Dock** in Safari oppure l’opzione di installazione del browser supportato.

Il manifest e l’icona sono già inclusi. Per una PWA offline completa si può aggiungere in una fase successiva un service worker con una strategia di cache prudente; i dati finanziari autenticati non dovrebbero essere memorizzati indiscriminatamente.

## Fase successiva

Lo schema è già pronto, ma sono rimandate le UI complete per:

- piani rateali e calendario rate;
- debiti verso persone;
- cicli carta avanzati, pending/posted e limite modificabile;
- editor completo di categorie, sottocategorie ed etichette;
- frequenze ricorrenti personalizzate avanzate;
- tasso di cambio esplicito e storico (nessuna conversione è attiva oggi);
- service worker/offline queue;
- test end-to-end con un progetto Supabase di staging.

## Concetti tecnici da approfondire

1. Row Level Security e differenza tra chiave anonima e `service_role`.
2. Transazioni ACID e funzioni RPC Postgres.
3. Modellazione monetaria in unità minime.
4. Ledger, saldi derivati e riconciliazione.
5. Idempotenza di seed, ricorrenze e retry.
6. Server/client components e gestione sessione in Next.js.
7. Validazione condivisa con Zod.
8. PWA, cache e rischi specifici dei dati sensibili.
