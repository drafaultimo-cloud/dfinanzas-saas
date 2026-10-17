import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Plus Jakarta Sans (licencia OFL), alojada en el propio proyecto: carga rápida y sin depender de servicios externos.
const display = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DRM-IA Finanzas · Sabé cuánto podés gastar hoy',
  description: 'Importá el resumen de tu tarjeta, controlá pesos y dólares, recibí avisos de vencimientos y mirá cuánto te queda libre. 10 días gratis, sin tarjeta.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'DRM-IA Finanzas', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0B192C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={display.variable}>{children}</body>
    </html>
  );
}