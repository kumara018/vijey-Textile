'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import { isAuthRoute } from '@/lib/routes';

export default function NavbarWrapper() {
  const pathname = usePathname();
  // Auth pages are standalone — no navbar
  if (isAuthRoute(pathname)) return null;
  return <Navbar />;
}
