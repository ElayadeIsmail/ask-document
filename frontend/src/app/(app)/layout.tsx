import { Suspense } from "react";

import { AuthScreen } from "@/components/auth-screen";
import { getCurrentUser } from "@/lib/current-user";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper" />}>
      <Authed>{children}</Authed>
    </Suspense>
  );
}

async function Authed({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <AuthScreen />;
  return children;
}
