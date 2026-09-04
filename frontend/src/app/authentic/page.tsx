import PolicyDoc, { type PolicySection } from '@/components/system/PolicyDoc';

/**
 * The authenticity guarantee.
 *
 * Content preserved: the six promises and the full eight-point pre-dispatch
 * checklist. What changed is that the checklist is now presented as a
 * checklist rather than as a grid of emoji cards — it is the most concrete
 * thing on the page and the previous layout buried it under decoration.
 *
 * This is the one policy page whose subject is craft rather than terms, so it
 * carries the brand voice more openly than the others. It is still a promise
 * the shop has to keep, which is why it lives in the same document form.
 */

export const metadata = {
  title: '100% Authentic Products — Vijey Textile',
  description:
    'Every product at Vijey Textile is sourced directly from trusted weavers and manufacturers. Guaranteed authentic.',
};

const SECTIONS: PolicySection[] = [
  {
    title: 'Where the pieces come from',
    clauses: [
      {
        heading: 'Direct from the makers',
        body: (
          <ul>
            <li>Weavers and manufacturers in Tamil Nadu and India&rsquo;s textile hubs.</li>
            <li>No middlemen. No markups.</li>
            <li>Fair trade, supporting the artisans themselves.</li>
          </ul>
        ),
      },
      {
        heading: 'Genuine fabric',
        body: (
          <ul>
            <li>Cotton, silk, georgette, crepe — all from certified suppliers.</li>
            <li>Labelled accurately on the product page.</li>
            <li>What the page says it is, is what it is.</li>
          </ul>
        ),
      },
    ],
  },
  {
    title: 'What we promise about the listing',
    clauses: [
      {
        heading: 'The colour',
        body: 'Photographed in natural light, never enhanced to flatter the cloth. Screens vary — no display renders a dyed silk exactly.',
      },
      {
        heading: 'The size',
        body: 'Measured from the actual garment, not a generic chart. In inches and centimetres. That is why sizes 12–40 mean something specific here.',
      },
    ],
  },
  {
    title: 'The eight checks before dispatch',
    clauses: [
      { heading: '01 · Composition', body: 'Fabric matches the description.' },
      { heading: '02 · Stitching', body: 'No loose threads or defects.' },
      { heading: '03 · Colour', body: 'Matches the photograph.' },
      { heading: '04 · Sizing', body: 'Correct against our size guide.' },
      { heading: '05 · Embellishment', body: 'Embroidery and beadwork secure.' },
      { heading: '06 · Fastenings', body: 'Zips, buttons and hooks work.' },
      { heading: '07 · Condition', body: 'No stains or storage damage.' },
      { heading: '08 · Presentation', body: 'Ironed, ready to wear.' },
    ],
  },
];

export default function AuthenticPage() {
  return (
    <PolicyDoc
      eyebrow="Authenticity"
      title="Everything here is what it says it is"
      standfirst="What we check, and what we guarantee."
      updated="3 September 2026"
      sections={SECTIONS}
      footnote="If a piece ever arrives and does not match its description, that is a genuine fault and we treat it as one — tell us and we will make it right."
    />
  );
}
