import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_ACCOUNTS, LOCAL_DEMO_COOKIE } from "@/lib/demo-data";
import type { Profile, UserRole } from "@/types/database";

export interface SessionContext {
  profile: Profile | null;
  isDemoLocal: boolean;
}

export async function getCurrentSession(): Promise<SessionContext> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get(LOCAL_DEMO_COOKIE)?.value;
    if (roleCookie === "owner" || roleCookie === "staff") {
      return {
        profile: DEMO_ACCOUNTS[roleCookie as UserRole].profile,
        isDemoLocal: true,
      };
    }
    return { profile: null, isDemoLocal: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, isDemoLocal: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return { profile, isDemoLocal: false };
  }

  return {
    profile: {
      id: user.id,
      full_name:
        typeof user.user_metadata?.full_name === "string" &&
        user.user_metadata.full_name.trim().length > 0
          ? user.user_metadata.full_name
          : user.email?.split("@")[0] || "Pengguna",
      role: "staff",
      whatsapp_number: null,
      created_at: user.created_at,
    },
    isDemoLocal: false,
  };
}
