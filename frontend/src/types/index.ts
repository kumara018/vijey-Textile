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
  created_at: string;
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

export type Category = 'Chudithar' | 'Tops' | 'Lehenga' | 'Crop Tops' | 'Party Wears';

export interface ReturnRequest {
  id: number;
  order_id: number;
  user_id: number;
  request_type: 'return' | 'exchange' | 'replace';
  reason: string;
  description?: string;
  images: string[];
  status: string;
  admin_notes?: string;
  refund_id?: string;
  created_at: string;
}
