import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contas a Receber — Omie",
  description:
    "Descontos de contrato, boletos, parcelamento e conta corrente integrados ao Omie.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
