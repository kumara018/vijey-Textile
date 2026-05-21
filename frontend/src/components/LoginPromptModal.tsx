'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, X, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { useLoginPrompt } from '@/context/LoginPromptContext';

export default function LoginPromptModal() {
  const { isOpen, message, close } = useLoginPrompt();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onClick={close}
    >
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-[fadeInUp_0.2s_ease]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-maroon-50 flex items-center justify-center">
            <ShoppingCart size={30} className="text-maroon-700" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          Sign in to continue
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          {message || 'Please sign in or create a free account to add items to your cart and place orders.'}
        </p>

        {/* Trust badges */}
        <div className="flex justify-center gap-4 mb-6">
          {['Fast Delivery', 'Easy Returns', 'Secure Payments'].map(b => (
            <div key={b} className="flex items-center gap-1 text-[10px] text-gray-500">
              <ShieldCheck size={11} className="text-green-500 flex-shrink-0" />
              {b}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <Link
            href="/auth/login"
            onClick={close}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-maroon-800 hover:bg-maroon-900 text-white font-semibold text-sm transition-colors"
          >
            <LogIn size={17} /> Sign In
          </Link>
          <Link
            href="/auth/register"
            onClick={close}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-maroon-800 text-maroon-800 hover:bg-maroon-50 font-semibold text-sm transition-colors"
          >
            <UserPlus size={17} /> Create Free Account
          </Link>
        </div>

        {/* Continue browsing */}
        <button
          onClick={close}
          className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Continue Browsing
        </button>
      </div>
    </div>
  );
}
