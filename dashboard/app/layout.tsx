import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Echo · Jarvis Mode",
  description: "Personalized memory dashboard with gesture-controlled recall.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-charcoal-900 text-amber-glow antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
