import { describe, it, expect, vi, afterEach } from 'vitest';
import sitemap from '../sitemap';

/**
 * SEO-09 in the October 2026 test pass: the sitemap listed no products. These
 * pin both halves of the fix — products are listed, and an API that is down
 * never takes the fixed pages with it.
 */
afterEach(() => vi.unstubAllGlobals());

const urls = (entries: Awaited<ReturnType<typeof sitemap>>) => entries.map((e) => e.url);

describe('sitemap', () => {
  it('lists every product the API returns, by its page address', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{ id: 7, created_at: '2026-09-30T10:00:00' }, { id: 12, created_at: null }]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const u = urls(await sitemap());
    expect(u).toContain('https://vijeytextile.com/products/7');
    expect(u).toContain('https://vijeytextile.com/products/12');
    expect(u).toContain('https://vijeytextile.com/products');
  });

  it('still returns the fixed pages when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const u = urls(await sitemap());
    expect(u).toContain('https://vijeytextile.com');
    expect(u.some((x) => /\/products\/\d+$/.test(x))).toBe(false);
  });

  it('ignores an error page or a reply that is not a list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"boom"}', { status: 200 })));
    expect((await sitemap()).length).toBe(7);
  });
});
