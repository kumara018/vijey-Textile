'use client';
import { usePathname } from 'next/navigation';
import Footer from './Footer';
import { isAuthRoute } from '@/lib/routes';

export default function FooterWrapper() {
  const pathname = usePathname();
  // Auth pages are standalone — no footer
  if (isAuthRoute(pathname)) return null;
  return <Footer />;
}
