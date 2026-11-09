"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { logout } from "@/app/actions/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 },
        },
      }),
  );

  useEffect(() => {
    function onUnauthorized() {
      client.clear();
      void logout().finally(() => router.refresh());
    }
    window.addEventListener("askdoc-unauthorized", onUnauthorized);
    return () => window.removeEventListener("askdoc-unauthorized", onUnauthorized);
  }, [client, router]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
