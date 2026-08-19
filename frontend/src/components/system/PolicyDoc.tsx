import type { ReactNode } from 'react';
import Reveal from '@/components/home/Reveal';
import PageShell from './PageShell';
import PageHeader from './PageHeader';
import { ActionLink } from './Action';

/**
 * The shape every policy document on the site takes.
 *
 * These pages are read in one of two ways and the design has to serve both: a
 * customer scanning for the one fact they came for ("how long does delivery
 * take"), and a customer reading the whole thing before they trust the shop
 * with money. So: numbered sections with the number set as a visible marker,
 * a standing measure of ~68 characters, and hairline rules between clauses.
 *
 * The numbering is not decoration. A policy genuinely is a numbered reference
 * document — support can say "point 4 of the shipping policy" and the customer
 * can find it. That is the test for whether a numbered marker earns its place,
 * and it is the reason the product grid does not get one.
 *
 * Replaces a layout of coloured pill badges, emoji and maroon gradient banners
 * that belonged to the previous design and had no equivalent here.
 */

export interface PolicyClause {
  heading: string;
  body: ReactNode;
}

export interface PolicySection {
  title: string;
  clauses: PolicyClause[];
}

export default function PolicyDoc({
  eyebrow,
  title,
  standfirst,
  updated,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  standfirst: ReactNode;
  /** Absolute date. "Recently updated" tells a reader nothing they can use. */
  updated: string;
  sections: PolicySection[];
  footnote?: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow={eyebrow} title={title} standfirst={standfirst}>
        <p className="text-rule uppercase text-paper-faint">Last updated · {updated}</p>
      </PageHeader>

      <div className="grid gap-x-16 gap-y-[4vh] lg:grid-cols-12">
        {/* Contents. Sticky on wide screens because these documents are long
            and a reader who scrolled to clause 9 should still be able to get
            back to clause 2 without scrolling up. */}
        <nav aria-label="Contents" className="lg:col-span-3">
          <div className="lg:sticky lg:top-32">
            <h2 className="text-rule uppercase text-paper-faint">Contents</h2>
            <ol className="mt-6 space-y-3">
              {sections.map((s, i) => (
                <li key={s.title}>
                  <a
                    href={`#section-${i + 1}`}
                    className="group flex items-baseline gap-3 text-sm text-paper-muted transition-colors duration-500 hover:text-paper motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
                  >
                    <span className="text-rule tabular-nums text-paper-faint transition-colors duration-500 group-hover:text-brass-bright motion-reduce:transition-none">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="lg:col-span-8 lg:col-start-5">
          {sections.map((section, i) => (
            <section
              key={section.title}
              id={`section-${i + 1}`}
              // scroll-mt clears the fixed overlay nav — without it an anchor
              // jump lands with the heading hidden underneath it.
              className="scroll-mt-32 border-t border-ink-edge/60 pt-10 first:border-t-0 first:pt-0 [&+section]:mt-[7vh]"
            >
              <Reveal>
                <div className="flex items-baseline gap-5">
                  <span className="text-rule tabular-nums text-brass-bright">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-display text-band font-light text-paper">{section.title}</h2>
                </div>
              </Reveal>

              <dl className="mt-9 space-y-9">
                {section.clauses.map((c) => (
                  <div key={c.heading}>
                    <dt className="text-rule uppercase text-paper-faint">{c.heading}</dt>
                    <dd className="mt-3 max-w-[68ch] text-lede text-paper-muted [&_a]:text-paper [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-normal [&_strong]:text-paper">
                      {c.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {footnote && (
            <div className="mt-[5vh] border-t border-ink-edge/60 pt-10">
              <p className="max-w-[62ch] text-lede text-paper-muted">{footnote}</p>
              <div className="mt-8">
                <ActionLink href="/support">Speak to us</ActionLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
