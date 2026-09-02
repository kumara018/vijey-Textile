'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { CATEGORY_ORDER } from '@/lib/categories';
import AdminShell from './AdminShell';
import { ActionButton } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';

/**
 * Admin — products.
 *
 * The catalogue, and the only admin view with a real form behind it.
 *
 * WHAT CHANGED IN SUBSTANCE
 *
 * THE LIST IS A LIST AGAIN. The old view was a grid of image cards, which is
 * how a customer browses and the opposite of how a shopkeeper works. Someone
 * here is looking for one piece by name, or scanning stock levels across the
 * whole catalogue. A table does that; a card grid makes you hunt.
 *
 * STOCK IS THE COLUMN THAT MATTERS and it is sorted to the top when low. Zero
 * stock is marked in brass because it is the only state on this page that
 * costs money every hour it persists.
 *
 * DELETION IS CONFIRMED IN PLACE. The old flow used window.confirm(), which
 * cannot be styled, cannot be read properly by some screen readers, and — the
 * real problem — says "Are you sure?" without naming what is about to go. The
 * confirmation now names the piece.
 *
 * THE FORM MIRRORS schemas.py:238 ProductCreate FIELD FOR FIELD. Sizes and
 * colours are comma-separated inputs parsed to arrays, which is what the
 * server wants; `is_returnable` defaults TRUE, matching the schema, because
 * defaulting it false would quietly make every new piece non-returnable.
 */

const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

/**
 * The row's thumbnail, or nothing.
 *
 * Placeholder paths are treated as absent on purpose: a piece that has not
 * been photographed should show the empty frame, not a picture of a missing
 * picture. Same rule the shelf uses.
 */
function thumbOf(p: { images?: string[] }): string | null {
  const first = p.images?.[0];
  if (!first || first.includes('placeholder')) return null;
  return mediaUrl(first);
}

const EMPTY_FORM = {
  name: '', description: '', price: '', compare_price: '', category: CATEGORY_ORDER[0],
  fabric: '', size_options: '', colors: '', stock: '', sku: '',
  fit: '', material: '', care_instructions: '',
  is_featured: false, is_new_arrival: false, is_returnable: true,
};

type FormState = typeof EMPTY_FORM;

export default function AdminProductsView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoOrientation, setVideoOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const heading = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [featuringId, setFeaturingId] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!user.is_admin) router.replace('/');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await adminAPI.getProducts();
      setRows(res.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.is_admin) load(); }, [user, load]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 2000);
    return () => clearTimeout(t);
  }, [announcement]);

  /**
   * The page keeps its own scrollbar while the editor is open.
   *
   * It used to be frozen, which is the usual convention and wrong for the way
   * this shop works. Asked for directly: two scrollbars, one in the form and
   * one for the page. Freezing the page removes the second, and on a short
   * window that leaves nothing to drag when the form does not fit.
   *
   * So the form keeps its own scroll area — the panel is capped and the
   * fields scroll inside it — and the catalogue behind keeps its scrollbar.
   * The dialog is `fixed`, so it stays put on screen while the catalogue
   * moves behind it.
   *
   * Escape still closes it, and focus still goes to the first field with
   * preventScroll so the browser does not make its own conflicting attempt to
   * scroll the element into view.
   */
  useEffect(() => {
    if (!editing) return;
    nameRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing]);

  /** Out of stock first — the only state here that costs money hourly. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter((p) => `${p.name} ${p.sku ?? ''} ${p.category}`.toLowerCase().includes(q))
      : rows;
    return [...base].sort((a, b) => {
      const ra = a.stock === 0 ? 0 : a.stock <= 3 ? 1 : 2;
      const rb = b.stock === 0 ? 0 : b.stock <= 3 ? 1 : 2;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [rows, search]);

  const outOfStock = rows.filter((p) => p.stock === 0).length;

  const openNew = () => {
    setForm(EMPTY_FORM); setImages([]); setVideoUrl(''); setVideoOrientation('portrait');
    setFormError(''); setEditing('new');
  };

  /**
   * Featured, toggled from the row.
   *
   * Optimistic, and it puts the row back if the server refuses — this flag
   * decides what the homepage shows, so a row that says Featured while the
   * shop is not would be worse than a moment's delay.
   */
  const toggleFeatured = async (p: any) => {
    const next = !p.is_featured;
    setFeaturingId(p.id);
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_featured: next } : x)));
    try {
      await adminAPI.updateProduct(p.id, { is_featured: next });
      setAnnouncement(next ? `${p.name} is now featured.` : `${p.name} is no longer featured.`);
    } catch {
      setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_featured: !next } : x)));
      setAnnouncement('That change did not save. Please try again.');
    } finally {
      setFeaturingId(null);
    }
  };

  const openEdit = (p: any) => {
    setForm({
      name: p.name ?? '', description: p.description ?? '',
      price: String(p.price ?? ''), compare_price: p.compare_price ? String(p.compare_price) : '',
      category: p.category ?? CATEGORY_ORDER[0], fabric: p.fabric ?? '',
      size_options: (p.size_options ?? []).join(', '), colors: (p.colors ?? []).join(', '),
      stock: String(p.stock ?? ''), sku: p.sku ?? '', fit: p.fit ?? '',
      material: p.material ?? '', care_instructions: p.care_instructions ?? '',
      is_featured: !!p.is_featured, is_new_arrival: !!p.is_new_arrival,
      is_returnable: p.is_returnable !== false,
    });
    setImages(p.images ?? []);
    setVideoUrl(p.video_url ?? '');
    setVideoOrientation(p.video_orientation === 'landscape' ? 'landscape' : 'portrait');
    setFormError('');
    setEditing(p.id);
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await adminAPI.uploadImage(fd);
        setImages((prev) => [...prev, res.data.url]);
      } catch {
        setFormError('One of those images would not upload.');
      }
    }
    setUploading(false);
  };

  const uploadVideo = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      const res = await adminAPI.uploadVideo(fd);
      setVideoUrl(res.data.url);
    } catch {
      setFormError('That video would not upload.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('The piece needs a name.'); return; }
    if (!form.price || Number(form.price) <= 0) { setFormError('Enter a price.'); return; }
    if (form.stock === '' || Number(form.stock) < 0) { setFormError('Enter a stock count.'); return; }

    setSaving(true);
    setFormError('');
    // Mirrors schemas.py:238 ProductCreate. Empty optionals are omitted rather
    // than sent as "", which the server would store literally.
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category: form.category,
      stock: Number(form.stock),
      size_options: form.size_options.split(',').map((s) => s.trim()).filter(Boolean),
      colors: form.colors.split(',').map((s) => s.trim()).filter(Boolean),
      images,
      is_featured: form.is_featured,
      is_new_arrival: form.is_new_arrival,
      is_returnable: form.is_returnable,
    };
    if (form.compare_price) body.compare_price = Number(form.compare_price);
    for (const k of ['fabric', 'sku', 'fit', 'material', 'care_instructions'] as const) {
      if (form[k].trim()) body[k] = form[k].trim();
    }
    if (videoUrl) { body.video_url = videoUrl; body.video_orientation = videoOrientation; }

    try {
      if (editing === 'new') await adminAPI.createProduct(body);
      else await adminAPI.updateProduct(editing as number, body);
      setAnnouncement(`${form.name.trim()} saved.`);
      setEditing(null);
      await load();
      heading.current?.focus();
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setFormError(
        Array.isArray(d) ? d.map((x: any) => x.msg).join('. ') : (d || 'That did not save.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: any) => {
    setBusyId(p.id);
    setConfirmId(null);
    try {
      await adminAPI.deleteProduct(p.id);
      setAnnouncement(`${p.name} removed from the catalogue.`);
      await load();
      heading.current?.focus();
    } catch {
      setAnnouncement('That could not be removed.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !user?.is_admin) return null;

  const input =
    'mt-2 w-full border-b border-ink-edge bg-transparent pb-1.5 text-sm text-paper focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright';
  const lab = 'block text-rule uppercase text-paper-faint';

  return (
    <AdminShell
      title="Products"
      standfirst={
        loading ? undefined
          : outOfStock > 0
            ? `${rows.length} in the catalogue · ${outOfStock} out of stock, listed first.`
            : `${rows.length} in the catalogue, all in stock.`
      }
      actions={
        <>
          <label htmlFor="prod-search" className="sr-only">Search products</label>
          <input
            id="prod-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="border-b border-ink-edge bg-transparent pb-1.5 text-sm text-paper placeholder:text-paper-faint/60 focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright"
          />
          <ActionButton arrow={false} onClick={openNew}>Add a piece</ActionButton>
        </>
      }
    >
      <Announce message={announcement} />
      <h2 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">Catalogue</h2>

      {/*
        * ── The editor ────────────────────────────────────────────────
        *
        * A DIALOG NOW, NOT A PANEL ABOVE THE LIST.
        *
        * The form used to render inline at the top of the catalogue, which
        * had one unavoidable flaw on a list this long: pressing Edit on a
        * piece near the bottom changed something thousands of pixels away and
        * appeared to do nothing. That was patched by scrolling the page to the
        * form, which worked and still asked the shop to leave the row it was
        * working on.
        *
        * The sister shop has always used a centred dialog for the same job and
        * it is plainly the better answer: the editor arrives over the row you
        * pressed, the catalogue stays where it was underneath, and closing
        * puts you back exactly where you were. It is the same structure used
        * there — a panel capped at 90vh with the title and the buttons pinned
        * and only the fields scrolling — dressed in this shop's own palette
        * rather than the sister's.
        */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <form
            ref={formRef}
            onSubmit={save}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-ink-edge bg-ink-deep"
          >
            <div className="flex shrink-0 items-center justify-between gap-6 border-b border-ink-edge px-8 py-6">
              <h3 id="editor-title" className="font-display text-band font-light text-paper">
                {editing === 'new' ? 'Add a piece' : 'Edit this piece'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close the editor"
                className="text-xs uppercase tracking-[0.18em] text-paper-faint transition-colors hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-7">

          {formError && <p role="alert" className="mb-5 text-sm text-brass-bright">{formError}</p>}

          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label htmlFor="p-name" className={lab}>Name</label>
              <input id="p-name" ref={nameRef} value={form.name} className={input}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="p-cat" className={lab}>Category</label>
              <select id="p-cat" value={form.category} className={input}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c} className="bg-ink">{c}</option>)}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="p-desc" className={lab}>Description</label>
              <textarea id="p-desc" rows={3} value={form.description} className={`${input} resize-y`}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <label htmlFor="p-price" className={lab}>Price (₹)</label>
              <input id="p-price" inputMode="decimal" value={form.price} className={input}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="p-compare" className={lab}>Was (₹, optional)</label>
              <input id="p-compare" inputMode="decimal" value={form.compare_price} className={input}
                onChange={(e) => setForm((f) => ({ ...f, compare_price: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="p-stock" className={lab}>Stock</label>
              <input id="p-stock" inputMode="numeric" value={form.stock} className={input}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
            </div>

            <div>
              <label htmlFor="p-sizes" className={lab}>Sizes</label>
              <input id="p-sizes" value={form.size_options} className={input}
                placeholder="24, 26, 28"
                onChange={(e) => setForm((f) => ({ ...f, size_options: e.target.value }))} />
              <p className="mt-1.5 text-xs text-paper-faint">Separated by commas.</p>
            </div>
            <div>
              <label htmlFor="p-colors" className={lab}>Colours</label>
              <input id="p-colors" value={form.colors} className={input}
                placeholder="Green, Maroon"
                onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))} />
              <p className="mt-1.5 text-xs text-paper-faint">Separated by commas.</p>
            </div>
            <div>
              <label htmlFor="p-sku" className={lab}>SKU (optional)</label>
              <input id="p-sku" value={form.sku} className={input}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>

            <div>
              <label htmlFor="p-fabric" className={lab}>Fabric</label>
              <input id="p-fabric" value={form.fabric} className={input}
                onChange={(e) => setForm((f) => ({ ...f, fabric: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="p-material" className={lab}>Material</label>
              <input id="p-material" value={form.material} className={input}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="p-fit" className={lab}>Fit</label>
              <input id="p-fit" value={form.fit} className={input}
                onChange={(e) => setForm((f) => ({ ...f, fit: e.target.value }))} />
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="p-care" className={lab}>Care instructions</label>
              <input id="p-care" value={form.care_instructions} className={input}
                onChange={(e) => setForm((f) => ({ ...f, care_instructions: e.target.value }))} />
            </div>
          </div>

          {/* Media */}
          <div className="mt-9 grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <div>
              <p className={lab}>Photographs</p>
              {images.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {images.map((src, i) => (
                    <li key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Photograph ${i + 1}`} className="h-24 w-20 border border-ink-edge object-cover" />
                      <button type="button" onClick={() => setImages((p) => p.filter((u) => u !== src))}
                        aria-label={`Remove photograph ${i + 1}`}
                        className="mt-1 block w-full text-center text-xs text-paper-faint hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input type="file" accept="image/*" multiple disabled={uploading}
                onChange={(e) => uploadImages(e.target.files)}
                className="mt-3 block w-full text-sm text-paper-muted file:mr-4 file:cursor-pointer file:border file:border-ink-edge file:bg-transparent file:px-4 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.14em] file:text-paper hover:file:border-brass-bright" />
              <p className="mt-1.5 text-xs text-paper-faint">
                The first photograph is the one the storefront stages.
              </p>
            </div>

            <div>
              <p className={lab}>Video (optional)</p>
              {videoUrl && (
                <p className="mt-3 break-all font-mono text-xs text-paper-muted">{videoUrl}</p>
              )}
              <input type="file" accept="video/*" disabled={uploading}
                onChange={(e) => uploadVideo(e.target.files)}
                className="mt-3 block w-full text-sm text-paper-muted file:mr-4 file:cursor-pointer file:border file:border-ink-edge file:bg-transparent file:px-4 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.14em] file:text-paper hover:file:border-brass-bright" />
              {videoUrl && (
                <fieldset className="mt-4">
                  <legend className="text-xs text-paper-faint">
                    How it was filmed — the product page sizes the player from this.
                  </legend>
                  <div className="mt-2 flex gap-6">
                    {(['portrait', 'landscape'] as const).map((o) => (
                      <label key={o} className="flex cursor-pointer items-center gap-2 text-sm capitalize has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright">
                        <input type="radio" name="orientation" className="sr-only"
                          checked={videoOrientation === o} onChange={() => setVideoOrientation(o)} />
                        <span aria-hidden="true" className={videoOrientation === o ? 'text-brass-bright' : 'text-paper-faint'}>—</span>
                        <span className={videoOrientation === o ? 'text-paper' : 'text-paper-muted'}>{o}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </div>

          {/* Flags */}
          <div className="mt-9 flex flex-wrap gap-x-10 gap-y-4">
            {([
              ['is_featured', 'Featured'],
              ['is_new_arrival', 'New arrival'],
              ['is_returnable', 'Returnable'],
            ] as const).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" checked={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))}
                  className="h-4 w-4 accent-[#A16207] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright" />
                <span className="text-paper-muted">{l}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 max-w-[52ch] text-xs text-paper-faint">
            Returnable is on by default. Turning it off means this piece cannot be returned or
            exchanged unless it arrives damaged, and the product page says so to the customer.
          </p>

            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-x-10 gap-y-4 border-t border-ink-edge px-8 py-6">
              <ActionButton type="submit" arrow={false} disabled={saving || uploading}>
                {saving ? 'Saving…' : editing === 'new' ? 'Add to the catalogue' : 'Save changes'}
              </ActionButton>
              <ActionButton tone="quiet" arrow={false} onClick={() => setEditing(null)}>
                Cancel
              </ActionButton>
            </div>
          </form>
        </div>
      )}

      {/* ── The catalogue ────────────────────────────────────────────── */}
      {loading && (
        <Skeleton label="Loading the catalogue">
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonLine key={i} w="w-full" h="h-9" />)}
          </div>
        </Skeleton>
      )}

      {failed && !loading && (
        <ErrorState
          title="We could not load the catalogue"
          body="No product has changed — this is a problem reaching the server."
          onRetry={load}
          fallbackHref="/admin"
          fallbackLabel="Back to the dashboard"
        />
      )}

      {!loading && !failed && visible.length === 0 && (
        <p className="max-w-[52ch] text-lede text-paper-muted">
          {search ? `Nothing matches “${search}”.` : 'The catalogue is empty. Add the first piece.'}
        </p>
      )}

      {!loading && !failed && visible.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">The catalogue, out of stock first</caption>
            <thead>
              <tr className="border-b border-ink-edge">
                {['ID', 'Piece', 'Category', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                  <th key={h || 'actions'} scope="col"
                    className={`py-3 text-rule uppercase text-paper-faint ${i === 3 || i === 4 ? 'text-right' : 'text-left'} ${i === 0 ? 'pr-4' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const busy = busyId === p.id;
                const confirming = confirmId === p.id;
                return (
                  <tr key={p.id} className={`border-b border-ink-edge/40 ${p.is_active === false ? 'opacity-55' : ''}`}>
                    {/* The id, because it is what the shop and the courier
                        both quote when something is wrong with a piece. */}
                    <td className="py-3 pr-4 whitespace-nowrap font-mono text-xs text-paper-faint">#{p.id}</td>

                    {/* THE PIECE, WITH ITS PHOTOGRAPH.
                        A catalogue of names is hard to work in — the sister
                        shop has always shown the thumbnail, and the shop
                        recognises a frock far faster than it reads one. The
                        badges say the three things that change how a piece
                        behaves on the site, so they do not have to be opened
                        to be checked. */}
                    <th scope="row" className="py-3 pr-4 text-left font-normal text-paper">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-ink-edge bg-ink-raised">
                          {thumbOf(p) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbOf(p)!} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-rule uppercase text-paper-faint">—</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block">{p.name}</span>
                          {p.sku && <span className="mt-0.5 block font-mono text-xs text-paper-faint">{p.sku}</span>}
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {p.is_featured && <span className="bg-brass/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brass">Featured</span>}
                            {p.is_new_arrival && <span className="bg-ink-raised px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-paper-muted">New</span>}
                            {p.is_returnable === false && <span className="bg-ink-raised px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brass-dim">No returns</span>}
                          </span>
                        </span>
                      </div>
                    </th>
                    <td className="py-3 pr-4 text-paper-muted">{p.category}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-paper-muted">{money(p.price)}</td>
                    {/* Stock reads as a state, not just a number: nothing to
                        sell is the one row that costs money every hour. */}
                    <td className={`py-3 pr-4 text-right tabular-nums ${p.stock === 0 ? 'text-brass-bright' : p.stock <= 3 ? 'text-brass' : 'text-paper-muted'}`}>
                      {p.stock === 0 ? 'Out of stock' : p.stock}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-rule uppercase ${p.is_active === false ? 'text-paper-faint' : 'text-paper-muted'}`}>
                        {p.is_active === false ? 'Hidden' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
                        {confirming ? (
                          <>
                            {/* Names the piece — window.confirm never did. */}
                            <span className="text-xs text-paper-muted">Remove “{p.name}”?</span>
                            <ActionButton tone="lead" arrow={false} disabled={busy} onClick={() => remove(p)}>
                              {busy ? 'Removing…' : 'Yes, remove'}
                            </ActionButton>
                            <ActionButton tone="quiet" arrow={false} onClick={() => setConfirmId(null)}>
                              Keep
                            </ActionButton>
                          </>
                        ) : (
                          <>
                            {/* Featured is toggled from the row because it is
                                the one flag the shop changes daily, and
                                opening the editor to tick a box for it was
                                four steps for one bit. */}
                            <button
                              type="button"
                              onClick={() => toggleFeatured(p)}
                              disabled={featuringId === p.id}
                              aria-pressed={p.is_featured}
                              aria-label={p.is_featured ? `Remove ${p.name} from featured` : `Mark ${p.name} as featured`}
                              title={p.is_featured ? 'Remove from featured' : 'Mark as featured'}
                              className={`text-lg leading-none transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright ${p.is_featured ? 'text-brass hover:text-brass-bright' : 'text-ink-edge hover:text-brass'}`}
                            >
                              {p.is_featured ? '★' : '☆'}
                            </button>
                            <ActionButton tone="quiet" arrow={false} onClick={() => openEdit(p)}
                              aria-label={`Edit ${p.name}`}>
                              Edit
                            </ActionButton>
                            <ActionButton tone="quiet" arrow={false} onClick={() => setConfirmId(p.id)}
                              aria-label={`Remove ${p.name}`}>
                              Remove
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
