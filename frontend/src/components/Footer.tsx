'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Facebook, Instagram, MessageCircle, MapIcon } from 'lucide-react';
import { STORE, WHATSAPP_URL, MAIL_URL, CALL_URL } from '@/lib/config';

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SHOP_CATEGORIES = ['Baby Frocks', 'Chudithar', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear'];

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="bg-maroon-950 text-maroon-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand + Social */}
          <div>
            {/* Logo image in footer */}
            <Link href="/">
              <img
                src="/logo.svg"
                alt="Vijey Textile"
                className="h-14 w-auto mb-4 opacity-90 hover:opacity-100 transition-opacity brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-maroon-300 leading-relaxed mb-5">
              Luxury Baby, Kids &amp; Girls fashion — Chudithar, Frocks, Lehenga &amp; more in sizes 14–40. At Texvalley Gangapuram, Erode.
            </p>
            <div className="flex gap-2 flex-wrap">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors" title="WhatsApp">
                <MessageCircle size={16} />
              </a>
              <a href={STORE.facebook} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-maroon-800 hover:bg-blue-700 rounded-lg transition-colors" title="Facebook">
                <Facebook size={16} />
              </a>
              <a href={STORE.instagram} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-maroon-800 hover:bg-pink-600 rounded-lg transition-colors" title="Instagram">
                <Instagram size={16} />
              </a>
              <a href={STORE.twitter} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-maroon-800 hover:bg-gray-600 rounded-lg transition-colors" title="X (Twitter)">
                <XIcon size={16} />
              </a>
            </div>
          </div>

          {/* Shop — use router.push for reliable navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-maroon-300">
              {SHOP_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => router.push(`/products?category=${encodeURIComponent(cat)}`)}
                    className="hover:text-gold-400 transition-colors text-left"
                  >
                    {cat}
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => router.push('/products')} className="hover:text-gold-400 transition-colors">
                  All Products
                </button>
              </li>
            </ul>
          </div>

          {/* Help & Policies */}
          <div>
            <h4 className="font-semibold text-white mb-4">Help & Policies</h4>
            <ul className="space-y-2 text-sm text-maroon-300">
              <li><Link href="/orders"             className="hover:text-gold-400 transition-colors">My Orders</Link></li>
              <li><Link href="/support"             className="hover:text-gold-400 transition-colors">Contact Us</Link></li>
              <li><Link href="/support#size-guide"  className="hover:text-gold-400 transition-colors">Size Guide</Link></li>
              <li><Link href="/support#shipping"    className="hover:text-gold-400 transition-colors">Shipping Policy</Link></li>
              <li><Link href="/support#returns"     className="hover:text-gold-400 transition-colors">Return & Refund Policy</Link></li>
              <li><Link href="/cancellation"         className="hover:text-gold-400 transition-colors">Cancellation Policy</Link></li>
              <li><Link href="/terms"               className="hover:text-gold-400 transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/privacy"             className="hover:text-gold-400 transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-maroon-300">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="text-gold-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span>{STORE.shopNo},<br />{STORE.area},<br />{STORE.city}, {STORE.state}</span>
                  <a href={STORE.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-1.5 text-gold-400 hover:text-gold-300 font-medium text-xs transition-colors">
                    <MapIcon size={12} /> Open in Google Maps
                  </a>
                </div>
              </li>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-green-400 transition-colors">
                  <MessageCircle size={16} className="text-green-400 flex-shrink-0" />
                  WhatsApp: {STORE.phone1}
                </a>
              </li>
              <li>
                <a href={CALL_URL} className="flex items-center gap-2.5 hover:text-gold-400 transition-colors">
                  <Phone size={16} className="text-gold-400 flex-shrink-0" />
                  {STORE.phone1}
                </a>
              </li>
              <li>
                <a href={`tel:${STORE.phone2}`} className="flex items-center gap-2.5 hover:text-gold-400 transition-colors">
                  <Phone size={16} className="text-gold-400 flex-shrink-0" />
                  {STORE.phone2}
                </a>
              </li>
              <li>
                <a href={MAIL_URL} className="flex items-center gap-2.5 hover:text-gold-400 transition-colors">
                  <Mail size={16} className="text-gold-400 flex-shrink-0" />
                  {STORE.email}
                </a>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-maroon-900 rounded-lg text-xs text-maroon-300">
              <p className="font-medium text-white mb-1">Store Timings</p>
              <p>{STORE.weekdays}</p>
              <p>{STORE.weekend}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-maroon-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-maroon-400">
          <p>&copy; {new Date().getFullYear()} Vijey Textile. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy"      className="hover:text-gold-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms"        className="hover:text-gold-400 transition-colors">Terms of Service</Link>
            <Link href="/cancellation" className="hover:text-gold-400 transition-colors">Cancellation Policy</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-maroon-500">Secure payments:</span>
            <span className="text-maroon-300 font-medium">Visa • Mastercard • UPI • COD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
