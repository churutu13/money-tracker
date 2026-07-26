"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Inserisci un’email valida"),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri"),
});
type Values = z.infer<typeof schema>;

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  async function submit(values: Values) {
    const supabase = createClient();
    if (!supabase) return;
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) return toast.error("Accesso non riuscito", { description: error.message });
      toast.success("Bentornato");
    } else {
      const { error } = await supabase.auth.signUp({
        ...values,
        options: {
          emailRedirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/callback/`,
        },
      });
      if (error) return toast.error("Registrazione non riuscita", { description: error.message });
      toast.success("Controlla la tua email", { description: "Ti abbiamo inviato il link di conferma." });
    }
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1.05fr]">
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">D</span>
            <strong className="text-xl tracking-tight">Denaro</strong>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {mode === "login" ? "Bentornato." : "Iniziamo bene."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "login"
              ? "Accedi per ritrovare il quadro completo delle tue finanze."
              : "Crea il tuo spazio privato. I tuoi dati restano solo tuoi."}
          </p>
          <form onSubmit={form.handleSubmit(submit)} className="mt-8 space-y-4">
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="nome@esempio.it" {...form.register("email")} />
            </Field>
            <Field label="Password" error={form.formState.errors.password?.message}>
              <div className="relative">
                <Input
                  className="pr-12"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1 top-1 grid size-10 place-items-center text-muted-foreground"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "login" ? "Accedi" : "Crea account"}
            </Button>
          </form>
          <button
            className="mt-6 w-full text-center text-sm font-medium text-primary hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          </button>
          <div className="mt-10 flex items-start gap-3 rounded-xl bg-muted p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Accesso protetto da Supabase Auth e dati isolati tramite Row Level Security.
          </div>
        </div>
      </section>
      <section className="hidden items-end bg-primary p-12 text-primary-foreground lg:flex">
        <blockquote className="max-w-xl">
          <p className="text-4xl font-medium leading-tight tracking-tight">
            “Sapere quanto hai non basta. Serve sapere quanto è davvero libero.”
          </p>
          <footer className="mt-6 text-sm opacity-70">Denaro separa liquidità, impegni, tasse e patrimonio.</footer>
        </blockquote>
      </section>
    </div>
  );
}
