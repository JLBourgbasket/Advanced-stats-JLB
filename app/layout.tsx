import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JL Bourg · Performance Lab",
  description: "Analyse automatisée des boxscores et rapports de performance JL Bourg.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
