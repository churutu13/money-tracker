"use client";

import Link from "next/link";
import {
  ChevronRight,
  CircleUserRound,
  CreditCard,
  Database,
  Landmark,
  LogOut,
  MoonStar,
  PiggyBank,
  ReceiptText,
  Repeat2,
  RotateCcw,
  Settings2,
  Tags,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/conti", label: "Conti e contanti", description: "Saldi e riconciliazione", icon: Landmark },
  { href: "/ricorrenti", label: "Spese ricorrenti", description: "Abbonamenti e scadenze", icon: Repeat2 },
  { href: "/tasse", label: "Tasse", description: "Fondi fiscali separati", icon: PiggyBank },
  { href: "/crediti", label: "Crediti", description: "Rimborsi da ricevere", icon: CircleUserRound },
  { href: "/amex", label: "Carta Amex", description: "Ciclo e debito carta", icon: CreditCard },
];

const categories = ["Casa", "Auto", "Salute", "Palestra", "Abbonamenti", "Telefono", "Famiglia", "Assicurazioni", "Bollette", "Alimentari", "Ristoranti", "Svago", "Shopping", "Formazione", "Software", "Trasporti", "Tasse", "Risparmio", "Investimenti", "Crediti", "Debiti", "Altro"];

export default function MorePage() {
  const { seed, demoMode, user } = useFinance();
  const { theme, setTheme } = useTheme();
  const [resetOpen, setResetOpen] = useState(false);
  async function resetAllData() {
    try {
      await seed();
      setResetOpen(false);
    } catch (error) {
      toast.error("Azzeramento non riuscito", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }
  async function logout() {
    const supabase = createClient();
    const { error } = await supabase?.auth.signOut() ?? { error: null };
    if (error) toast.error("Uscita non riuscita", { description: error.message });
  }
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-semibold tracking-tight">Altro</h2><p className="mt-1 text-sm text-muted-foreground">Gestisci le aree specialistiche e le preferenze.</p></div>
      <Card className="overflow-hidden">
        <div className="divide-y">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                <div className="grid size-10 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-4.5" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{item.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p></div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Categorie iniziali</CardTitle><p className="mt-1 text-xs text-muted-foreground">Personalizzabili nel database</p></div><Tags className="size-5 text-primary" /></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-4">
            {categories.map((category) => <Badge key={category}>{category}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Etichette</CardTitle><p className="mt-1 text-xs text-muted-foreground">Nessun significato assegnato automaticamente</p></div><ReceiptText className="size-5 text-primary" /></CardHeader>
          <CardContent className="flex gap-3 pt-4">
            <div className="flex flex-1 items-center gap-3 rounded-xl border p-4"><span className="grid size-9 place-items-center rounded-full bg-blue-500/10 font-semibold text-blue-600">I</span><div><p className="text-sm font-semibold">I</p><p className="text-xs text-muted-foreground">Da definire</p></div></div>
            <div className="flex flex-1 items-center gap-3 rounded-xl border p-4"><span className="grid size-9 place-items-center rounded-full bg-violet-500/10 font-semibold text-violet-600">P</span><div><p className="text-sm font-semibold">P</p><p className="text-xs text-muted-foreground">Da definire</p></div></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Impostazioni</CardTitle><p className="mt-1 text-xs text-muted-foreground">{demoMode ? "Dati salvati in questo browser" : user?.email}</p></div><Settings2 className="size-5 text-primary" /></CardHeader>
        <CardContent className="space-y-2 pt-4">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted/40"><MoonStar className="size-4 text-primary" /><span className="flex-1 text-sm font-semibold">Aspetto</span><span className="text-xs text-muted-foreground">{theme === "dark" ? "Scuro" : "Chiaro / sistema"}</span></button>
          {demoMode ? (
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted/40">
                  <Database className="size-4 text-destructive" />
                  <span className="flex-1 text-sm font-semibold">Azzera tutti i dati</span>
                  <RotateCcw className="size-4 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent title="Azzerare tutti i dati?" description="Conti, movimenti, budget, tasse, crediti e bucket salvati su questo dispositivo verranno eliminati.">
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>Annulla</Button>
                  <Button variant="destructive" className="flex-1" onClick={resetAllData}>Azzera tutto</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
          {!demoMode ? <Button variant="outline" className="w-full justify-start text-destructive" onClick={logout}><LogOut className="size-4" />Esci dall’account</Button> : null}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        Rate e debiti dispongono già delle tabelle, dei vincoli e delle policy RLS nello schema. Le schermate dedicate sono previste nella fase successiva, come richiesto dal perimetro MVP.
      </div>
    </div>
  );
}
