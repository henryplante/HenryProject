"use client";

import Link from "next/link";
import { HeaderActions } from "@/components/shell/HeaderActions";
import { NavLinks } from "@/components/shell/NavLinks";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionGuard } from "@/components/shell/SessionGuard";

function NavSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-1">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-14" />
    </div>
  );
}

function ActionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      <Skeleton className="h-8 w-[4.5rem]" />
      <Skeleton className="size-8" />
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SessionGuard
        header={({ authenticated, loading }) => (
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-6 px-6">
              <div className="flex items-center gap-8">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                  ClearPath Review
                </Link>
                {authenticated ? <NavLinks /> : loading ? <NavSkeleton /> : null}
              </div>
              {authenticated ? <HeaderActions /> : loading ? <ActionsSkeleton /> : null}
            </div>
          </header>
        )}
      >
        {children}
      </SessionGuard>
    </div>
  );
}
