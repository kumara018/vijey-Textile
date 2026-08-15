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
import ThreeProvider from '@/three/ThreeProvider';
import { Toaster } from 'react-hot-toast';
import { STORE } from '@/lib/config';

export const metadata: Metadata = {
  title: `${STORE.name} — Luxury Baby, Kids & Girls Fashion | Texvalley Erode`,
  description: 'Shop luxury Baby Frocks, Chudithar, Frocks, Western Dresses, Lehenga & Party Wear for Baby, Kids & Girls (sizes 12–40) at Vijey Textile. Located at Texvalley Gangapuram, Erode. Fast delivery across India.',
  keywords: 'Vijey Textile, vijey textile, baby frocks Erode, chudithar kids, lehenga girls, frocks online, party wear kids, western dresses girls, textile shop Erode, Texvalley Gangapuram, baby clothing India, kids fashion, girls fashion Erode',
  authors: [{ name: 'Vijey Textile' }],
  creator: 'Vijey Textile',
  publisher: 'Vijey Textile',
  metadataBase: new URL('https://vijeytextile.com'),
  alternates: { canonical: 'https://vijeytextile.com' },
  openGraph: {
    title: 'Vijey Textile — Luxury Baby, Kids & Girls Fashion',
    description: 'Shop Baby Frocks, Chudithar, Frocks, Lehenga & Party Wear for Baby, Kids & Girls (sizes 12–40) at Vijey Textile, Texvalley Gangapuram, Erode.',
    url: 'https://vijeytextile.com',
    siteName: 'Vijey Textile',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Vijey Textile — Luxury Baby, Kids & Girls Fashion',
    description: 'Shop Baby Frocks, Chudithar, Frocks, Lehenga & Party Wear for Baby, Kids & Girls (sizes 12–40) at Vijey Textile, Texvalley Erode.',
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
    icon: [{ url: '/icon-mark.jpg', type: 'image/jpeg' }],
    shortcut: '/icon-mark.jpg',
    apple: '/icon-mark.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/jpeg" href="/icon-mark.jpg?v=4" />
        <link rel="shortcut icon" href="/icon-mark.jpg?v=4" />
        <link rel="apple-touch-icon" href="/icon-mark.jpg?v=4" />
      </head>
      <body className="bg-maroon-100 min-h-screen flex flex-col">
        {/* The single persistent 3D canvas. Sits outside the providers and
            outside PageTransition so it is never remounted by a route change
            — the GL context, compiled shaders and uploaded textures survive
            navigation. Fixed at z-0; all real UI renders above it. */}
        <ThreeProvider />
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
            <LoginPromptProvider>
              {/* relative z-10: the canvas is position:fixed, which creates a
                  stacking context and would otherwise paint over static page
                  content. Everything the customer actually reads or clicks
                  stays real HTML, above the canvas. */}
              <div className="relative z-10 flex flex-col flex-1">
                <NavbarWrapper />
                <main className="flex-1"><PageTransition>{children}</PageTransition></main>
                <FooterWrapper />
              </div>
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
