'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CartItem } from '@/types';
import { cartAPI } from '@/lib/api';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  count: number;
  total: number;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: number, quantity: number, size?: string, color?: string) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
  items: [],
  count: 0,
  total: 0,
  loading: false,
  fetchCart: async () => {},
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await cartAPI.get();
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = async (productId: number, quantity: number, size?: string, color?: string) => {
    await cartAPI.add({ product_id: productId, quantity, size, color });
    await fetchCart();
  };

  const updateItem = async (itemId: number, quantity: number) => {
    await cartAPI.update(itemId, quantity);
    await fetchCart();
  };

  const removeItem = async (itemId: number) => {
    await cartAPI.remove(itemId);
    await fetchCart();
  };

  const clearCart = async () => {
    await cartAPI.clear();
    setItems([]);
  };

  return (
    <CartContext.Provider value={{ items, count, total, loading, fetchCart, addItem, updateItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
