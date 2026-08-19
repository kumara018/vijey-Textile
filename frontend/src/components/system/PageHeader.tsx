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
 *
 * `scale` exists because a masthead and a document title are not the same
 * object. `display` is the editorial step the shelf and the front page want.
 * `doc` is for pages somebody opens with a question — the policies, the help
 * page — where a 96px headline is the thing standing between them and the
 * answer. Same component, same rhythm, one step down in scale and margin.
 */
export default function PageHeader({
  eyebrow,
  title,
  standfirst,
  as: Heading = 'h1',
  scale = 'display',
  children,
}: {
  eyebrow?: string;
  title: string;
  standfirst?: ReactNode;
  as?: 'h1' | 'h2';
  /** `display` for editorial routes, `doc` for pages that answer a question. */
  scale?: 'display' | 'doc';
  /** Actions, filters, or a count — sits under the standfirst. */
  children?: ReactNode;
}) {
  const doc = scale === 'doc';

  return (
    <header className={doc ? 'mb-[4vh]' : 'mb-[8vh]'}>
      {eyebrow && (
        <Reveal>
          <p className={`text-rule uppercase text-brass-bright ${doc ? 'mb-3' : 'mb-7'}`}>{eyebrow}</p>
        </Reveal>
      )}

      <Reveal delay={90}>
        <Heading
          className={`font-display font-light text-paper ${
            doc ? 'max-w-[34ch] text-doc' : 'max-w-[20ch] text-chapter'
          }`}
        >
          {title}
        </Heading>
      </Reveal>

      {standfirst && (
        <Reveal delay={180}>
          {/* On a document the standfirst carries the ANSWER, so it gets a
              reading measure rather than a narrow editorial column. */}
          <p className={`text-lede text-paper-muted ${doc ? 'mt-4 max-w-[72ch]' : 'mt-7 max-w-[54ch]'}`}>
            {standfirst}
          </p>
        </Reveal>
      )}

      {children && (
        <Reveal delay={250}>
          <div className={doc ? 'mt-6' : 'mt-10'}>{children}</div>
        </Reveal>
      )}
    </header>
  );
}
