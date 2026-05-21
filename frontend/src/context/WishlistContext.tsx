'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { wishlistAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface WishlistCtx {
  wishlistIds: number[];
  count: number;
  toggle: (productId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistCtx>({
  wishlistIds: [],
  count: 0,
  toggle: async () => {},
  refresh: async () => {},
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    if (!user) { setWishlistIds([]); return; }
    try {
      const res = await wishlistAPI.getIds();
      setWishlistIds(res.data || []);
    } catch {
      setWishlistIds([]);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = useCallback(async (productId: number) => {
    const isIn = wishlistIds.includes(productId);
    // Optimistic update
    setWishlistIds(prev =>
      isIn ? prev.filter(id => id !== productId) : [...prev, productId]
    );
    try {
      if (isIn) {
        await wishlistAPI.remove(productId);
        toast('Removed from wishlist', { icon: '💔' });
      } else {
        await wishlistAPI.add(productId);
        toast.success('Added to wishlist ❤️');
      }
    } catch {
      // Rollback on error
      setWishlistIds(prev =>
        isIn ? [...prev, productId] : prev.filter(id => id !== productId)
      );
      toast.error('Failed to update wishlist');
    }
  }, [wishlistIds]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, count: wishlistIds.length, toggle, refresh }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
