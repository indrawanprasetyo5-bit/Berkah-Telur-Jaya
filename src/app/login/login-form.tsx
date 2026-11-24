"use client";

import { useActionState, useState, useTransition } from "react";
import {
  loginWithDemoRole,
  loginWithEmail,
  type AuthActionResult,
} from "./actions";
import type { UserRole } from "@/types/database";

interface LoginFormProps {
  supabaseConfigured: boolean;
}

const initialState: AuthActionResult = {};

export function LoginForm({ supabaseConfigured }: LoginFormProps) {
  const [state, formAction, isEmailPending] = useActionState(
    loginWithEmail,
    initialState
  );
  const [demoError, setDemoError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [isDemoPending, startDemoTransition] = useTransition();

  function handleDemoLogin(role: UserRole) {
    setDemoError(null);
    setPendingRole(role);
    startDemoTransition(async () => {
      const result = await loginWithDemoRole(role);
      if (result?.error) {
        setDemoError(result.error);
        setPendingRole(null);
      }
    });
  }

  const activeError = demoError || state.error;

  return (
    <div className="space-y-4">
      {!supabaseConfigured && (
        <div
          role="status"
          className="inline-flex max-w-full items-center gap-2 rounded-md border border-warn-border bg-warn-bg px-3 py-1.5 text-xs font-bold text-warn"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />
          <span className="truncate">
            Mode Demo Lokal aktif (tanpa database Supabase)
          </span>
        </div>
      )}

      {activeError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-danger-border bg-danger-bg px-4 py-3 text-sm font-semibold text-danger"
        >
          {activeError}
        </div>
      )}

      <section
        aria-label="Masuk cepat akun demo"
        className="rounded-xl border-2 border-border-strong bg-surface p-4"
      >
        <h2 className="text-base font-bold text-ink">1-Click Demo Login</h2>
        <p className="mt-1 text-sm font-medium text-ink-muted">
          Coba aplikasi langsung tanpa mengetik email dan kata sandi.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={isDemoPending || isEmailPending}
            onClick={() => handleDemoLogin("staff")}
            className="flex min-h-14 flex-col items-start justify-center rounded-lg border-2 border-accent bg-accent px-4 py-3 text-left text-ink-inverse transition-colors duration-150 hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60"
          >
            <span className="text-base font-bold">
              {pendingRole === "staff"
                ? "Membuka Kasir…"
                : "Demo Kasir / Staff"}
            </span>
            <span className="text-xs font-medium text-accent-soft">
              Lala (Kasir, Stok, Kas Keluar)
            </span>
          </button>

          <button
            type="button"
            disabled={isDemoPending || isEmailPending}
            onClick={() => handleDemoLogin("owner")}
            className="flex min-h-14 flex-col items-start justify-center rounded-lg border-2 border-ink bg-ink px-4 py-3 text-left text-ink-inverse transition-colors duration-150 hover:bg-ink-muted active:scale-[0.99] disabled:opacity-60"
          >
            <span className="text-base font-bold">
              {pendingRole === "owner" ? "Membuka Kasir…" : "Demo Owner"}
            </span>
            <span className="text-xs font-medium text-tray">
              Pak Budi Santoso (Akses Penuh)
            </span>
          </button>
        </div>
      </section>

      <section
        aria-label="Masuk dengan akun email"
        className="rounded-xl border-2 border-border-strong bg-surface p-4"
      >
        <h2 className="text-base font-bold text-ink">Masuk Akun BTJ</h2>
        <form action={formAction} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-bold text-ink"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="owner@berkahtelurjaya.demo"
              className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-canvas px-3.5 py-2.5 text-base font-semibold text-ink placeholder:text-ink-muted/80 focus:border-accent focus:bg-surface"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-bold text-ink"
            >
              Kata Sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Masukkan kata sandi"
              className="mt-1.5 min-h-12 w-full rounded-lg border-2 border-border-strong bg-canvas px-3.5 py-2.5 text-base font-semibold text-ink placeholder:text-ink-muted/80 focus:border-accent focus:bg-surface"
            />
          </div>

          <button
            type="submit"
            disabled={isEmailPending || isDemoPending}
            className="min-h-13 w-full rounded-lg border-2 border-border-strong bg-tray px-4 py-3 text-base font-bold text-ink transition-colors duration-150 hover:border-ink hover:bg-border-subtle active:scale-[0.99] disabled:opacity-60"
          >
            {isEmailPending ? "Memeriksa Akun…" : "Masuk dengan Email"}
          </button>
        </form>
      </section>
    </div>
  );
}
