import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isDemoLocal } = await getCurrentSession();

  if (!profile) {
    redirect("/login");
  }

  return (
    <AppShell profile={profile} isDemoLocal={isDemoLocal}>
      {children}
    </AppShell>
  );
}
