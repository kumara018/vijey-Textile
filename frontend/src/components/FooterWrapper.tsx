'use client';
import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function FooterWrapper() {
  const pathname = usePathname();
  // Auth pages are standalone — no footer
  if (pathname.startsWith('/auth')) return null;
  return <Footer />;
}
