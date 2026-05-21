'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SlidersHorizontal, Search, X, ChevronDown } from 'lucide-react';
import Fuse from 'fuse.js';
import { productsAPI } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/ProductCard';

const CATEGORIES = ['Baby Frocks', 'Frocks', 'Western Dresses', 'Lehenga', 'Party Wear'];
const SORT_OPTIONS = [
  { label: 'Newest First',    value: 'created_at:desc' },
  { label: 'Price: Low–High', value: 'price:asc' },
  { label: 'Price: High–Low', value: 'price:desc' },
  { label: 'Top Rated',       value: 'rating_avg:desc' },
  { label: 'Name A–Z',        value: 'name:asc' },
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fuzzyMatch, setFuzzyMatch]   = useState<string>('');

  // Single source of truth — derived directly from URL on every render
  const filters = {
    category: searchParams.get('category')  || '',
    search:   searchParams.get('search')    || '',
    minPrice: searchParams.get('min_price') || '',
    maxPrice: searchParams.get('max_price') || '',
    featured: searchParams.get('featured')  || '',
    sort:     searchParams.get('sort')      || 'created_at:desc',
  };

  // All fetch logic lives here with a cancellation flag — no useCallback needed
  useEffect(() => {
    let cancelled = false;

    const doFetch = async (attempt = 1) => {
      setLoading(true);

      const [sortBy, sortOrder] = filters.sort.split(':');
      const params: any = { sort_by: sortBy, sort_order: sortOrder, limit: 40 };
      if (filters.category) params.category  = filters.category;
      if (filters.search)   params.search    = filters.search;
      if (filters.minPrice) params.min_price = Number(filters.minPrice);
      if (filters.maxPrice) params.max_price = Number(filters.maxPrice);
      if (filters.featured) params.featured  = true;

      try {
        const res = await productsAPI.getAll(params);
        if (cancelled) return;

        // Normalise — backend may return array directly or wrapped object
        const raw = res.data;
        const data: Product[] = Array.isArray(raw)
          ? raw
          : (raw?.products ?? raw?.items ?? raw?.data ?? []);

        if (data.length === 0 && filters.search) {
          // ── Fuzzy fallback ───────────────────────────────────────────
          const allRes = await productsAPI.getAll({ limit: 100 });
          if (cancelled) return;

          const allRaw = allRes.data;
          const allData: Product[] = Array.isArray(allRaw)
            ? allRaw
            : (allRaw?.products ?? allRaw?.items ?? allRaw?.data ?? []);

          if (allData.length === 0) {
            // Can't do fuzzy if we have no products at all
            setFuzzyMatch('');
            setProducts([]);
            setTotal(0);
            setLoading(false);
            return;
          }

          const fuse = new Fuse(allData, {
            keys: [{ name: 'name', weight: 0.7 }, { name: 'category', weight: 0.3 }],
            threshold: 0.45,
            minMatchCharLength: 2,
            ignoreLocation: true,
            includeScore: true,
          });

          const fuzzy = fuse.search(filters.search, { limit: 40 });
          if (cancelled) return;

          if (fuzzy.length > 0) {
            const matched = fuzzy.map(r => r.item);
            const bestMatch = fuzzy[0].item.category || fuzzy[0].item.name;
            setFuzzyMatch(bestMatch);
            setProducts(matched);
            setTotal(matched.length);
          } else {
            setFuzzyMatch('');
            setProducts([]);
            setTotal(0);
          }
        } else {
          // ── Exact / filtered results ──────────────────────────────────
          setFuzzyMatch('');
          setProducts(data);
          setTotal(data.length);
        }

        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        if (!err.response && attempt === 1) {
          // Network error — retry once after 10 s
          setTimeout(() => { if (!cancelled) doFetch(2); }, 10000);
        } else {
          setFuzzyMatch('');
          setProducts([]);
          setTotal(0);
          setLoading(false);
        }
      }
    };

    doFetch();
    return () => { cancelled = true; }; // cancel on unmount or re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.category,
    filters.search,
    filters.minPrice,
    filters.maxPrice,
    filters.featured,
    filters.sort,
  ]);

  // Update a filter: write to URL only (effect above reads from URL)
  const setF = (key: string, val: string) => {
    const urlKeyMap: Record<string, string> = { minPrice: 'min_price', maxPrice: 'max_price' };
    const urlKey = urlKeyMap[key] ?? key;
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(urlKey, val);
    else     params.delete(urlKey);
    router.replace(`/products${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const clearFilters = () => {
    router.replace('/products', { scroll: false });
  };

  const hasFilters = filters.category || filters.search || filters.minPrice || filters.maxPrice || filters.featured;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="section-title">
            {filters.category || 'All Products'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading...' : `${total} product${total !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort */}
          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => setF('sort', e.target.value)}
              className="input-field py-2 pr-8 text-sm appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${filtersOpen ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-maroon-200 text-maroon-800 hover:border-maroon-800'}`}
          >
            <SlidersHorizontal size={16} /> Filters
            {hasFilters && <span className="bg-gold-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">!</span>}
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="label text-xs">Search</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                defaultValue={filters.search}
                key={filters.search} // re-mount when URL changes
                onBlur={(e) => setF('search', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setF('search', (e.target as HTMLInputElement).value); }}
                placeholder="Search products..."
                className="input-field pl-9 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label text-xs">Category</label>
            <select value={filters.category} onChange={(e) => setF('category', e.target.value)} className="input-field py-2.5 text-sm">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Price range */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label text-xs">Min Price (₹)</label>
              <input
                type="number"
                defaultValue={filters.minPrice}
                key={`min-${filters.minPrice}`}
                onBlur={(e) => setF('minPrice', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setF('minPrice', (e.target as HTMLInputElement).value); }}
                placeholder="0"
                className="input-field py-2.5 text-sm"
                min="0"
              />
            </div>
            <div className="flex-1">
              <label className="label text-xs">Max Price (₹)</label>
              <input
                type="number"
                defaultValue={filters.maxPrice}
                key={`max-${filters.maxPrice}`}
                onBlur={(e) => setF('maxPrice', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setF('maxPrice', (e.target as HTMLInputElement).value); }}
                placeholder="99999"
                className="input-field py-2.5 text-sm"
                min="0"
              />
            </div>
          </div>

          {/* Featured & Clear */}
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!filters.featured} onChange={(e) => setF('featured', e.target.checked ? 'true' : '')} className="w-4 h-4 accent-maroon-800" />
              <span className="text-sm font-medium text-gray-700">Featured only</span>
            </label>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium">
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setF('category', '')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!filters.category ? 'bg-maroon-800 text-white border-maroon-800' : 'bg-white text-gray-700 border-gray-200 hover:border-maroon-300'}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setF('category', cat === filters.category ? '' : cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${filters.category === cat ? 'bg-maroon-800 text-white border-maroon-800' : 'bg-white text-gray-700 border-gray-200 hover:border-maroon-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Fuzzy match banner */}
      {!loading && fuzzyMatch && filters.search && (
        <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm">
          <Search size={15} className="text-orange-500 flex-shrink-0" />
          <span className="text-gray-600">
            No exact results for <strong>&ldquo;{filters.search}&rdquo;</strong>. Showing results for{' '}
            <span className="font-bold text-maroon-700">&ldquo;{fuzzyMatch}&rdquo;</span> instead.
          </span>
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="bg-gray-200 aspect-[3/4]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-9 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
          <p className="text-gray-500 mb-6">Try adjusting your filters or search terms.</p>
          <button onClick={clearFilters} className="btn-primary">Clear Filters</button>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{Array(12).fill(0).map((_, i) => <div key={i} className="card animate-pulse"><div className="bg-gray-200 aspect-[3/4]" /><div className="p-3 space-y-2"><div className="h-4 bg-gray-200 rounded" /><div className="h-9 bg-gray-200 rounded" /></div></div>)}</div></div>}>
      <ProductsContent />
    </Suspense>
  );
}
