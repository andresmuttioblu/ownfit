import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE_S, isPasswordCorrect, sessionToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const WRONG_PASSWORD_DELAY_MS = 1000; // slows down guessing

/** Same-origin path only: rejects //evil.com, /\\evil.com, absolute URLs and the like. */
function safeNext(next: string | undefined): string {
  try {
    const url = new URL(next || "/", "http://local");
    return url.origin === "http://local" ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}

async function signIn(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!(await isPasswordCorrect(String(formData.get("password") ?? "")))) {
    // ponytail: delay per request only; parallel guessing is limited by passcode length (setup asks for 16+ chars).
    await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS));
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(AUTH_COOKIE, (await sessionToken())!, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: AUTH_MAX_AGE_S,
  });
  redirect(next);
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error, next } = await searchParams;
  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign-in isn&apos;t configured. Add <code>APP_PASSWORD</code> and <code>AUTH_SECRET</code> to the Vercel environment variables (the setup skill explains how), then redeploy.
      </p>
    );
  }
  return (
    <form action={signIn} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
      <label className="flex flex-col gap-1 text-sm">
        Passcode
        <input name="password" type="password" autoFocus required autoComplete="current-password"
          className="rounded-md border px-3 py-2 text-base" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">Wrong passcode.</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ownfit</h1>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
