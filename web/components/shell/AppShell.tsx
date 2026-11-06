import Link from "next/link";
import { HeaderActions } from "@/components/shell/HeaderActions";
import { NavLinks } from "@/components/shell/NavLinks";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              ClearPath Review
            </Link>
            <NavLinks />
          </div>
          <HeaderActions />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
