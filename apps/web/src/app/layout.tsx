import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Inicio | NEXU', template: '%s | NEXU' }, description: 'Una nueva forma de acompañar la vida académica.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="es"><body>{children}</body></html>; }
