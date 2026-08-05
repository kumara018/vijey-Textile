import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LoginPromptProvider } from '@/context/LoginPromptContext';
import { WishlistProvider } from '@/context/WishlistContext';
import NavbarWrapper from '@/components/NavbarWrapper';
import FooterWrapper from '@/components/FooterWrapper';
import LoginPromptModal from '@/components/LoginPromptModal';
import PageTransition from '@/components/PageTransition';
import { Toaster } from 'react-hot-toast';
import { STORE } from '@/lib/config';

export const metadata: Metadata = {
  title: `${STORE.name} — Luxury Baby, Kids & Girls Fashion | Texvalley Erode`,
  description: 'Shop luxury Baby Frocks, Chudithar, Frocks, Western Dresses, Lehenga & Party Wear for Baby, Kids & Girls (sizes 14–40) at Vijey Textile. Located at Texvalley Gangapuram, Erode. Fast delivery across India.',
  keywords: 'Vijey Textile, vijey textile, baby frocks Erode, chudithar kids, lehenga girls, frocks online, party wear kids, western dresses girls, textile shop Erode, Texvalley Gangapuram, baby clothing India, kids fashion, girls fashion Erode',
  authors: [{ name: 'Vijey Textile' }],
  creator: 'Vijey Textile',
  publisher: 'Vijey Textile',
  metadataBase: new URL('https://vijeytextile.com'),
  alternates: { canonical: 'https://vijeytextile.com' },
  openGraph: {
    title: 'Vijey Textile — Luxury Baby, Kids & Girls Fashion',
    description: 'Shop Baby Frocks, Chudithar, Frocks, Lehenga & Party Wear for Baby, Kids & Girls (sizes 14–40) at Vijey Textile, Texvalley Gangapuram, Erode.',
    url: 'https://vijeytextile.com',
    siteName: 'Vijey Textile',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Vijey Textile — Luxury Baby, Kids & Girls Fashion',
    description: 'Shop Baby Frocks, Chudithar, Frocks, Lehenga & Party Wear for Baby, Kids & Girls (sizes 14–40) at Vijey Textile, Texvalley Erode.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: 'IQsLO0zH60lGqrYy7Jd7nvjDFO_Uf0HKbtNcK8bDsHM',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
        <link rel="shortcut icon" href="/favicon.svg?v=2" />
        <link rel="apple-touch-icon" href="/favicon.svg?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-maroon-100 min-h-screen flex flex-col">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
            <LoginPromptProvider>
              <NavbarWrapper />
              <main className="flex-1"><PageTransition>{children}</PageTransition></main>
              <FooterWrapper />
              <LoginPromptModal />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#fff',
                    color: '#1a0800',
                    border: '1px solid #f0e0d4',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 20px rgba(139,21,56,0.12)',
                  },
                  success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
                  error:   { iconTheme: { primary: '#c62828', secondary: '#fff' } },
                }}
              />
            </LoginPromptProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
