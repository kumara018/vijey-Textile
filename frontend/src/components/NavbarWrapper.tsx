'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function NavbarWrapper() {
  const pathname = usePathname();
  // Auth pages are standalone — no navbar
  if (pathname.startsWith('/auth')) return null;
  return <Navbar />;
}
