"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-0 flex-1 flex-col gap-4 p-6"
    >
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}

export function SessionGuard({
  header,
  children,
}: {
  header: (props: { authenticated: boolean }) => React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, isError, refetch } = useSession();
  const unauthenticated = data !== undefined && data.user === null;

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
  }, [unauthenticated, router]);

  const authenticated = data?.user != null;

  return (
    <>
      {header({ authenticated })}
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
