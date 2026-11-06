"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTaskCounts } from "@/lib/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/setup", label: "Setup" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/materials");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  const { data: counts } = useTaskCounts();
  return (
    <nav aria-label="Primary" className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {href === "/" && counts && counts.mine > 0 ? (
              <span
                data-testid="home-task-count"
                className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-medium text-primary-foreground tabular-nums"
              >
                {counts.mine}
                <span className="sr-only"> tasks waiting</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
