'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, ShoppingBag, Users, TrendingUp, Plus, Pencil,
  Trash2, X, AlertCircle, CheckCircle, Star, Upload, ImagePlus,
  Bell, Ban, RotateCcw,
} from 'lucide-react';
import api, { adminAPI, adminReturnsAPI, adminNotifAPI, supportAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['Baby Frocks', 'Chudithar', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear'];
const ORDER_STATUSES = ['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'];
const SIZE_OPTIONS   = ['14','16','18','20','22','24','26','28','30','32','34','36','38','40'];

interface DashData { total_products: number; active_products: number; total_users: number; total_orders: number; pending_orders: number; total_revenue: number; recent_orders: any[]; }

const CATEGORIES_WITH_HALF_SAREE = ['Baby Frocks', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear'];

// ── CS Interactions Tab ───────────────────────────────────────────────────────
function CSInteractionsTab() {
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [form, setForm] = useState({
    cs_name:'', cs_email:'', cs_phone:'',
    customer_name:'', customer_email:'', customer_phone:'', issue_summary:'',
  });

  const load = async () => {
    setLoading(true);
    try { const r = await supportAPI.listInteractions(); setInteractions(r.data); }
    catch { toast.error('Failed to load interactions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleLog = async () => {
    if (!form.cs_name.trim())            { toast.error('CS engineer name is required'); return; }
    if (!form.customer_name.trim())      { toast.error('Customer name is required'); return; }
    if (!form.customer_email.trim())     { toast.error('Customer email is required'); return; }
    setSaving(true);
    try {
      await supportAPI.createInteraction(form);
      toast.success('Interaction logged! Rating link sent to customer via email & WhatsApp ✅', { duration: 5000 });
      setShowForm(false);
      setForm({ cs_name:'', cs_email:'', cs_phone:'', customer_name:'', customer_email:'', customer_phone:'', issue_summary:'' });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to log interaction');
    } finally { setSaving(false); }
  };

  const rated    = interactions.filter(i => i.rating !== null);
  const avgRating = rated.length ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1) : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Star size={20} className="text-yellow-500 fill-yellow-400" />
        <h2 className="font-bold text-gray-800 text-lg">Customer Support Ratings</h2>
        {avgRating && (
          <span className="text-sm text-gray-500 ml-auto">
            Avg: <b className="text-maroon-700">{avgRating}/5</b> · {rated.length} rated / {interactions.length} total
          </span>
        )}
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 ml-auto">
          <Plus size={15} /> Log CS Interaction
        </button>
      </div>

      {/* Log Interaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-maroon-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Log Support Interaction</h3>
              <button onClick={() => setShowForm(false)} className="text-maroon-200 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                After saving, the customer will receive a <b>unique rating link</b> via email + WhatsApp. Only they can use it.
              </p>

              <p className="text-xs font-bold text-maroon-700 uppercase tracking-wide">CS Engineer Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input value={form.cs_name} onChange={e => setForm(f=>({...f, cs_name:e.target.value}))} placeholder="Engineer name" className="input-field" />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input value={form.cs_phone} onChange={e => setForm(f=>({...f, cs_phone:e.target.value}))} placeholder="9876543210" className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.cs_email} onChange={e => setForm(f=>({...f, cs_email:e.target.value}))} placeholder="cs@vijeytextile.com" className="input-field" />
              </div>

              <p className="text-xs font-bold text-maroon-700 uppercase tracking-wide mt-4">Customer Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input value={form.customer_name} onChange={e => setForm(f=>({...f, customer_name:e.target.value}))} placeholder="Customer name" className="input-field" />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input value={form.customer_phone} onChange={e => setForm(f=>({...f, customer_phone:e.target.value}))} placeholder="9876543210" className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={form.customer_email} onChange={e => setForm(f=>({...f, customer_email:e.target.value}))} placeholder="customer@email.com" className="input-field" />
              </div>
              <div>
                <label className="label">Issue / Topic (optional)</label>
                <input value={form.issue_summary} onChange={e => setForm(f=>({...f, issue_summary:e.target.value}))} placeholder="e.g. Order delivery query, size issue..." className="input-field" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handleLog} disabled={saving} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Sending...</> : '📨 Log & Send Rating Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-maroon-50">
              <tr className="text-left text-maroon-800 text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3">CS Engineer</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {loading ? Array(4).fill(0).map((_,i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              )) : interactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <div className="text-3xl mb-2">💬</div>
                  No interactions logged yet. Click "Log CS Interaction" to start.
                </td></tr>
              ) : interactions.map(i => (
                <tr key={i.id} className="hover:bg-orange-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{i.cs_name}</p>
                    {i.cs_phone && <p className="text-xs text-gray-500">{i.cs_phone}</p>}
                    {i.cs_email && <p className="text-xs text-gray-400">{i.cs_email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{i.customer_name}</p>
                    <p className="text-xs text-gray-500">{i.customer_email}</p>
                    {i.customer_phone && <p className="text-xs text-gray-400">{i.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px]">
                    <p className="line-clamp-2">{i.issue_summary || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {i.rating ? (
                      <div>
                        <div className="flex gap-0.5 mb-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={13} fill={s<=i.rating?'#facc15':'none'} className={s<=i.rating?'text-yellow-400':'text-gray-200'} />
                          ))}
                        </div>
                        <p className={`text-xs font-semibold ${i.rating>=4?'text-green-600':i.rating===3?'text-orange-500':'text-red-500'}`}>{i.rating}/5</p>
                        {i.rating_comment && <p className="text-xs text-gray-500 mt-0.5 italic line-clamp-1">"{i.rating_comment}"</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">⏳ Awaiting</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(i.created_at).toLocaleDateString('en-IN')}
                    {i.rated_at && <p className="text-green-600">Rated: {new Date(i.rated_at).toLocaleDateString('en-IN')}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const emptyProduct = {
  name:'', description:'', price:'', compare_price:'', category:'',
  fabric:'', size_options:[] as string[], colors:[] as string[],
  images:[] as string[], stock:'', is_featured:false, is_new_arrival:false, is_returnable:true,
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  type TabKey = 'dash'|'products'|'orders'|'cancellations'|'users'|'ratings'|'returns'|'admins';
  const [tab, setTab] = useState<TabKey>('dash');

  // Restore last-used tab from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('admin_tab') as TabKey | null;
    const valid: TabKey[] = ['dash','products','orders','cancellations','users','ratings','returns','admins'];
    if (saved && valid.includes(saved)) setTab(saved);
  }, []);

  // Notifications state
  const [notifications, setNotifications]   = useState<any[]>([]);
  const [notifOpen, setNotifOpen]           = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadNotifications = async () => {
    try { const r = await adminNotifAPI.getAll(); setNotifications(r.data); }
    catch {}
  };

  const markAllRead = async () => {
    try {
      await adminNotifAPI.readAll();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };
  const [dash, setDash] = useState<DashData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [supportRatings, setSupportRatings] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [expandedReturn, setExpandedReturn] = useState<number | null>(null);
  const [returnUpdateForm, setReturnUpdateForm] = useState<Record<number, { status: string; admin_notes: string }>>({});
  const [savingReturn, setSavingReturn] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [formErrors, setFormErrors] = useState<any>({});
  const [colorInput, setColorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Order shipping details modal
  const [shipModal, setShipModal] = useState<any>(null); // holds the order being shipped
  const [shipForm, setShipForm] = useState({
    status: '', awb_code: '', courier_name: '', tracking_url: '',
    estimated_delivery: '', status_location: '',
    delivery_person_name: '', delivery_person_phone: '',
  });
  const [shipSaving, setShipSaving] = useState(false);
  const [creatingDelhivery, setCreatingDelhivery] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;            // wait for localStorage restore
    if (!user) return;                  // middleware already blocked non-users
    if (!user.is_admin) { router.push('/'); return; }  // block non-admins
    loadDash();
    loadNotifications();
  }, [user, authLoading]);

  const loadDash = async () => {
    try {
      const res = await adminAPI.dashboard();
      setDash(res.data);
    } catch {} finally { setLoading(false); }
  };

  const loadProducts = async () => {
    setLoading(true);
    try { const res = await adminAPI.getProducts(); setProducts(res.data); }
    catch {} finally { setLoading(false); }
  };

  const loadOrders = async () => {
    setLoading(true);
    try { const res = await adminAPI.getOrders(); setOrders(res.data); }
    catch {} finally { setLoading(false); }
  };

  const loadUsers = async () => {
    setLoading(true);
    try { const res = await adminAPI.getUsers(); setUsers(res.data); }
    catch {} finally { setLoading(false); }
  };

  const loadSupportRatings = async () => {
    setLoading(true);
    try { const res = await adminAPI.getSupportRatings(); setSupportRatings(res.data); }
    catch {} finally { setLoading(false); }
  };

  const loadReturns = async () => {
    setLoading(true);
    try { const res = await adminReturnsAPI.getAll(); setReturns(res.data); }
    catch {} finally { setLoading(false); }
  };

  const handleToggleFeatured = async (p: any) => {
    try {
      await adminAPI.updateProduct(p.id, { is_featured: !p.is_featured });
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_featured: !x.is_featured } : x));
      toast.success(p.is_featured ? `Removed "${p.name}" from Featured` : `"${p.name}" is now Featured ⭐`);
    } catch {
      toast.error('Failed to update featured status');
    }
  };

  const loadAdmins = async () => {
    try {
      const res = await api.get('/api/admin/admins');
      setAdmins(res.data);
    } catch { toast.error('Failed to load admin accounts'); }
  };

  const grantAdmin = async () => {
    if (!newAdminEmail.trim()) return toast.error('Enter an email address');
    setAdminActionLoading(true);
    try {
      const res = await api.post('/api/admin/users/grant-admin', { email: newAdminEmail.trim().toLowerCase() });
      toast.success(res.data.message);
      setNewAdminEmail('');
      loadAdmins();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to grant admin access');
    } finally { setAdminActionLoading(false); }
  };

  const revokeAdmin = async (userId: number, email: string) => {
    if (!confirm(`Remove admin access from ${email}?\n\nThey will receive an email notification and be downgraded to a regular customer account.`)) return;
    setAdminActionLoading(true);
    try {
      await api.patch(`/api/admin/users/${userId}/revoke-admin`);
      toast.success(`✅ Admin access removed from ${email} — notification email sent`);
      loadAdmins();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to remove admin access');
    } finally { setAdminActionLoading(false); }
  };

  useEffect(() => {
    if (tab === 'dash') loadDash();
    if (tab === 'products') loadProducts();
    if (tab === 'orders') loadOrders();
    if (tab === 'users') loadUsers();
    if (tab === 'ratings') loadSupportRatings();
    if (tab === 'returns') loadReturns();
    if (tab === 'admins') loadAdmins();
  }, [tab]);

  const validateForm = () => {
    const e: any = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.price || Number(form.price) <= 0) e.price = 'Price must be greater than 0';
    if (!form.category) e.category = 'Category is required';
    const stock = Number(form.stock);
    if (form.stock === '' || isNaN(stock) || stock < 0) e.stock = 'Stock must be 0 or more';
    if (form.compare_price && Number(form.compare_price) <= 0) e.compare_price = 'Compare price must be greater than 0';
    if (form.compare_price && Number(form.compare_price) <= Number(form.price)) e.compare_price = 'Compare price must be higher than selling price';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyProduct });
    setFormErrors({});
    setColorInput('');
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description, price: String(p.price),
      compare_price: p.compare_price ? String(p.compare_price) : '',
      category: p.category, fabric: p.fabric || '',
      size_options: p.size_options || [], colors: p.colors || [],
      images: p.images || [], stock: String(p.stock),
      is_featured: p.is_featured, is_new_arrival: p.is_new_arrival || false,
      is_returnable: p.is_returnable !== false,
    });
    setFormErrors({});
    setColorInput('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!validateForm()) { toast.error('Please fix all errors before saving'); return; }
    setSaving(true);
    try {
      const data: any = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        category: form.category,
        fabric: form.fabric.trim() || null,
        size_options: form.size_options,
        colors: form.colors,
        images: form.images,
        stock: Number(form.stock),
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
        is_returnable: form.is_returnable,
      };
      if (editing) {
        await adminAPI.updateProduct(editing.id, data);
        toast.success('Product updated successfully!');
      } else {
        await adminAPI.createProduct(data);
        toast.success('Product added successfully!');
      }
      setShowForm(false);
      loadProducts();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map((d: any) => d.msg).join('. ') : (detail || 'Failed to save product'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Deactivate product "${name}"?`)) return;
    try {
      await adminAPI.deleteProduct(id);
      toast.success('Product deactivated');
      loadProducts();
    } catch { toast.error('Failed to deactivate product'); }
  };

  const handleOrderStatus = async (id: number, status: string) => {
    try {
      const res = await adminAPI.updateOrderStatus(id, { status });
      if (status === 'out_for_delivery' && res.data?.delivery_otp) {
        toast.success(`Status updated! Delivery OTP: ${res.data.delivery_otp}`, { duration: 8000 });
      } else {
        toast.success('Order status updated — customer notified');
      }
      loadOrders();
    } catch { toast.error('Failed to update status'); }
  };

  const openShipModal = (order: any) => {
    setShipForm({
      status:               order.status,
      awb_code:             order.awb_code || '',
      courier_name:         order.courier_name || '',
      tracking_url:         order.tracking_url || '',
      estimated_delivery:   order.estimated_delivery || '',
      status_location:      order.status_location || '',
      delivery_person_name: order.delivery_person_name || '',
      delivery_person_phone:order.delivery_person_phone || '',
    });
    setShipModal(order);
  };


  const [initiatingRefund, setInitiatingRefund]   = useState<number | null>(null);
  const [resettingRefund,  setResettingRefund]    = useState<number | null>(null);

  const handleInitiateRefund = async (orderId: number, orderNum: string, total: number) => {
    if (!confirm(`Initiate Razorpay refund for order ${orderNum}?\n\n₹${total} will be refunded to the customer's original payment method.\n\nThe customer will receive an email + WhatsApp: "Refund Initiated".\nOnce Razorpay processes it (5–7 days), they will receive a "Refund Credited" notification automatically.`)) return;
    setInitiatingRefund(orderId);
    try {
      await adminAPI.initiateRefund(orderId);
      toast.success(`✅ Refund initiated for ${orderNum} — customer notified!`, { duration: 6000 });
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to initiate refund');
    } finally { setInitiatingRefund(null); }
  };

  const handleResetToRefundInitiated = async (orderId: number, orderNum: string) => {
    if (!confirm(
      `Reset ${orderNum} back to "Refund Initiated"?\n\n` +
      `Use this only if the status was incorrectly set to "Refunded" before Razorpay confirmed it.\n` +
      `The Razorpay webhook will automatically move it back to "Refunded" once payment is confirmed.`
    )) return;
    setResettingRefund(orderId);
    try {
      await adminAPI.resetToRefundInitiated(orderId);
      toast.success(`✅ ${orderNum} reset to "Refund Initiated" — webhook will update when Razorpay confirms`);
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to reset refund status');
    } finally { setResettingRefund(null); }
  };

  const handleCreateDelhivery = async (orderId: number, orderNum: string) => {
    if (!confirm(`Create Delhivery shipment for ${orderNum}? This will generate an AWB and notify the customer.`)) return;
    setCreatingDelhivery(orderId);
    try {
      const res = await adminAPI.createDelhiveryShipment(orderId);
      toast.success(`✅ Delhivery AWB: ${res.data.awb_code} — Customer notified!`, { duration: 8000 });
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Delhivery shipment failed — check API token & pickup location');
    } finally { setCreatingDelhivery(null); }
  };

  const handleShipSave = async () => {
    if (!shipModal) return;
    setShipSaving(true);
    try {
      const payload: any = { ...shipForm };
      // Remove empty strings
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
      const res = await adminAPI.updateOrderStatus(shipModal.id, payload);
      if (shipForm.status === 'out_for_delivery' && res.data?.delivery_otp) {
        toast.success(`Updated! Delivery OTP: ${res.data.delivery_otp}`, { duration: 8000 });
      } else {
        toast.success('Order updated — customer notified via Email & WhatsApp');
      }
      setShipModal(null);
      loadOrders();
    } catch { toast.error('Failed to update order'); } finally { setShipSaving(false); }
  };

  const toggleSize = (s: string) => {
    setForm(f => ({
      ...f,
      size_options: f.size_options.includes(s)
        ? f.size_options.filter(x => x !== s)
        : [...f.size_options, s],
    }));
  };

  const addColor = () => {
    const c = colorInput.trim();
    if (!c) return;
    if (!form.colors.includes(c)) setForm(f => ({ ...f, colors: [...f.colors, c] }));
    setColorInput('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingImage(true);
    try {
      const res = await adminAPI.uploadImage(formData);
      const url: string = res.data.url;
      setForm(f => ({ ...f, images: [...f.images, url] }));
      toast.success('Image uploaded successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const F = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  if (!user?.is_admin) return null;

  const handleReturnStatusUpdate = async (returnId: number) => {
    const form = returnUpdateForm[returnId];
    if (!form?.status) { toast.error('Select a status'); return; }
    setSavingReturn(returnId);
    try {
      await adminReturnsAPI.updateStatus(returnId, { status: form.status, admin_notes: form.admin_notes || undefined });
      toast.success('Return request updated — customer notified');
      loadReturns();
      setExpandedReturn(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update return status');
    } finally { setSavingReturn(null); }
  };

  const TABS = [
    { key: 'dash',          label: 'Dashboard'        },
    { key: 'products',      label: 'Products'          },
    { key: 'orders',        label: 'Orders'            },
    { key: 'cancellations', label: 'Cancellations'     },
    { key: 'returns',       label: 'Returns & Exchange'},
    { key: 'users',         label: 'Customers'         },
    { key: 'ratings',       label: 'Support Ratings'   },
    { key: 'admins',        label: '🔐 Admin Accounts' },
  ] as const;

  const NOTIF_ICONS: Record<string, string> = {
    cancellation: '🚫',
    return:       '↩️',
    exchange:     '🔄',
    replace:      '📦',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="section-title">Admin Panel</h1>
          <p className="text-sm text-gray-500">Vijey Textile Store Management</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'products' && (
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Add Product
            </button>
          )}

          {/* ── Notification Bell ── */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifications(); }}
              className="relative p-2.5 rounded-xl bg-maroon-50 hover:bg-maroon-100 border border-maroon-200 transition-colors"
            >
              <Bell size={20} className="text-maroon-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-orange-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-maroon-800">
                  <span className="text-white font-bold text-sm">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-maroon-200 hover:text-white text-xs">
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} className="text-maroon-200 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-orange-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">No notifications yet</div>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) { await adminNotifAPI.readOne(n.id); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)); }
                        setNotifOpen(false);
                        const dest = n.type === 'cancellation' ? 'cancellations' : 'returns';
                        setTab(dest as TabKey);
                        localStorage.setItem('admin_tab', dest);
                        if (dest === 'cancellations') loadOrders();
                        else loadReturns();
                      }}
                      className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-orange-50 transition-colors ${!n.is_read ? 'bg-rose-50' : ''}`}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">{NOTIF_ICONS[n.type] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold text-gray-900 ${!n.is_read ? 'text-maroon-800' : ''}`}>{n.title}</p>
                        <p className="text-xs text-gray-500 truncate">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}
                        </p>
                      </div>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-orange-200 mb-6 gap-1 overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const isCancel = key === 'cancellations';
          const isReturn = key === 'returns';
          const badge = isCancel
            ? notifications.filter(n => n.type === 'cancellation' && !n.is_read).length
            : isReturn
            ? notifications.filter(n => ['return','exchange','replace'].includes(n.type) && !n.is_read).length
            : 0;
          return (
            <button
              key={key}
              onClick={() => { setTab(key as TabKey); localStorage.setItem('admin_tab', key); if(key==='cancellations') loadOrders(); if(key==='returns') loadReturns(); }}
              className={`relative px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === key ? 'border-maroon-800 text-maroon-800 bg-maroon-50' : 'border-transparent text-gray-500 hover:text-maroon-700'}`}
            >
              {label}
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dashboard */}
      {tab === 'dash' && dash && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Active Products', value: dash.active_products, icon: Package,     color: 'bg-purple-50 text-purple-700' },
              { label: 'Total Customers', value: dash.total_users,     icon: Users,       color: 'bg-blue-50 text-blue-700' },
              { label: 'Total Orders',    value: dash.total_orders,    icon: ShoppingBag, color: 'bg-orange-50 text-orange-700' },
              { label: 'Pending Orders',  value: dash.pending_orders,  icon: Package,     color: 'bg-yellow-50 text-yellow-700' },
              { label: 'Total Revenue',   value: `₹${dash.total_revenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-50 text-green-700' },
              { label: 'All Products',    value: dash.total_products,  icon: Package,     color: 'bg-maroon-50 text-maroon-700' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-5 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-maroon-900 mb-4">Recent Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-orange-100">
                  <th className="pb-3 pr-4">Order #</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Date</th>
                </tr></thead>
                <tbody className="divide-y divide-orange-50">
                  {dash.recent_orders.map((o) => (
                    <tr key={o.id} className="hover:bg-orange-50">
                      <td className="py-3 pr-4 font-mono font-medium text-maroon-800">{o.order_number}</td>
                      <td className="py-3 pr-4 font-semibold">₹{o.total.toLocaleString()}</td>
                      <td className="py-3 pr-4"><span className="capitalize badge badge-info">{o.status}</span></td>
                      <td className="py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      {tab === 'products' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-maroon-50">
                <tr className="text-left text-maroon-800 text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3 w-8">ID</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                )) : products.map((p) => {
                  const imgSrc = p.images?.[0]
                    ? (p.images[0].startsWith('http') ? p.images[0] : `${process.env.NEXT_PUBLIC_API_URL}${p.images[0]}`)
                    : null;
                  const catEmoji: Record<string,string> = {
                    'Baby Frocks':'👶','Chudithar':'👘','Frocks':'👗',
                    'Western Dresses':'👒','Lehenga':'💃','Party Wear':'✨',
                  };
                  return (
                  <tr key={p.id} className={`hover:bg-orange-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                    {/* ID */}
                    <td className="px-4 py-3 text-xs font-mono text-gray-400 whitespace-nowrap">#{p.id}</td>

                    {/* Image + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-orange-50 to-pink-50 flex-shrink-0 flex items-center justify-center border border-orange-100">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span
                            className="text-xl"
                            style={{ display: imgSrc ? 'none' : 'flex' }}
                          >
                            {catEmoji[p.category] || '👕'}
                          </span>
                        </div>
                        {/* Name + badges */}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 line-clamp-1 text-sm">{p.name}</p>
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {p.is_featured    && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Featured</span>}
                            {p.is_new_arrival && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">New Arrival</span>}
                            {!p.is_active     && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Inactive</span>}
                            {p.is_returnable === false && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">Non-Returnable</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-600 text-sm">{p.category}</td>
                    <td className="px-4 py-3 font-semibold text-maroon-900 text-sm">₹{p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-sm ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-orange-600' : 'text-green-600'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.is_active ? 'badge-success' : 'badge-danger'}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleFeatured(p)}
                          className={`p-1.5 rounded-lg transition-colors ${p.is_featured ? 'text-amber-500 hover:bg-amber-100' : 'text-gray-300 hover:bg-gray-100 hover:text-amber-400'}`}
                          title={p.is_featured ? 'Remove from Featured' : 'Mark as Featured'}
                        >
                          <Star size={15} fill={p.is_featured ? 'currentColor' : 'none'} />
                        </button>
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-maroon-100 rounded-lg text-maroon-700 transition-colors" title={`Edit #${p.id}`}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors" title="Deactivate">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-maroon-50">
                <tr className="text-left text-maroon-800 text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                )) : orders.map((o) => (
                  <tr key={o.id} className="hover:bg-orange-50">
                    <td className="px-4 py-3 font-mono font-medium text-maroon-800 text-xs">{o.order_number}</td>
                    <td className="px-4 py-3 text-gray-700">{(o.shipping_address as any)?.full_name}</td>
                    <td className="px-4 py-3 font-bold text-maroon-900">₹{o.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-gray-700">
                          {o.payment_method === 'razorpay' ? 'Razorpay' : o.payment_method === 'upi' ? 'UPI' : 'COD'}
                        </span>
                        {o.payment_status === 'paid' && <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded w-fit">✅ PAID</span>}
                        {o.payment_status === 'refund_initiated' && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded w-fit">🔄 REFUND INITIATED</span>}
                        {o.payment_status === 'refunded' && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded w-fit">💜 REFUNDED</span>}
                        {o.payment_status === 'pending' && <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded w-fit">⏳ PENDING</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.payment_transaction_id ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 max-w-[120px] truncate" title={o.payment_transaction_id}>
                            {o.payment_transaction_id}
                          </span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(o.payment_transaction_id); toast.success('Copied!'); }}
                            className="text-gray-400 hover:text-maroon-700 flex-shrink-0"
                            title="Copy transaction ID"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">{o.payment_method === 'cod' ? 'COD' : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize badge badge-info text-xs">{o.status}</span>
                      {o.status_location && <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[120px]">📍 {o.status_location}</p>}
                      {o.awb_code && <p className="text-[10px] font-mono text-maroon-600 mt-0.5">{o.awb_code}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <select
                          value={o.status}
                          onChange={(e) => handleOrderStatus(o.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-maroon-500"
                        >
                          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => openShipModal(o)}
                          className="text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg px-2 py-1.5 transition-colors whitespace-nowrap"
                          title="Set AWB, location, delivery person"
                        >
                          📦 Ship Details
                        </button>
                        {!o.awb_code && o.status !== 'cancelled' && o.status !== 'delivered' && (
                          <button
                            onClick={() => handleCreateDelhivery(o.id, o.order_number)}
                            disabled={creatingDelhivery === o.id}
                            className="text-xs bg-green-50 border border-green-300 text-green-700 hover:bg-green-100 rounded-lg px-2 py-1.5 transition-colors whitespace-nowrap disabled:opacity-60"
                            title="Auto-create shipment on Delhivery"
                          >
                            {creatingDelhivery === o.id ? '⏳...' : '🚚 Delhivery'}
                          </button>
                        )}
                        {o.awb_code && (
                          <a href={o.tracking_url || `https://www.delhivery.com/track/package/${o.awb_code}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 rounded-lg px-2 py-1.5 transition-colors whitespace-nowrap"
                            title={`Track AWB: ${o.awb_code}`}
                          >
                            📍 Track
                          </a>
                        )}
                        {/* Initiate Refund — show only for cancelled, online-paid, not yet refunded */}
                        {o.status === 'cancelled' && o.payment_method !== 'cod' && o.payment_status === 'paid' && (
                          <button
                            onClick={() => handleInitiateRefund(o.id, o.order_number, o.total)}
                            disabled={initiatingRefund === o.id}
                            className="text-xs bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100 rounded-lg px-2 py-1.5 transition-colors whitespace-nowrap disabled:opacity-60"
                            title="Initiate Razorpay refund — customer gets email + WhatsApp notification"
                          >
                            {initiatingRefund === o.id ? '⏳...' : '💸 Initiate Refund'}
                          </button>
                        )}
                        {/* Refund Initiated badge — auto-updates to Refunded via Razorpay webhook */}
                        {o.status === 'cancelled' && o.payment_method !== 'cod' && o.payment_status === 'refund_initiated' && (
                          <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-600 rounded-lg px-2 py-1.5 font-medium whitespace-nowrap" title="Razorpay is processing this refund. Status will automatically update to Refunded and customer will be notified once credited (5–7 business days).">
                            🔄 Refund Initiated
                          </span>
                        )}
                        {/* Refunded badge — with reset option in case status was set prematurely */}
                        {o.status === 'cancelled' && o.payment_method !== 'cod' && o.payment_status === 'refunded' && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 rounded-lg px-2 py-1.5 font-medium whitespace-nowrap" title="Razorpay has confirmed this refund. Customer's bank will credit within 1–5 business days.">
                              ✅ Refunded
                            </span>
                            <button
                              onClick={() => handleResetToRefundInitiated(o.id, o.order_number)}
                              disabled={resettingRefund === o.id}
                              className="text-[9px] text-orange-500 hover:text-orange-700 hover:underline text-left disabled:opacity-50 whitespace-nowrap"
                              title="If this was set prematurely — reset it so the Razorpay webhook can fire correctly"
                            >
                              {resettingRefund === o.id ? '⏳ Resetting...' : '↺ Set to Refund Initiated'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-maroon-50">
                <tr className="text-left text-maroon-800 text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Admin Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                {loading ? null : users.map((u) => (
                  <tr key={u.id} className="hover:bg-orange-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">#{u.id}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-success' : 'badge-danger'}>{u.is_active ? 'Active' : 'Blocked'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          if (!confirm(`Grant admin access to ${u.full_name} (${u.email})?`)) return;
                          try {
                            const res = await api.post('/api/admin/users/grant-admin', { email: u.email });
                            toast.success(res.data.message);
                            loadUsers();
                          } catch (err: any) {
                            toast.error(err?.response?.data?.detail || 'Failed to grant admin access');
                          }
                        }}
                        className="text-xs bg-maroon-100 hover:bg-maroon-200 text-maroon-800 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🔐 Make Admin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Support Ratings — CS Interactions */}
      {tab === 'ratings' && (
        <CSInteractionsTab />
      )}

      {/* Cancellations */}
      {tab === 'cancellations' && (
        <div>
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <Ban size={20} className="text-red-500" />
            <h2 className="font-bold text-gray-800 text-lg">Cancelled Orders</h2>
            <button onClick={loadOrders} className="ml-auto text-xs text-maroon-700 hover:underline">Refresh</button>
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : (
            (() => {
              const cancelled = orders.filter(o => o.status === 'cancelled');
              if (!cancelled.length) return <div className="text-center py-12 text-gray-400">No cancelled orders</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-orange-100 text-xs uppercase tracking-wide">
                        <th className="pb-3 pr-4">Order #</th>
                        <th className="pb-3 pr-4">Customer</th>
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Amount</th>
                        <th className="pb-3 pr-4">Payment</th>
                        <th className="pb-3 pr-4">Reason</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50">
                      {cancelled.map(o => {
                        const addr = o.shipping_address || {};
                        const needsRefund = o.payment_method !== 'cod' && o.payment_status === 'paid';
                        const refundDone  = ['refund_initiated','refunded'].includes(o.payment_status);
                        return (
                          <tr key={o.id} className="hover:bg-rose-50 transition-colors">
                            <td className="py-3 pr-4 font-mono font-semibold text-maroon-800">{o.order_number}</td>
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-900">{addr.full_name || '—'}</p>
                              <p className="text-xs text-gray-400">{addr.phone}</p>
                            </td>
                            <td className="py-3 pr-4 text-gray-500 text-xs">
                              {new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                            </td>
                            <td className="py-3 pr-4 font-bold text-gray-900">₹{o.total?.toLocaleString()}</td>
                            <td className="py-3 pr-4">
                              <span className="text-xs uppercase font-semibold text-gray-600">{o.payment_method}</span>
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${refundDone ? 'bg-purple-100 text-purple-700' : needsRefund ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {o.payment_status?.replace(/_/g,' ')}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-500 text-xs max-w-[180px] truncate">{o.cancel_reason || '—'}</td>
                            <td className="py-3">
                              {needsRefund && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await adminAPI.initiateRefund(o.id);
                                      toast.success(`Refund initiated for ${o.order_number}`);
                                      loadOrders();
                                    } catch (e: any) {
                                      toast.error(e.response?.data?.detail || 'Refund failed');
                                    }
                                  }}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                                >
                                  <RotateCcw size={12} /> Initiate Refund
                                </button>
                              )}
                              {refundDone && (
                                <span className="flex items-center gap-1 text-xs text-purple-700 font-semibold">
                                  <CheckCircle size={13} /> {o.payment_status === 'refunded' ? 'Refunded' : 'Refund Initiated'}
                                </span>
                              )}
                              {o.payment_method === 'cod' && (
                                <span className="text-xs text-gray-400">COD — no refund needed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Returns */}
      {tab === 'returns' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-bold text-gray-800 text-lg">Return / Exchange / Replace Requests</h2>
            {returns.length > 0 && (
              <span className="ml-auto text-sm text-gray-500">{returns.length} total</span>
            )}
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-maroon-50">
                  <tr className="text-left text-maroon-800 text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                  )) : returns.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No return requests yet</td></tr>
                  ) : returns.map((r) => {
                    const typeBadge: Record<string,string> = {
                      return:   'bg-red-100 text-red-700 border-red-200',
                      exchange: 'bg-blue-100 text-blue-700 border-blue-200',
                      replace:  'bg-green-100 text-green-700 border-green-200',
                    };
                    const statusBadge: Record<string,string> = {
                      pending:             'bg-yellow-100 text-yellow-700',
                      under_review:        'bg-blue-100 text-blue-700',
                      approved:            'bg-green-100 text-green-700',
                      rejected:            'bg-red-100 text-red-700',
                      pickup_scheduled:    'bg-purple-100 text-purple-700',
                      picked_up:           'bg-cyan-100 text-cyan-700',
                      processing:          'bg-indigo-100 text-indigo-700',
                      refund_initiated:    'bg-green-100 text-green-700',
                      replacement_shipped: 'bg-purple-100 text-purple-700',
                      completed:           'bg-gray-100 text-gray-700',
                    };
                    const typeLabel: Record<string,string> = { return:'Return & Refund', exchange:'Exchange', replace:'Replacement' };
                    const isExpanded = expandedReturn === r.id;
                    return (
                      <>
                        <tr key={r.id} className="hover:bg-orange-50 cursor-pointer" onClick={() => {
                          setExpandedReturn(isExpanded ? null : r.id);
                          if (!returnUpdateForm[r.id]) {
                            setReturnUpdateForm(prev => ({ ...prev, [r.id]: { status: r.status, admin_notes: r.admin_notes || '' } }));
                          }
                        }}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">#{r.id}</td>
                          <td className="px-4 py-3 font-mono font-medium text-maroon-800 text-xs">{r.order_id}</td>
                          <td className="px-4 py-3 text-gray-700 text-xs">{r.user_id}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeBadge[r.request_type] || 'bg-gray-100 text-gray-600'}`}>
                              {typeLabel[r.request_type] || r.request_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs max-w-[120px] truncate">{r.reason}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {r.status.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-xs text-maroon-700 hover:text-maroon-900 font-medium">
                              {isExpanded ? 'Collapse' : 'Manage'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${r.id}-expand`}>
                            <td colSpan={8} className="px-4 py-4 bg-orange-50 border-b border-orange-100">
                              <div className="max-w-2xl space-y-4">
                                {/* Photos */}
                                {r.images && r.images.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Customer Photos</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {r.images.map((url: string, i: number) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                          <img src={url} alt={`Return photo ${i+1}`} className="w-16 h-16 object-cover rounded-lg border-2 border-orange-200 hover:border-maroon-400 transition-colors" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Description */}
                                {r.description && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Customer Description</p>
                                    <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">{r.description}</p>
                                  </div>
                                )}

                                {/* Current admin notes */}
                                {r.admin_notes && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Previous Admin Note</p>
                                    <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{r.admin_notes}</p>
                                  </div>
                                )}

                                {/* Update form */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="label">Update Status</label>
                                    <select
                                      value={returnUpdateForm[r.id]?.status || r.status}
                                      onChange={e => setReturnUpdateForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], status: e.target.value } }))}
                                      className="input-field text-sm"
                                    >
                                      {['pending','under_review','approved','rejected','pickup_scheduled','picked_up','processing','refund_initiated','replacement_shipped','completed'].map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label">Admin Notes (shown to customer)</label>
                                    <input
                                      value={returnUpdateForm[r.id]?.admin_notes || ''}
                                      onChange={e => setReturnUpdateForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], admin_notes: e.target.value } }))}
                                      placeholder="Optional note for the customer..."
                                      className="input-field text-sm"
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleReturnStatusUpdate(r.id)}
                                  disabled={savingReturn === r.id}
                                  className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60"
                                >
                                  {savingReturn === r.id ? <><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Saving...</> : 'Update Status & Notify Customer'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Accounts Tab */}
      {tab === 'admins' && (
        <div className="space-y-6">
          {/* Grant Admin Access */}
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
            <h2 className="text-lg font-bold text-maroon-900 mb-1">Grant Admin Access</h2>
            <p className="text-sm text-gray-500 mb-4">
              The person must already have a registered account on vijeytextile.com. Enter their email to promote them to admin.
            </p>
            <div className="flex gap-3 flex-wrap">
              <input
                type="email"
                value={newAdminEmail}
                onChange={e => setNewAdminEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && grantAdmin()}
                placeholder="Enter registered email address..."
                className="input-field flex-1 min-w-[260px]"
              />
              <button
                onClick={grantAdmin}
                disabled={adminActionLoading}
                className="btn-primary px-6 disabled:opacity-60"
              >
                {adminActionLoading ? 'Adding...' : '+ Grant Admin Access'}
              </button>
            </div>
          </div>

          {/* Current Admins List */}
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-orange-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-maroon-900">Current Admin Accounts ({admins.length})</h2>
              <button onClick={loadAdmins} className="text-xs text-maroon-600 hover:underline">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-maroon-50 text-maroon-800 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-left">Role</th>
                    <th className="px-5 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No admin accounts found</td></tr>
                  )}
                  {admins.map((a: any) => (
                    <tr key={a.id} className="border-t border-gray-50 hover:bg-orange-50/30">
                      <td className="px-5 py-4 font-semibold text-gray-900">{a.full_name}</td>
                      <td className="px-5 py-4 text-gray-600">{a.email}</td>
                      <td className="px-5 py-4 text-gray-600">{a.phone}</td>
                      <td className="px-5 py-4">
                        {a.is_primary
                          ? <span className="px-2 py-1 bg-maroon-100 text-maroon-800 rounded-full text-xs font-bold">👑 Primary Admin</span>
                          : <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">🔐 Admin</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        {a.is_primary
                          ? <span className="text-xs text-gray-400">Protected</span>
                          : user?.email === 'kumaragurubaran27102@gmail.com'
                          ? (
                            <button
                              onClick={() => revokeAdmin(a.id, a.email)}
                              disabled={adminActionLoading}
                              className="text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-800 font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              🗑️ Remove Admin
                            </button>
                          )
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">ℹ️ How it works</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>All admin accounts have full dashboard access — same as the primary admin</li>
              <li>The person must first register on vijeytextile.com before you can grant access</li>
              <li>The primary admin account (<strong>kumaragurubaran27102@gmail.com</strong>) cannot be revoked</li>
              <li>Revoked accounts return to regular customer accounts automatically</li>
            </ul>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-orange-100">
              <h2 className="font-bold text-xl text-maroon-900">{editing ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="label">Product Name *</label>
                <input value={form.name} onChange={F('name')} placeholder="e.g. Kashmiri Floral Baby Frocks Set" className={`input-field ${formErrors.name ? 'input-error' : ''}`} />
                {formErrors.name && <p className="error-msg mt-1"><AlertCircle size={13} />{formErrors.name}</p>}
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea value={form.description} onChange={F('description')} rows={3} placeholder="Detailed product description..." className={`input-field resize-none ${formErrors.description ? 'input-error' : ''}`} />
                {formErrors.description && <p className="error-msg mt-1"><AlertCircle size={13} />{formErrors.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Selling Price (₹) *</label>
                  <input type="number" value={form.price} onChange={F('price')} placeholder="999" min="1" className={`input-field ${formErrors.price ? 'input-error' : ''}`} />
                  {formErrors.price && <p className="error-msg mt-1"><AlertCircle size={13} />{formErrors.price}</p>}
                </div>
                <div>
                  <label className="label">MRP / Compare Price (₹)</label>
                  <input type="number" value={form.compare_price} onChange={F('compare_price')} placeholder="1499 (optional)" min="1" className={`input-field ${formErrors.compare_price ? 'input-error' : ''}`} />
                  {formErrors.compare_price && <p className="error-msg mt-1"><AlertCircle size={13} />{formErrors.compare_price}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category *</label>
                  <select value={form.category} onChange={F('category')} className={`input-field ${formErrors.category ? 'input-error' : ''}`}>
                    <option value="" disabled>-- Select Category --</option>
                    {CATEGORIES_WITH_HALF_SAREE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {formErrors.category && <p className="text-red-500 text-xs mt-1">{formErrors.category}</p>}
                </div>
                <div>
                  <label className="label">Fabric</label>
                  <input value={form.fabric} onChange={F('fabric')} placeholder="Cotton, Silk, Georgette..." className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Stock Quantity *</label>
                <input type="number" value={form.stock} onChange={F('stock')} placeholder="50" min="0" className={`input-field ${formErrors.stock ? 'input-error' : ''}`} />
                {formErrors.stock && <p className="error-msg mt-1"><AlertCircle size={13} />{formErrors.stock}</p>}
              </div>
              <div>
                <label className="label">Available Sizes</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SIZE_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => toggleSize(s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${form.size_options.includes(s) ? 'bg-maroon-800 border-maroon-800 text-white' : 'border-gray-200 text-gray-600 hover:border-maroon-400'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Available Colours</label>
                <div className="flex gap-2 mb-2">
                  <input value={colorInput} onChange={e => setColorInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColor())} placeholder="Type colour name and press Enter" className="input-field flex-1 py-2" />
                  <button type="button" onClick={addColor} className="btn-secondary px-4 py-2">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.colors.map(c => (
                    <span key={c} className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                      {c}
                      <button onClick={() => setForm(f => ({ ...f, colors: f.colors.filter(x => x !== c) }))} className="hover:text-red-600"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Image Upload */}
              <div>
                <label className="label">Product Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.startsWith('http') ? img : `${process.env.NEXT_PUBLIC_API_URL}${img}`}
                        alt={`Product ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-maroon-400 hover:text-maroon-500 transition-colors disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-maroon-600" />
                    ) : (
                      <>
                        <ImagePlus size={18} />
                        <span className="text-[9px] mt-1">Upload</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <p className="text-xs text-gray-400">JPEG, PNG, WebP. Max 10MB. Images are stored on Cloudinary.</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-orange-50">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 accent-maroon-800" />
                <div>
                  <p className="font-medium text-sm text-gray-800">Mark as Featured</p>
                  <p className="text-xs text-gray-500">Featured products appear on the homepage</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-orange-50">
                <input type="checkbox" checked={form.is_new_arrival} onChange={e => setForm(f => ({ ...f, is_new_arrival: e.target.checked }))} className="w-4 h-4 accent-maroon-800" />
                <div>
                  <p className="font-medium text-sm text-gray-800">Mark as New Arrival</p>
                  <p className="text-xs text-gray-500">Shows a "New Arrival" badge on the product card</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-red-200 rounded-xl hover:bg-red-50 bg-red-50/40">
                <input type="checkbox" checked={!form.is_returnable} onChange={e => setForm(f => ({ ...f, is_returnable: !e.target.checked }))} className="w-4 h-4 accent-red-600" />
                <div>
                  <p className="font-medium text-sm text-red-700">Mark as Non-Returnable</p>
                  <p className="text-xs text-red-500">Customers cannot request a return, exchange, or replacement for this product</p>
                </div>
              </label>
            </div>
            <div className="p-6 border-t border-orange-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-3">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                {saving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : <><CheckCircle size={16} /> {editing ? 'Save Changes' : 'Add Product'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shipping Details Modal ── */}
      {shipModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShipModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">📦 Ship Order Details</h3>
                <p className="text-sm text-gray-500">{shipModal.order_number}</p>
              </div>
              <button onClick={() => setShipModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="label">Order Status *</label>
                <select value={shipForm.status} onChange={e => setShipForm(f => ({...f, status: e.target.value}))} className="input-field">
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Current Location */}
              <div>
                <label className="label">📍 Current Location (shown to customer)</label>
                <input value={shipForm.status_location} onChange={e => setShipForm(f => ({...f, status_location: e.target.value}))}
                  placeholder="e.g. In Transit – Erode Hub / Reached Chennai Facility"
                  className="input-field" />
              </div>

              {/* AWB + Courier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">AWB / Tracking No.</label>
                  <input value={shipForm.awb_code} onChange={e => setShipForm(f => ({...f, awb_code: e.target.value}))}
                    placeholder="123456789012" className="input-field" />
                </div>
                <div>
                  <label className="label">Courier Name</label>
                  <input value={shipForm.courier_name} onChange={e => setShipForm(f => ({...f, courier_name: e.target.value}))}
                    placeholder="Delhivery / BlueDart / DTDC" className="input-field" />
                </div>
              </div>

              {/* Tracking URL + Estimated Delivery */}
              <div>
                <label className="label">Tracking URL</label>
                <input value={shipForm.tracking_url} onChange={e => setShipForm(f => ({...f, tracking_url: e.target.value}))}
                  placeholder="https://www.delhivery.com/track/..." className="input-field" />
              </div>
              <div>
                <label className="label">Estimated Delivery Date</label>
                <input value={shipForm.estimated_delivery} onChange={e => setShipForm(f => ({...f, estimated_delivery: e.target.value}))}
                  placeholder="e.g. 25 May 2026 / 3–5 Business Days" className="input-field" />
              </div>

              {/* Delivery Person (for Out for Delivery) */}
              {shipForm.status === 'out_for_delivery' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-orange-800">🚴 Delivery Agent (OTP will be auto-sent to customer)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Agent Name</label>
                      <input value={shipForm.delivery_person_name} onChange={e => setShipForm(f => ({...f, delivery_person_name: e.target.value}))}
                        placeholder="Raju Kumar" className="input-field" />
                    </div>
                    <div>
                      <label className="label">Agent Phone</label>
                      <input value={shipForm.delivery_person_phone} onChange={e => setShipForm(f => ({...f, delivery_person_phone: e.target.value}))}
                        placeholder="+91 9876543210" className="input-field" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShipModal(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleShipSave} disabled={shipSaving} className="flex-1 px-4 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm hover:bg-maroon-900 disabled:opacity-60 flex items-center justify-center gap-2">
                {shipSaving ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : '✅ Save & Notify Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
