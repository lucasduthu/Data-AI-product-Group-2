import type { Metadata } from "next";
import localFont from "next/font/local";
import { Navbar } from "@/components/navbar";
import { WorkspaceProvider } from "@/context/workspace-context";
import "./globals.css";

const fontMicro = localFont({
  src: [
    {
      path: "../../public/fonts/Micro-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Micro-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Micro-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-micro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Korom — Copyrights & Royalties Manager",
  description:
    "Plateforme KOpyright & ROyalties Manager : catalogue d'œuvres, extraction structurée de contrats et réconciliation déterministe de relevés.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={fontMicro.variable}>
      <body className="min-h-screen flex flex-col font-sans">
        <WorkspaceProvider>
          <Navbar />
          <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
