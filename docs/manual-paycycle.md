# Avvio manuale del paycycle

In Home, nel riquadro «This pay cycle», «Inizia nuovo paycycle oggi» avvia
immediatamente il ciclo stipendio del mese corrente. Income, Fixed, Savings,
Lifestyle, l'override del disponibile e gli straordinari del mese ripartono da
zero. I conti Savings/Tax, le transazioni e i prestiti non sono modificati.

Il giorno stipendio configurato non cambia. Un avvio il 23 ottobre produce un
ciclo 23 ottobre–24 novembre senza secondo reset il 25 ottobre. Un avvio il
27 ottobre produce 27 ottobre–24 novembre; il prossimo avvio automatico resta
il 25 novembre. La chiave di registrazione resta quella del mese stipendio,
così gli straordinari di Home e Settings corrispondono allo stesso ciclo.

La modifica è salvata sul fondo Income in `payCycleResets`, insieme alla copia
dei totali e degli straordinari eventualmente presenti per quel mese. La
persistenza locale e l'import/export conservano questi dati senza migrazioni
che possano riscrivere saldi. I dati dei mesi precedenti restano registrati.

L'azione è idempotente per mese: premere più volte non cancella nuovamente i
totali appena inseriti. «Annulla reset» ripristina i totali precedenti e le date
abituali, previa conferma perché sostituisce i totali inseriti dopo il reset.
Le transazioni sono conservate anche in caso di annullamento.

Le transazioni già presenti nella data di avvio sono memorizzate per ID ed
escluse dal nuovo disponibile e dai budget: appartengono all'attività precedente
al tocco. Le nuove transazioni inserite successivamente nella stessa data
aggiornano normalmente il ciclo. I movimenti datati prima dell'avvio restano
nella cronologia senza essere dedotti dal nuovo disponibile.

Le date effettive sono condivise da disponibile, ricorrenti e raggruppamenti
della pagina Transactions. L'allocazione dei budget ricorrenti usa il mese
stipendio nominale: spostare l'inizio oltre la scadenza abituale non azzera il
budget mensile. Le scadenze dei pagamenti e il ciclo Amex rimangono indipendenti.
