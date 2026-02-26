"use client";

import { useEffect, useState } from "react";

type ToastLevel = "success" | "error" | "info";

type ToastInput = {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

type ToastItem = ToastInput & {
  id: number;
  level: ToastLevel;
};

type Listener = (toast: ToastItem) => void;

let listeners: Listener[] = [];
let toastId = 0;

function emit(level: ToastLevel, input: ToastInput | string) {
  const payload = typeof input === "string" ? { title: input } : input;

  const item: ToastItem = {
    id: ++toastId,
    level,
    title: payload.title,
    description: payload.description,
    actionLabel: payload.actionLabel,
    actionHref: payload.actionHref,
  };

  listeners.forEach((listener) => listener(item));
}

export const toast = {
  success: (input: ToastInput | string) => emit("success", input),
  error: (input: ToastInput | string) => emit("error", input),
  info: (input: ToastInput | string) => emit("info", input),
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 5200);
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {items.map((item) => {
        const levelStyles =
          item.level === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : item.level === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-900";

        return (
          <div key={item.id} className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ${levelStyles}`}>
            {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
            {item.description ? <p className="mt-1 text-xs opacity-90">{item.description}</p> : null}
            {item.actionLabel && item.actionHref ? (
              <a
                className="mt-2 inline-block rounded-md border border-current px-2 py-1 text-xs font-medium hover:opacity-80"
                href={item.actionHref}
                rel="noreferrer"
                target="_blank"
              >
                {item.actionLabel}
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
