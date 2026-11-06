"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupsTab } from "./GroupsTab";
import { ProductsTab } from "./ProductsTab";
import { UsersTab } from "./UsersTab";
import { ListSkeleton } from "./shared";

const TABS = ["users", "groups", "products"] as const;
type SetupTab = (typeof TABS)[number];

function parseTab(value: string | null): SetupTab {
  return (TABS as readonly string[]).includes(value ?? "") ? (value as SetupTab) : "users";
}

function SetupTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  function onTabChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="gap-6">
      <TabsList aria-label="Setup sections">
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="groups">Groups</TabsTrigger>
        <TabsTrigger value="products">Products</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UsersTab />
      </TabsContent>
      <TabsContent value="groups">
        <GroupsTab />
      </TabsContent>
      <TabsContent value="products">
        <ProductsTab />
      </TabsContent>
    </Tabs>
  );
}

export function SetupView() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Setup</h1>
        <p className="text-sm text-muted-foreground">
          Users, groups and the approval workflow for each product. Everyone signed in can edit.
        </p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <SetupTabs />
      </Suspense>
    </div>
  );
}
