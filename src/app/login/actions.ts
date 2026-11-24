"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_ACCOUNTS, LOCAL_DEMO_COOKIE } from "@/lib/demo-data";
import type { UserRole } from "@/types/database";

export interface AuthActionResult {
  error?: string;
}

export async function loginWithEmail(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase belum dihubungkan di .env.local. Gunakan tombol 1-Click Demo Login di bawah untuk mencoba aplikasi secara lokal.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        "Email atau kata sandi tidak cocok. Periksa kembali atau gunakan tombol 1-Click Demo Login.",
    };
  }

  redirect("/");
}

export async function loginWithDemoRole(
  role: UserRole
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    cookieStore.set(LOCAL_DEMO_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/");
  }

  const account = DEMO_ACCOUNTS[role];
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error) {
    return {
      error:
        "Akun demo belum tersedia di Supabase Auth. Pastikan supabase/schema.sql dan supabase/seed.sql sudah dijalankan.",
    };
  }

  redirect("/");
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(LOCAL_DEMO_COOKIE);
  }
  redirect("/login");
}
