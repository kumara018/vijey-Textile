export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  is_admin: boolean;
  is_active: boolean;
  is_verified?: boolean;
  created_at: string;
}

export interface DeviceSession {
  id: number;
  device_name?: string;
  os_name?: string;
  browser_name?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
  location?: string;
  created_at: string;
  last_active_at?: string;
  is_current: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  compare_price?: number;
  category: string;
  fabric?: string;
  size_options: string[];
  colors: string[];
  images: string[];
  video_url?: string;
  video_orientation?: 'portrait' | 'landscape';
  fit?: string;
  material?: string;
  care_instructions?: string;
  stock: number;
  sku?: string;
  is_active: boolean;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_returnable: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  size?: string;
  color?: string;
  product: Product;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  product_id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  image?: string;
  subtotal: number;
}

export interface Order {
  id: number;
  order_number: string;
  items_snapshot: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_transaction_id?: string;
  shipping_address: ShippingAddress;
  tracking_number?: string;
  notes?: string;
  open_box_delivery: boolean;
  delivery_otp?: string;
  delivery_person_name?: string;
  delivery_person_phone?: string;
  // Shiprocket / courier tracking
  awb_code?: string;
  courier_name?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  status_location?: string;
  // Cancellation
  cancel_reason?: string;
  cancelled_by?: string;
  rto_pending?: boolean;   // cancelled after already being shipped — item still routing back to the shop
  delivered_at?: string;
  created_at: string;
}

export interface Review {
  id: number;
  user_id: number;
  product_id: number;
  rating: number;
  title?: string;
  comment?: string;
  created_at: string;
  user: User;
}

/**
 * A category name. A string, not a union of today's names: the list is edited
 * from the workroom now, so any union written here would be wrong the moment
 * an admin added one.
 */
export type Category = string;

/** One row of /api/products/categories — the list every menu reads. */
export interface ShopCategory {
  id: number;
  name: string;
  emoji: string | null;
  /** Short occasion line, e.g. "First celebrations". */
  eyebrow: string | null;
  /** The landing page's display line. */
  headline: string | null;
  /** One line under it. */
  description: string | null;
  /** False = hidden from the shop's menus. Only the admin list returns these. */
  is_active: boolean;
  sort_order: number;
  /** Every piece filed under it, on sale or not. */
  product_count: number;
  /** Pieces customers can actually buy right now. */
  live_product_count: number;
}

export interface ReturnRequest {
  id: number;
  order_id: number;
  user_id: number;
  request_type: 'return' | 'exchange';
  reason: string;
  description?: string;
  images: string[];
  status: string;
  admin_notes?: string;
  refund_id?: string;
  return_awb?: string;
  return_tracking_url?: string;
  pickup_otp?: string;
  replacement_awb?: string;
  replacement_tracking_url?: string;
  pickup_error?: string;
  replacement_error?: string;
  pickup_last_status?: string;
  product_id?: number;
  original_price?: number;
  new_product_id?: number;
  new_product?: Product;
  new_size?: string;
  new_color?: string;
  price_difference: number;
  price_diff_payment_id?: string;
  created_at: string;
}
