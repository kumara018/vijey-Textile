'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api';
import { useRefreshCategories } from '@/lib/useCategories';
import type { ShopCategory } from '@/types';
import AdminShell from './AdminShell';
import { ActionButton } from '@/components/system/Action';
import { ErrorState, Skeleton, SkeletonLine, Announce } from '@/components/system/States';

/**
 * Admin — categories.
 *
 * THE ONE LIST. Before this, a category was typed out by hand in about ten
 * places — the menu, the footer, the listing's filter rail, the 404 page, the
 * product form — and the database table meant to hold them was read by
 * nothing (on this shop it even held the sister shop's list). Adding one meant
 * a code change and a deploy, and missing a place meant a garment under a name
 * one of the menus did not offer.
 *
 * Every one of those places now reads the `categories` table, and this screen
 * is how the table is edited. A change here reaches the menu, footer and
 * filters without a deploy; `useRefreshCategories` makes it reach the admin's
 * own open tab at once.
 *
 * WHAT EACH ACTION ACTUALLY DOES, stated on screen as well as here:
 *   Rename   — moves every piece filed under the old name. Past orders keep
 *              the name they were bought under; an invoice is a record.
 *   Hide     — out of the menus; its pieces stay on sale and searchable.
 *   Delete   — only when empty, so no piece is ever stranded.
 */

type Draft = {
  name: string;
  emoji: string;
  eyebrow: string;
  headline: string;
  description: string;
  is_active: boolean;
};

const BLANK: Draft = { name: '', emoji: '', eyebrow: '', headline: '', description: '', is_active: true };

const toDraft = (c: ShopCategory): Draft => ({
  name: c.name,
  emoji: c.emoji ?? '',
  eyebrow: c.eyebrow ?? '',
  headline: c.headline ?? '',
  description: c.description ?? '',
  is_active: c.is_active,
});

/** FastAPI returns a string for our own errors and a list for validation ones. */
function reason(err: any, fallback: string): string {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  if (!err?.response) return 'Could not reach the shop. Check the connection and try again.';
  return fallback;
}

export default function AdminCategoriesView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const refreshShopMenus = useRefreshCategories();

  const [rows, setRows] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  /** 'new' for the add form, an id for an open edit, null for neither. */
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    if (!user.is_admin) router.replace('/');
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await adminAPI.getCategories();
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
    const t = setTimeout(() => setAnnouncement(''), 2500);
    return () => clearTimeout(t);
  }, [announcement]);

  useEffect(() => {
    if (editing !== null) requestAnimationFrame(() => nameRef.current?.focus());
  }, [editing]);

  /** Every write returns the whole list; take it as the truth and tell the shop. */
  const accept = (list: ShopCategory[], message: string) => {
    setRows(list);
    refreshShopMenus();
    setAnnouncement(message);
  };

  const openNew = () => {
    setDraft(BLANK);
    setFormError('');
    setEditing('new');
  };

  const openEdit = (c: ShopCategory) => {
    setDraft(toDraft(c));
    setFormError('');
    setRowError(null);
    setConfirmDelete(null);
    setEditing(c.id);
  };

  const close = () => { setEditing(null); setFormError(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { setFormError('Give the category a name of at least 2 characters.'); return; }

    const body = {
      name,
      emoji: draft.emoji.trim() || null,
      eyebrow: draft.eyebrow.trim() || null,
      headline: draft.headline.trim() || null,
      description: draft.description.trim() || null,
      is_active: draft.is_active,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const res = await adminAPI.createCategory(body);
        accept(res.data, `${name} added. It is in the shop's menus now.`);
      } else if (typeof editing === 'number') {
        const before = rows.find((r) => r.id === editing);
        const res = await adminAPI.updateCategory(editing, body);
        const moved = before && before.name !== name && before.product_count > 0
          ? ` ${before.product_count} piece${before.product_count === 1 ? '' : 's'} moved with it.`
          : '';
        accept(res.data, `${name} saved.${moved}`);
      }
      setEditing(null);
    } catch (err) {
      setFormError(reason(err, 'That did not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (c: ShopCategory) => {
    setBusyId(c.id);
    setRowError(null);
    try {
      const res = await adminAPI.updateCategory(c.id, { is_active: !c.is_active });
      accept(res.data, c.is_active
        ? `${c.name} is hidden from the menus. Its pieces are still on sale.`
        : `${c.name} is back in the menus.`);
    } catch (err) {
      setRowError({ id: c.id, text: reason(err, 'That change did not save.') });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= rows.length) return;
    const before = rows;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);                       // move it now; the server confirms
    setBusyId(rows[index].id);
    setRowError(null);
    try {
      const res = await adminAPI.reorderCategories(next.map((r) => r.id));
      accept(res.data, `${rows[index].name} moved ${by < 0 ? 'up' : 'down'}.`);
    } catch (err) {
      setRows(before);                   // put it back exactly as it was
      setRowError({ id: rows[index].id, text: reason(err, 'The new order did not save.') });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: ShopCategory) => {
    setBusyId(c.id);
    setRowError(null);
    try {
      const res = await adminAPI.deleteCategory(c.id);
      accept(res.data, `${c.name} deleted.`);
      setConfirmDelete(null);
    } catch (err) {
      setRowError({ id: c.id, text: reason(err, 'That could not be deleted.') });
      setConfirmDelete(null);
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !user?.is_admin) return null;

  const input =
    'mt-2 w-full border-b border-ink-edge bg-transparent pb-1.5 text-sm text-paper placeholder:text-paper-faint/50 focus:border-paper-faint focus:outline-none focus-visible:border-brass-bright';
  const lab = 'block text-rule uppercase text-paper-faint';
  const hint = 'mt-1.5 block text-caption text-paper-faint/80';
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center border border-ink-edge text-paper-muted transition-colors duration-300 hover:border-brass-bright hover:text-paper disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright';
  const textBtn =
    'text-caption uppercase text-paper-faint transition-colors duration-300 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-paper-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-bright';

  const shown = rows.filter((r) => r.is_active).length;

  /** The add / edit form. One component for both, so they cannot drift apart. */
  const form = (
    <form onSubmit={save} noValidate className="border border-ink-edge bg-ink-deep px-6 py-7 sm:px-8">
      <p className="text-rule uppercase text-brass-bright">
        {editing === 'new' ? 'New category' : `Editing ${rows.find((r) => r.id === editing)?.name ?? ''}`}
      </p>

      <div className="mt-6 grid gap-x-10 gap-y-7 md:grid-cols-[1fr_7rem]">
        <div>
          <label htmlFor="cat-name" className={lab}>Name</label>
          <input id="cat-name" ref={nameRef} value={draft.name} maxLength={60} className={input}
            placeholder="e.g. Sharara"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <span className={hint}>
            Exactly as it should appear in the menu.
            {typeof editing === 'number' && (rows.find((r) => r.id === editing)?.product_count ?? 0) > 0 &&
              ' Renaming moves every piece in it to the new name.'}
          </span>
        </div>
        <div>
          <label htmlFor="cat-emoji" className={lab}>Icon</label>
          <input id="cat-emoji" value={draft.emoji} maxLength={10} className={input} placeholder="🪷"
            onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))} />
          <span className={hint}>Optional</span>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="cat-eyebrow" className={lab}>Short line</label>
          <input id="cat-eyebrow" value={draft.eyebrow} maxLength={60} className={input}
            placeholder="e.g. Mehendi to sangeet"
            onChange={(e) => setDraft((d) => ({ ...d, eyebrow: e.target.value }))} />
          <span className={hint}>Shown under the name in the menu, and above it on the category&rsquo;s page. A few words.</span>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="cat-headline" className={lab}>Headline</label>
          <input id="cat-headline" value={draft.headline} maxLength={160} className={input}
            placeholder="e.g. Wide at the hem, and made to twirl in"
            onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} />
          <span className={hint}>Optional. The category page&rsquo;s display line.</span>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="cat-desc" className={lab}>One line about it</label>
          <input id="cat-desc" value={draft.description} maxLength={500} className={input}
            placeholder="e.g. Flared trousers under a short kurti — easy to dance in all evening."
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          <span className={hint}>Optional. Keep it to one sentence.</span>
        </div>

        <label className="flex cursor-pointer items-start gap-3 md:col-span-2">
          <input type="checkbox" checked={draft.is_active}
            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-brass-bright" />
          <span>
            <span className="block text-sm text-paper">Show in the shop&rsquo;s menus</span>
            <span className={hint}>Untick to hide it. Its pieces stay on sale and can still be found by search.</span>
          </span>
        </label>
      </div>

      {formError && (
        <p role="alert" className="mt-6 text-sm text-maroon-300">{formError}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-4">
        <ActionButton type="submit" arrow={false} disabled={saving}>
          {saving ? 'Saving…' : editing === 'new' ? 'Add category' : 'Save changes'}
        </ActionButton>
        <ActionButton tone="quiet" arrow={false} onClick={close}>Cancel</ActionButton>
      </div>
    </form>
  );

  return (
    <AdminShell
      title="Categories"
      standfirst={
        loading ? undefined
          : `${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}, ${shown} in the menus. The menu, footer and filters follow this order.`
      }
      actions={<ActionButton arrow={false} onClick={openNew} disabled={editing === 'new'}>Add a category</ActionButton>}
    >
      <Announce message={announcement} />

      {editing === 'new' && <div className="mb-10">{form}</div>}

      {loading ? (
        <Skeleton label="Loading categories">
          <div className="space-y-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonLine key={i} h="h-10" />)}
          </div>
        </Skeleton>
      ) : failed ? (
        <ErrorState title="The categories did not load" onRetry={load} />
      ) : (
        <ol className="border-t border-ink-edge">
          {rows.map((c, i) => {
            const busy = busyId === c.id;
            const pieces = c.product_count;
            return (
              <li key={c.id} className="border-b border-ink-edge">
                {editing === c.id ? (
                  <div className="py-6">{form}</div>
                ) : (
                  <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 py-5 ${c.is_active ? '' : 'opacity-60'}`}>
                    {/* Position — the order the menus actually use. */}
                    <span className="w-7 shrink-0 font-display text-sm tabular-nums text-paper-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <div className="min-w-[12rem] flex-1">
                      <p className="flex items-baseline gap-2 font-display text-lg font-light text-paper">
                        {c.emoji && <span aria-hidden="true" className="text-base">{c.emoji}</span>}
                        {c.name}
                        {!c.is_active && (
                          <span className="ml-1 border border-ink-edge px-2 py-0.5 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-paper-faint">
                            Hidden
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-caption text-paper-faint">
                        {c.eyebrow ? <span className="uppercase">{c.eyebrow} · </span> : null}
                        {pieces === 0
                          ? 'No pieces yet'
                          : `${pieces} piece${pieces === 1 ? '' : 's'} · ${c.live_product_count} on sale`}
                      </p>
                      {rowError?.id === c.id && (
                        <p role="alert" className="mt-2 text-sm text-maroon-300">{rowError.text}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="button" className={iconBtn} disabled={busy || i === 0}
                        onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>↑</button>
                      <button type="button" className={iconBtn} disabled={busy || i === rows.length - 1}
                        onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>↓</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <a href={`/products?category=${encodeURIComponent(c.name)}`} target="_blank" rel="noopener noreferrer"
                        className={textBtn}>View</a>
                      <button type="button" className={textBtn} disabled={busy} onClick={() => openEdit(c)}>Edit</button>
                      <button type="button" className={textBtn} disabled={busy} onClick={() => toggleVisible(c)}>
                        {c.is_active ? 'Hide' : 'Show'}
                      </button>

                      {confirmDelete === c.id ? (
                        <span className="flex items-center gap-4">
                          <span className="text-caption text-paper">Delete {c.name}?</span>
                          <button type="button" className={`${textBtn} !text-maroon-300 hover:!text-paper`}
                            disabled={busy} onClick={() => remove(c)}>
                            {busy ? 'Deleting…' : 'Delete'}
                          </button>
                          <button type="button" className={textBtn} onClick={() => setConfirmDelete(null)}>Keep</button>
                        </span>
                      ) : (
                        <button type="button" className={textBtn}
                          disabled={busy || pieces > 0}
                          title={pieces > 0 ? `Move its ${pieces} piece${pieces === 1 ? '' : 's'} to another category first, or hide it instead.` : undefined}
                          onClick={() => { setRowError(null); setConfirmDelete(c.id); }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!loading && !failed && (
        <p className="mt-8 max-w-[62ch] text-caption leading-relaxed text-paper-faint">
          A category shows in the menu, the footer, the filters on the shop page and the product form.
          Delete is only offered for an empty category, so no piece is ever left without one — to
          retire a category that has pieces, move them first or hide it.
        </p>
      )}
    </AdminShell>
  );
}
