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
  title: `${STORE.name} — Premium Girls' & Baby Fashion | Texvalley Erode`,
  description: 'Shop premium Baby Frocks, Western Dresses, Frocks, Lehenga & Party Wears at Vijey Textile. Located at Texvalley Gangapuram, Erode. Fast delivery across India. 100% authentic products.',
  keywords: 'Vijey Textile, vijey textile, ammalutex, textile shop Erode, Texvalley Gangapuram, chudithar, lehenga, tops, crop tops, party wear, women fashion, Erode textile, buy chudithar online, women clothing India',
  authors: [{ name: 'Vijey Textile' }],
  creator: 'Vijey Textile',
  publisher: 'Vijey Textile',
  metadataBase: new URL('https://vijeytextile.com'),
  alternates: { canonical: 'https://vijeytextile.com' },
  openGraph: {
    title: 'Vijey Textile — Premium Women\'s Textiles',
    description: 'Shop Baby Frocks, Western Dresses, Frocks, Lehenga & Party Wears at Vijey Textile, Texvalley Gangapuram, Erode.',
    url: 'https://vijeytextile.com',
    siteName: 'Vijey Textile',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Vijey Textile — Premium Women\'s Textiles',
    description: 'Shop Baby Frocks, Frocks, Western Dresses, Lehenga & more at Vijey Textile, Texvalley Erode.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: 'vdZpTkr1hRH3z7cLVbtyzehOWAEgqlJQLkwY14gEhUg',
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
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#fff9f2] min-h-screen flex flex-col">
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
                  success: { iconTheme: { primary: '#8b1538', secondary: '#fff' } },
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
