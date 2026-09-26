import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/components/theme/theme-constants";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "La Nueva Metropol • Colectivos en Vivo",
  description:
    "La Nueva Metropol: monitoreo de colectivos del AMBA en tiempo real, paradas y alertas de servicio.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "La Nueva Metropol",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/metropol-icon.png",
    apple: "/metropol-icon.png",
  },
  openGraph: {
    title: "La Nueva Metropol • Colectivos en Vivo",
    description:
      "Monitoreo de colectivos del AMBA en tiempo real con la identidad de La Nueva Metropol.",
    siteName: "La Nueva Metropol",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/metropol-logo.svg",
        width: 719,
        height: 179,
        alt: "La Nueva Metropol",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "La Nueva Metropol • Colectivos en Vivo",
    description: "Monitoreo de colectivos del AMBA en tiempo real.",
    images: ["/metropol-logo.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#141414",
};

const themeInitScript = `
  (function() {
    try {
      var key = '${THEME_STORAGE_KEY}';
      var stored = localStorage.getItem(key);
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = stored === 'dark' || (!stored && prefersDark) || (stored === 'system' && prefersDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={`h-full antialiased dark ${inter.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="h-full w-full overflow-hidden bg-background text-foreground overscroll-none select-none transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
