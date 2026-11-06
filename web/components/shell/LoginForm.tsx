"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isApiError, useLogin, useSession } from "@/lib/api";
import { nextFromSearch } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/components/shell/demo-users";

function errorMessage(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 401) return "Incorrect email or password.";
    return error.message;
  }
  return "Something went wrong. Try again.";
}

export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signedIn = session.data?.user != null;
  useEffect(() => {
    if (signedIn) router.replace(nextFromSearch(window.location.search) ?? "/");
  }, [signedIn, router]);

  if (session.isLoading || signedIn) {
    return (
      <div role="status" aria-label="Loading" className="space-y-4">
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const submit = (nextEmail: string, nextPassword: string) => {
    login.mutate(
      { email: nextEmail, password: nextPassword },
      {
        onSuccess: () =>
          router.replace(nextFromSearch(window.location.search) ?? "/"),
      },
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">ClearPath Review</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to review and approve marketing materials.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(email.trim(), password);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={login.isError || undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={login.isError || undefined}
          />
        </div>
        {login.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(login.error)}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <section aria-labelledby="demo-heading" className="space-y-3">
        <div className="space-y-1">
          <h2
            id="demo-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Demo accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Demo password: <code className="font-mono">{DEMO_PASSWORD}</code>
          </p>
        </div>
        <ul className="space-y-1">
          {DEMO_LOGINS.map((demo) => (
            <li key={demo.email}>
              <button
                type="button"
                disabled={login.isPending}
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(DEMO_PASSWORD);
                  submit(demo.email, DEMO_PASSWORD);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{demo.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {demo.email}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {demo.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
