import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo — Memory Brain",
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
        {children}
      </body>
    </html>
  );
}
