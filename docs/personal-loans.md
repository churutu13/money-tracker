# Prestiti e crediti

La pagina `/loans` usa lo stesso AppProvider e la stessa chiave localStorage v8
(elenco `loans` facoltativo) del resto di Flow. Importazione/esportazione include
piani e riferimenti alle transazioni. Non aggiunge sincronizzazione o autenticazione:
come gli altri dati attuali, l'isolamento è quello del browser e dell'origine.
Il repository Supabase è una predisposizione non usata dall'app e non è modificato.

La migrazione aggiunge una bozza solo se `loans` non è presente. Non altera fondi,
conti o importi esistenti. Il caso mamma resta senza anticipi effettivi e senza
rimborsi quantificati; la conferma della data abilita solo previsioni.

I movimenti di capitale sono transazioni `transfer` con metadati `loan` (prestito,
tipo, verso e identificatore dell'occorrenza prevista). Non entrano nei filtri
income/expense. La direzione esplicita supporta anche prestiti ricevuti.
I calcoli del capitale avvengono in centesimi, con conversione ai numeri in euro
usati dal progetto al confine della persistenza. Il solo collegamento di un fondo
è informativo: il saldo cambia una sola volta sul conto della transazione.

Associare una transazione contabilizzata la riclassifica senza toccare il saldo;
non crea copie. Non sono associabili movimenti ricorrenti, Amex, budget o movimenti
già collegati. Modificare un movimento effettivo inverte il precedente e applica
il nuovo mantenendo ID e conto. Eliminare rimuove anche la transazione e inverte
il saldo: non equivale a scollegare e mantenere una spesa ordinaria.

Le ricorrenze mensili sono modificabili e limitate dal tetto, dalla fine del piano
o dall'orizzonte (massimo 120 occorrenze). Un'occorrenza registrata è esclusa dal
piano per ID. Sospendere blocca gli anticipi previsti, archiviare esclude tutte le
previsioni e conserva il capitale effettivo. Le finestre di rimborso senza importi
non generano flussi. I movimenti previsti scaduti rimangono in timeline per verifica.

Plan include i flussi futuri quantificati quando sono attivi i dati Flow. Usa i
saldi reali savings/tax iniziali, mantenendo la separazione del modello fra
liquidità disponibile e riserva tasse. Un flusso sul fondo tasse modifica la
riserva, gli altri la liquidità. Il ritardo 0/1/2/3 mesi è stato temporaneo della UI;
le metriche di liquidità, soglia e casa sono ricalcolate dal motore esistente.
Con i dati Flow il patrimonio include liquidità, riserva tasse e capitale netto
prestiti una volta sola. Gli scenari workbook conservano la propria convenzione
precedente, che esclude la riserva tasse.

MVP: solo EUR, capitale senza interessi; nessuna conversione valutaria, importazione
bancaria o sincronizzazione multiutente. Nessuna transazione pianificata viene
registrata automaticamente quando passa la data. Il saldo locale reale non è
accessibile ai test automatici: i test usano esclusivamente fixture isolate.
