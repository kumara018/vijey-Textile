'use client';

import Link from 'next/link';
import { useCategories } from '@/lib/useCategories';

/**
 * The catalogue as a numbered index — the 404 page's way out.
 *
 * A client component only so it can read the workroom's category list. The
 * page around it stays on the server for its metadata; this was a hard-coded
 * list inside it, so a category the shop added never appeared here.
 */
export default function DepartmentIndex() {
  const { categories } = useCategories();

  return (
    <nav aria-label="Departments" className="mt-[5vh] border-t border-ink-edge/60 pt-10">
      <h2 className="text-rule uppercase text-paper-faint">Or go straight to</h2>
      <ul className="mt-8 grid gap-x-12 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
          <li key={c.name} className="border-b border-ink-edge/40">
            <Link
              href={`/products?category=${encodeURIComponent(c.name)}`}
              className="group flex items-baseline gap-5 py-4 transition-colors duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
            >
              {/* Numbered because the catalogue genuinely has a canonical
                  order — the one the workroom sets, which the Index overlay and
                  footer follow too. Positions in a sequence, not decoration. */}
              <span className="text-rule tabular-nums text-paper-faint transition-colors duration-500 group-hover:text-brass-bright">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span className="block font-display text-2xl font-light text-paper-muted transition-colors duration-500 group-hover:text-paper">
                  {c.name}
                </span>
                {c.eyebrow && (
                  <span className="mt-1 block text-rule uppercase text-paper-faint/70">
                    {c.eyebrow}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
