"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Palette, Shirt, Sun, Tag } from "lucide-react";

const TABS = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/catalog", label: "Closet", icon: Shirt },
  { href: "/add", label: "Add", icon: CirclePlus },
  { href: "/fitting-room", label: "Fitting", icon: Tag },
  { href: "/onboarding", label: "Style", icon: Palette },
] as const;

/** The app's main navigation, at thumb height. Hidden on the sign-in screen. */
export function TabBar() {
  const path = usePathname();
  if (path === "/login") return null;
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
    <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0" /> {/* keeps page content clear of the fixed bar */}
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm supports-backdrop-filter:bg-background/85">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={current ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${current ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="size-5" strokeWidth={current ? 2.25 : 1.75} aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
