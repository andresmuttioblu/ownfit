import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE_S, isPasswordCorrect, sessionToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/notice";
import { EmptyHanger } from "@/components/illustrations";

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
      <Notice>
        <p>Sign-in isn&apos;t configured. Add <code>APP_PASSWORD</code> and <code>AUTH_SECRET</code> to the Vercel environment variables (the setup skill explains how), then redeploy.</p>
      </Notice>
    );
  }
  return (
    <form action={signIn} className="flex w-full flex-col gap-3">
      <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Passcode
        <Input name="password" type="password" autoFocus required autoComplete="current-password" aria-invalid={error ? true : undefined}
          className="h-12 rounded-xl px-4 text-base" />
      </label>
      {error && <Notice tone="error">Wrong passcode. Try again.</Notice>}
      <Button type="submit" className="h-12 rounded-xl text-base">Sign in</Button>
    </form>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pt-5 pb-8">
      <div className="rise-in flex flex-col items-center gap-3 text-center">
        <EmptyHanger className="h-14 text-muted-foreground" />
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Ownfit</h1>
        <p className="text-sm text-muted-foreground">Your closet, ready when you are.</p>
      </div>
      <div className="rise-in" style={{ "--i": 1 } as React.CSSProperties}>
        <Suspense>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
