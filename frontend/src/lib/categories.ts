/**
 * Category identity.
 *
 * The six footer and Index links are all `/products?category=…` — one page,
 * six entry points. That is the right architecture (one grid, one data path,
 * one set of filters) and the wrong *experience* if the page simply swaps a
 * heading and re-runs the query. A parent arriving from "Lehenga" should land
 * somewhere that knows what a lehenga is for, not on a generic grid with a
 * chip pre-selected.
 *
 * So each category carries its own editorial identity: an eyebrow that names
 * the occasion, a display line in the brand's voice, a standfirst, and a
 * rhythm — which controls how the alternating full-bleed rows are ordered, so
 * two categories never lay out identically even at the same product count.
 *
 * Copy is written to the existing brand voice. It is deliberately about the
 * day the garment is for rather than about the garment, because that is how
 * this shop's customers actually choose.
 */

export type Rhythm = 'lead-wide' | 'lead-pair' | 'lead-tall';

export interface CategoryIdentity {
  /** Exact value the backend stores and filters on. Never localise this. */
  slug: string;
  eyebrow: string;
  display: string;
  standfirst: string;
  /** Ordering of the alternating rows, so no two categories scan alike. */
  rhythm: Rhythm;
}

/**
 * SHORT ON PURPOSE. Each standfirst was a two-to-three sentence paragraph —
 * 120 to 195 characters of prose above a grid of garments. On the listing page
 * that is a wall of reading between a customer and the thing they came to buy,
 * and it was named directly: "lot of text is there ... not user friendly".
 *
 * One line each now. Where a sentence carried a real fact it is kept; where it
 * only set a mood it is gone. The garments say the rest.
 */
export const CATEGORY_IDENTITY: Record<string, CategoryIdentity> = {
  'Baby Frocks': {
    slug: 'Baby Frocks',
    eyebrow: 'First celebrations',
    display: 'The first photograph anyone will keep',
    standfirst:
      'Soft cottons and gentle silks. Every seam finished on the inside.',
    rhythm: 'lead-wide',
  },
  'Chudithar': {
    slug: 'Chudithar',
    eyebrow: 'Everyday grace',
    display: 'For the days that are not occasions',
    standfirst:
      'Cut to move in, made to wash well.',
    rhythm: 'lead-pair',
  },
  'Frocks': {
    slug: 'Frocks',
    eyebrow: 'School to supper',
    display: 'One change of clothes, two halves of a day',
    standfirst:
      'School to supper — sturdy, and finished well enough to sit down in.',
    rhythm: 'lead-tall',
  },
  'Western Dresses': {
    slug: 'Western Dresses',
    eyebrow: 'Modern occasion',
    display: 'Cut clean, worn confidently',
    standfirst:
      'Modern cuts, in the same cloth as everything else here.',
    rhythm: 'lead-pair',
  },
  'Lehenga': {
    slug: 'Lehenga',
    eyebrow: 'The heirloom piece',
    display: 'Weight, drape, and a hem that holds its line',
    standfirst:
      'Weight, drape, and a hem that holds its line through a wedding.',
    rhythm: 'lead-wide',
  },
  'Party Wear': {
    slug: 'Party Wear',
    eyebrow: 'For the photographs',
    display: 'Made to be seen across a crowded room',
    standfirst:
      'Colour that survives a camera flash.',
    rhythm: 'lead-tall',
  },
};

/** The canonical order — matches the Index overlay and the footer. */
export const CATEGORY_ORDER = Object.keys(CATEGORY_IDENTITY);

/**
 * Identity for the un-filtered listing.
 *
 * "All pieces" is a category too, not an absence of one — it gets the same
 * editorial treatment so the page never has a bare state.
 */
export const ALL_PIECES: CategoryIdentity = {
  slug: '',
  eyebrow: 'Everything on the rail',
  display: 'Every piece in the shop',
  standfirst:
    'Sizes twelve to forty, cut across the full range, so a younger sister and an older cousin can wear the same design to the same wedding.',
  rhythm: 'lead-wide',
};

export function identityFor(category: string | null | undefined, search?: string | null): CategoryIdentity {
  if (search) {
    return {
      slug: '',
      eyebrow: 'Search',
      display: `Pieces matching “${search}”`,
      standfirst: 'If nothing here is right, the whole rail is one link away.',
      rhythm: 'lead-pair',
    };
  }
  if (!category) return ALL_PIECES;
  return CATEGORY_IDENTITY[category] ?? {
    ...ALL_PIECES,
    slug: category,
    eyebrow: 'Category',
    display: category,
  };
}

/**
 * Row plan for the full-bleed alternating grid.
 *
 * Returns a list of row sizes; the page slices products into them in order.
 * The uniform card grid is gone entirely — the eye crosses the page rather
 * than scanning columns, and the rhythm differs per category so no two landing
 * pages scan the same way even with identical stock.
 */
export function rowPlan(rhythm: Rhythm, count: number): number[] {
  const cycles: Record<Rhythm, number[]> = {
    'lead-wide': [1, 2, 3, 2],
    'lead-pair': [2, 1, 2, 3],
    'lead-tall': [3, 1, 2, 2],
  };
  const cycle = cycles[rhythm];

  const rows: number[] = [];
  let placed = 0;
  let i = 0;
  while (placed < count) {
    const size = Math.min(cycle[i % cycle.length], count - placed);
    rows.push(size);
    placed += size;
    i++;
  }
  return rows;
}
