import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { themeBootstrapScript } from "@/lib/themePrefs";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
export const metadata: Metadata = {
  title: "Pulseframe Events",
  description: "A polished event booking and analytics studio with theme controls and unique event URLs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          id="razorpay-checkout"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
