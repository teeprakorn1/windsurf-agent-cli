import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aiyu MultiAgent — Dashboard",
  description: "Real-time agent monitoring dashboard",
  openGraph: {
    title: "Aiyu MultiAgent — Dashboard",
    description: "Real-time agent monitoring dashboard",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Aiyu MultiAgent — Dashboard",
    description: "Real-time agent monitoring dashboard",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
