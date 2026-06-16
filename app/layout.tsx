import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "joshua certified background remover",
  description: "jus a little off the top bruh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
