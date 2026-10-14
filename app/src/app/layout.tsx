import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ownfit",
  description: "Your closet, catalogued. Outfits from clothes you own.",
};

export const viewport: Viewport = {
  viewportFit: "cover", // lets the tab bar sit above the phone's home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
