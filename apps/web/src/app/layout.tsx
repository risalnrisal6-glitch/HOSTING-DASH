import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { DynamicBranding } from "./dynamic-branding";

export const metadata: Metadata = {
  title: {
    default: "NOVA PANEL — Premium Hosting",
    template: "%s · NOVA PANEL",
  },
  description: "Premium Pterodactyl hosting dashboard — deploy and manage game servers, bots and applications in seconds.",
};

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Default favicon — overridden at runtime by DynamicBranding */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%238b5cf6'/><stop offset='1' stop-color='%233b82f6'/></linearGradient></defs><rect width='100' height='100' rx='24' fill='url(%23g)'/><text x='50' y='68' font-size='52' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>N</text></svg>" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <DynamicBranding />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "rgba(13,15,33,0.95)",
                border: "1px solid rgba(139,92,246,0.25)",
                color: "#e2e8f0",
                backdropFilter: "blur(12px)",
                borderRadius: "14px",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}