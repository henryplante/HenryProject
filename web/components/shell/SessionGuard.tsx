"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/api";
import { consumeExplicitLogout, currentPath, loginHref } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]"
    >
      <div className="space-y-px border-r">
        <div className="border-b px-3 py-3">
          <Skeleton className="h-8 w-full" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 border-b px-4 py-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      <div className="space-y-3 px-6 py-4">
        <Skeleton className="h-6 w-80 max-w-full" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
    </div>
  );
}

export function SessionGuard({
  header,
  children,
}: {
  header: (props: { authenticated: boolean; loading: boolean }) => React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, isError, refetch } = useSession();
  const unauthenticated = data !== undefined && data.user === null;

  useEffect(() => {
    if (!unauthenticated) return;
    const next = consumeExplicitLogout() ? null : currentPath(window.location);
    router.replace(loginHref(next));
  }, [unauthenticated, router]);

  const authenticated = data?.user != null;
  const loading = data === undefined && !isError;

  return (
    <>
      {header({ authenticated, loading })}
      <main className="flex min-h-0 flex-1 flex-col">
        {authenticated ? (
          children
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Could not reach the server.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <ShellSkeleton />
        )}
      </main>
    </>
  );
}
