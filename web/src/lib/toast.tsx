"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ toast: (message: string, kind?: ToastKind) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastCtx);

const styles: Record<ToastKind, string> = {
  success: "border-ok/30 bg-white text-slate-800",
  error: "border-danger/30 bg-white text-slate-800",
  info: "border-line bg-white text-slate-800",
};
const dots: Record<ToastKind, string> = {
  success: "bg-ok",
  error: "bg-danger",
  info: "bg-primary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg shadow-slate-900/5 ${styles[t.kind]}`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dots[t.kind]}`} />
            <p className="text-[13px] leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
