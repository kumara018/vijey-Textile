import type { ReactNode } from 'react';
import Reveal from '@/components/home/Reveal';

/**
 * The masthead of a route: eyebrow, display line, standfirst.
 *
 * Every rebuilt page opens this way, which is what makes navigating between
 * them feel like one publication rather than a set of screens. The eyebrow is
 * the only place a route names itself — there is no page-title bar and no
 * breadcrumb, because the display line already says where you are.
 *
 * `as` exists because exactly one page per document should carry the h1, and
 * on some routes (an order detail) the true h1 is the order number further
 * down rather than the section name.
 */
export default function PageHeader({
  eyebrow,
  title,
  standfirst,
  as: Heading = 'h1',
  children,
}: {
  eyebrow?: string;
  title: string;
  standfirst?: ReactNode;
  as?: 'h1' | 'h2';
  /** Actions, filters, or a count — sits under the standfirst. */
  children?: ReactNode;
}) {
  return (
    <header className="mb-[8vh]">
      {eyebrow && (
        <Reveal>
          <p className="mb-7 text-rule uppercase text-brass-bright">{eyebrow}</p>
        </Reveal>
      )}

      <Reveal delay={90}>
        <Heading className="max-w-[20ch] font-display text-chapter font-light text-paper">
          {title}
        </Heading>
      </Reveal>

      {standfirst && (
        <Reveal delay={180}>
          <p className="mt-7 max-w-[54ch] text-lede text-paper-muted">{standfirst}</p>
        </Reveal>
      )}

      {children && (
        <Reveal delay={250}>
          <div className="mt-10">{children}</div>
        </Reveal>
      )}
    </header>
  );
}
