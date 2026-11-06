"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocksEnabled = process.env.NEXT_PUBLIC_API_MOCKS === "1";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [ready, setReady] = useState(!mocksEnabled);

  useEffect(() => {
    if (!mocksEnabled) return;
    let cancelled = false;
    import("@/mocks/browser")
      .then(({ worker }) =>
        worker.start({ onUnhandledFrame: "bypass", quiet: true }),
      )
      .catch((error) => {
        console.error("Failed to start MSW worker", error);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {ready ? children : null}
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
