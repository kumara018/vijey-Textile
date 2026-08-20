import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LoginPromptProvider } from '@/context/LoginPromptContext';
import { WishlistProvider } from '@/context/WishlistContext';
import NavGate from '@/components/nav/NavGate';
import FooterWrapper from '@/components/FooterWrapper';
import { fontVariables } from '@/lib/fonts';
import LoginPromptModal from '@/components/LoginPromptModal';
import PageTransition from '@/components/PageTransition';
import QueryProvider from '@/components/QueryProvider';
import ThreeProvider from '@/three/ThreeProvider';
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
    icon: [{ url: '/hero-mark-v3.jpg', type: 'image/jpeg' }],
    shortcut: '/hero-mark-v3.jpg',
    apple: '/hero-mark-v3.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <head>
        <link rel="icon" type="image/jpeg" href="/hero-mark-v3.jpg?v=5" />
        <link rel="shortcut icon" href="/hero-mark-v3.jpg?v=5" />
        <link rel="apple-touch-icon" href="/hero-mark-v3.jpg?v=5" />
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
              {/* THE TWO CINEMATIC OVERLAYS ARE BOTH UNMOUNTED, and the
                  ChromeGate that carried them goes with them — it existed only
                  to hold these two.

                  Letterbox drew two solid bg-black 21:9 matte bars fixed over
                  the top and bottom of / and /products. At a 980px viewport —
                  which is what a phone reports in desktop-site mode — that is
                  a 56px black strip directly under the header and another
                  across the bottom of the product grid, on a shop whose ground
                  is #E8DCC0. Measured, not guessed: the strip was reported as
                  a dark gap under the header, and an earlier black band at the
                  foot of /products was misread as a screenshot artefact
                  because the overlay is pointer-events-none and
                  elementFromPoint looks straight through it.

                  SoundToggle was a fixed bottom-left bg-black/55 circle on
                  z-30, sitting on the page content on every route; on a phone
                  it covered the footer's first column, where the shop's name
                  and address are.

                  Between them they were the darkest objects on a relit shop
                  and cost ~112px of screen on the two pages that most need it.
                  Both components stay in the tree, unmounted, so either is one
                  line to restore. */}
              <LoginPromptModal />
              <Toaster
                position="top-right"
                /* The toast is the most-seen surface on the site after the
                   header — it fires on every add-to-cart — and it was still
                   dressed in colours from the old system: a PURPLE success
                   tick (#7c3aed), a foreign red (#c62828), pure white on a
                   warm-black that appears nowhere else, and a tan border.
                   On the relit shop that purple was the single most
                   off-palette pixel a customer saw, and they saw it constantly.
                   Ground, type and rule now come from the palette, and the tick
                   is the shop's own cerise. */
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#F3EBD9',
                    color: '#2E2418',
                    border: '1px solid #C3B189',
                    borderRadius: '2px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 20px rgba(42,31,36,0.10)',
                  },
                  success: { iconTheme: { primary: '#A21D48', secondary: '#F3EBD9' } },
                  error:   { iconTheme: { primary: '#94402E', secondary: '#F3EBD9' } },
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
