"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Conferma accesso in corso…");

  useEffect(() => {
    async function completeLogin() {
      const code = new URLSearchParams(window.location.search).get("code");
      const supabase = createClient();
      if (!code || !supabase) {
        setMessage("Link di accesso non valido.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    }

    void completeLogin();
  }, []);

  return (
    <div className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div>
        <Loader2 className="mx-auto size-7 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
