"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(options);
  }), []);

  const finish = useCallback((answer: boolean) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish, request]);

  useEffect(() => () => resolver.current?.(false), []);

  return <ConfirmContext.Provider value={confirm}>
    {children}
    {request ? <div className="flow-dialog-layer">
      <button className="flow-dialog-backdrop" aria-label="Cancel" onClick={() => finish(false)} />
      <section className="flow-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="flow-dialog-title" aria-describedby="flow-dialog-message">
        <header>
          <span className={`flow-dialog-icon ${request.danger ? "danger" : ""}`}><AlertTriangle size={18} /></span>
          <button className="icon-button" type="button" onClick={() => finish(false)} aria-label="Close"><X size={18} /></button>
        </header>
        <h2 id="flow-dialog-title">{request.title}</h2>
        <p id="flow-dialog-message">{request.message}</p>
        <div className="flow-dialog-actions">
          <button className="secondary-button" type="button" onClick={() => finish(false)}>{request.cancelLabel ?? "Cancel"}</button>
          <button className={`primary-button ${request.danger ? "danger-button" : ""}`} type="button" onClick={() => finish(true)} autoFocus>{request.confirmLabel ?? "Confirm"}</button>
        </div>
      </section>
    </div> : null}
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}
