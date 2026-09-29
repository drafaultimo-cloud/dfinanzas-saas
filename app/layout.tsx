import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DRM-IA Finanzas • SaaS de Control y Deudas con IA',
  description: 'Controlá tus finanzas, tarjetas y deudas con Inteligencia Artificial - DRM-IA',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  themeColor: '#0B192C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0B192C" />
      </head>
      <body>{children}</body>
    </html>
  );
}