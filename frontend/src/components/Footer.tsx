'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, Mail, Instagram, MessageCircle, MapIcon } from 'lucide-react';
import { STORE, WHATSAPP_URL, WHATSAPP_URL2, MAIL_URL, CALL_URL, CALL_URL2 } from '@/lib/config';
import { LogoMark } from './Logo';

const SHOP_CATEGORIES = ['Baby Frocks', 'Chudithar', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear'];

export default function Footer() {
  const router = useRouter();

  return (
    <footer className="bg-maroon-900 text-maroon-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand + Social */}
          <div>
            <Link href="/" className="flex items-center gap-3 mb-4">
              <LogoMark size={40} className="text-white flex-shrink-0" />
              <div>
                <p style={{ fontSize: '15px', letterSpacing: '0.04em', fontWeight: 'bold' }}
                   className="text-white uppercase leading-tight">
                  Vijey Textile
                </p>
                <p className="text-maroon-300 font-semibold uppercase leading-tight mt-1"
                   style={{ fontSize: '9.5px', letterSpacing: '0.1em' }}>
                  Luxury Kid&apos;s &amp; Girls Clothing
                </p>
              </div>
            </Link>
            <p className="text-sm text-maroon-300 leading-relaxed mb-5">
              Luxury Baby, Kids &amp; Girls fashion — Chudithar, Frocks, Lehenga &amp; more in sizes 14–40. At Texvalley Gangapuram, Erode.
            </p>
            <div className="flex gap-2 flex-wrap">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors" title={`WhatsApp: ${STORE.phone1}`}>
                <MessageCircle size={16} />
              </a>
              <a href={WHATSAPP_URL2} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors" title={`WhatsApp: ${STORE.phone2}`}>
                <MessageCircle size={16} />
              </a>
              <a href={STORE.instagram} target="_blank" rel="noopener noreferrer"
                className="p-2 bg-maroon-800 hover:bg-pink-600 rounded-lg transition-colors" title="Instagram">
                <Instagram size={16} />
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
              <li><Link href="/support#returns"     className="hover:text-gold-400 transition-colors">Cancel, Return & Exchange FAQ</Link></li>
              <li><Link href="/cancellation"         className="hover:text-gold-400 transition-colors">Cancellation, Return & Exchange Policy</Link></li>
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
                <a href={WHATSAPP_URL2} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-green-400 transition-colors">
                  <MessageCircle size={16} className="text-green-400 flex-shrink-0" />
                  WhatsApp: {STORE.phone2}
                </a>
              </li>
              <li>
                <a href={CALL_URL} className="flex items-center gap-2.5 hover:text-gold-400 transition-colors">
                  <Phone size={16} className="text-gold-400 flex-shrink-0" />
                  {STORE.phone1}
                </a>
              </li>
              <li>
                <a href={CALL_URL2} className="flex items-center gap-2.5 hover:text-gold-400 transition-colors">
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
            <Link href="/cancellation" className="hover:text-gold-400 transition-colors">Exchange & Replacement Policy</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-maroon-500">Secure payments:</span>
            <span className="text-maroon-300 font-medium">Visa • Mastercard • UPI • Net Banking</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
