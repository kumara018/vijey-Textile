import type { ReactNode } from 'react';
import PageShell from './PageShell';
import PageHeader from './PageHeader';
import Disclosure from './Disclosure';
import { ActionLink } from './Action';

/**
 * The shape every policy document on the site takes.
 *
 * OPENS AS A LIST OF QUESTIONS, NOT AS A DOCUMENT. Every section used to be
 * expanded at once, so the shipping policy was five screens of prose and the
 * cancellation policy eight. A customer arriving with one question — how long
 * have I got, who pays the postage — had to read past everything else to reach
 * it. The first screen is now the figures that matter and a short stack of
 * headings; you open the one you want.
 *
 * That is the same reasoning as the support page, and this uses the same
 * component, which brings its deep-link behaviour with it: a link to
 * /cancellation#not-eligible opens that section and scrolls to it instead of
 * landing on a shut heading.
 *
 * THE CONTENTS LIST IS GONE, and it went for the reason it existed. It was a
 * sticky column repeating all eight section titles beside eight section
 * titles — the same information twice, once as navigation and once as the
 * document. Closed disclosures ARE the contents: the titles are the only
 * thing on screen, and clicking one is what the sidebar link did anyway.
 *
 * THE FIGURES GO ABOVE, IN `summary`. The one or two numbers a page exists to
 * answer — 5–7 days, flat ₹49, 1 hour / 4 hours / 12 hours — belong on the
 * first screen, set large, before anything is opened. Pages without a figure
 * worth leading on simply omit it.
 */

export interface PolicyClause {
  heading: string;
  body: ReactNode;
}

export interface PolicySection {
  title: string;
  clauses: PolicyClause[];
}

/** `Who pays the shipping` → `who-pays-the-shipping`, for deep links. */
function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PolicyDoc({
  eyebrow,
  title,
  standfirst,
  updated,
  summary,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  standfirst: ReactNode;
  /** Absolute date. "Recently updated" tells a reader nothing they can use. */
  updated: string;
  /** The figures this page exists to answer, shown before anything is opened. */
  summary?: ReactNode;
  sections: PolicySection[];
  footnote?: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow={eyebrow} title={title} standfirst={standfirst} scale="doc">
        <p className="text-rule uppercase text-paper-faint">Last updated · {updated}</p>
      </PageHeader>

      {summary && <div className="mb-[clamp(3rem,9vh,6rem)]">{summary}</div>}

      <div className="max-w-[76ch]">
        {sections.map((section, i) => (
          <Disclosure
            key={section.title}
            id={slugify(section.title)}
            index={String(i + 1).padStart(2, '0')}
            title={section.title}
          >
            <dl className="mt-2 space-y-8">
              {section.clauses.map((c) => (
                <div key={c.heading}>
                  <dt className="text-rule uppercase text-paper-faint">{c.heading}</dt>
                  <dd className="mt-3 max-w-[62ch] leading-relaxed text-paper-muted [&_a]:text-brass-bright [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-paper [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
                    {c.body}
                  </dd>
                </div>
              ))}
            </dl>
          </Disclosure>
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
    </PageShell>
  );
}
