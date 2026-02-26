import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Crowdfi Dashboard",
  description: "PDA-based escrow crowdfunding interface on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
