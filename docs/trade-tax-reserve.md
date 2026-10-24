# Trade: riserva teorica, prestito e liquidità reale

In Settings → Funds → Tax Reserve → conti, il conto Trade propone un riepilogo
attivabile. L'opzione è disponibile anche sugli altri conti Tax Reserve.
L'attivazione collega un prestito concesso esistente (preferenza alla bozza
mamma) o ne crea uno, mantenendo tutti i saldi e le transazioni. Nessun importo
viene considerato già versato o prestato. Su una bozza ancora senza movimenti
la finestra anticipi è proposta dal mese corrente fino al prossimo maggio;
la data di inizio rimane da confermare. Non vengono create tranche di rimborso.

Il saldo del conto rimane la **liquidità reale**. I tre valori sono:

- riserva teorica = saldo reale + capitale residuo del prestito collegato;
- capitale prestato = anticipi effettivi meno rimborsi nella stessa anagrafica;
- disponibilità reale = riserva teorica meno capitale prestato.

Il teorico è calcolato, non una seconda attività patrimoniale salvata. Home,
progressi fiscali e proiezioni continuano a leggere solo i saldi reali. Il credito
è quello già conteggiato dal modulo Prestiti. Ogni prestito può essere associato
al riepilogo di un solo conto, e il suo conto operativo resta quello Tax Reserve.

«Modifica totali» offre due campi cumulativi: teorico e residuo del prestito.
Salvando un teorico maggiore, si esegue lo stesso aggiornamento manuale del saldo
che l'utente già effettuava in Settings (senza creare reddito). L'eventuale delta
del capitale crea un solo movimento effettivo nella sezione Prestiti. La fase di
aggiustamento del teorico e il movimento di capitale sono una sola mutazione
atomica dello store. Valori uguali non aggiungono altre transazioni.

Esempio di fixture: partendo da 7.600 € reali e nessun prestito, teorico 8.450 € e
prestito 500 € producono 7.950 € reali: incremento effettivo di 350 €. Il saldo
iniziale non viene mai preimpostato o sovrascritto dall'app.

«Prepara mese» precompila +850 € teorici e fino a +500 € di anticipi. Mostra prima
il risultato e richiede di confermare importi effettivi. Se un anticipo del mese
è già nei Prestiti, viene detratto dall'anticipo da aggiungere; l'accantonamento
non viene duplicato automaticamente. Un mese confermato è segnato sul conto per
impedire una seconda aggiunta accidentale. Se l'accantonamento del mese è stato
già inserito manualmente prima dell'attivazione, usare i totali cumulativi.

850 €, 500 € e fine indicativa a maggio sono preferenze modificabili. Dopo il
mese finale, «Prepara mese» propone solo l'accantonamento e nessun nuovo prestito.
Il piano non registra operazioni allo scadere delle date. Il rientro maggio–giugno
rimane indicativo e modificabile nei Prestiti. Aumentare il residuo significa
registrare un anticipo effettivo; diminuirlo significa registrare un rimborso.
Per rettificare errori, modificare/eliminare il movimento nei Prestiti: il saldo
reale e i tre totali si riallineano una volta sola.

Il collegamento e le preferenze sono in `FundAccount.taxReserveTracking`, inclusi
nella persistenza locale e nel backup dello stesso workspace. Nessun saldo del
browser dell'utente viene letto o modificato dai test: si usano fixture isolate.
