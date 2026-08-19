import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LoginPromptProvider } from '@/context/LoginPromptContext';
import { WishlistProvider } from '@/context/WishlistContext';
import NavGate, { ChromeGate } from '@/components/nav/NavGate';
import FooterWrapper from '@/components/FooterWrapper';
import { fontVariables } from '@/lib/fonts';
import LoginPromptModal from '@/components/LoginPromptModal';
import PageTransition from '@/components/PageTransition';
import QueryProvider from '@/components/QueryProvider';
import ThreeProvider from '@/three/ThreeProvider';
import Letterbox from '@/components/Letterbox';
import CaptureMode from '@/components/CaptureMode';
import ErrorReporting from '@/components/ErrorReporting';
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
    <html lang="en" className={fontVariables}>
      <head>
        <link rel="icon" type="image/jpeg" href="/icon-mark.jpg?v=4" />
        <link rel="shortcut icon" href="/icon-mark.jpg?v=4" />
        <link rel="apple-touch-icon" href="/icon-mark.jpg?v=4" />
      </head>
      {/* Cinematic ground. Never pure black — print black is lifted and cool,
          and the film LUT grades toward that same toe. */}
      <body className="bg-night min-h-screen flex flex-col font-sans antialiased">
        {/* The single persistent 3D canvas. Sits outside the providers and
            outside PageTransition so it is never remounted by a route change
            — the GL context, compiled shaders and uploaded textures survive
            navigation. Fixed at z-0; all real UI renders above it. */}
        {/* Offline-render only: strips the DOM so a captured frame contains
            the scene alone. Inert without ?capture=1. */}
        {/* Notices what the React boundaries cannot: throws outside render —
            rejected promises from handlers, failed dynamic imports, the scene
            loader and the sequence decoder. */}
        <ErrorReporting />
        <Suspense fallback={null}><CaptureMode /></Suspense>
        <ThreeProvider />
        {/* Outermost of the data providers: AuthContext, CartContext and
            WishlistContext all issue queries, so the client has to exist
            above them. */}
        <QueryProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
            <LoginPromptProvider>
              {/* relative z-10: the canvas is position:fixed, which creates a
                  stacking context and would otherwise paint over static page
                  content. Everything the customer actually reads or clicks
                  stays real HTML, above the canvas. */}
              <div className="relative z-10 flex flex-col flex-1">
                <NavGate />
                <main id="main" className="flex-1"><PageTransition>{children}</PageTransition></main>
                <FooterWrapper />
              </div>
              {/* Cinematic overlays. Both sit above the canvas and below the
                  modals, and neither takes pointer events — the path to
                  checkout is never behind them. */}
              <ChromeGate>
                <Letterbox />
                {/* THE AMBIENT SOUND TOGGLE IS GONE.
                    It was a fixed bottom-left black circle on z-30, which
                    means it sat on top of the page content on every route at
                    every size — on a phone it covered the first column of the
                    footer, which is where the shop's own name and address
                    are. It was also bg-black/55 on a shop that has been relit
                    to a pale ground, so the single darkest object on the page
                    was a decorative control.
                    A shop where a customer is deciding whether to spend money
                    does not open with sound, and no storefront a customer
                    would compare this to has an ambient audio control. The
                    component is left in the tree, unmounted, rather than
                    deleted — it is a design decision, not a bug fix, and it
                    should be easy to reverse. */}
              </ChromeGate>
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
        </QueryProvider>
      </body>
    </html>
  );
}
