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
        heading: 'Direct from weavers',
        body: 'We work directly with skilled weavers and manufacturers in Tamil Nadu and the major textile hubs across India. No middlemen, no markups.',
      },
      {
        heading: 'Genuine fabrics',
        body: 'Cotton, silk, georgette, crepe — every fabric is sourced from certified suppliers and labelled accurately on its product page. What the page says it is, is what it is.',
      },
      {
        heading: 'Ethical sourcing',
        body: 'We support local artisans and fair trade practices. Shopping here supports real craftspeople and their livelihoods.',
      },
    ],
  },
  {
    title: 'What we promise about the listing',
    clauses: [
      {
        heading: 'True-to-photo colours',
        body: 'We photograph in natural light to show the most accurate colour we can. Slight screen variation is unavoidable — no display renders a dyed silk exactly — but the photograph is never enhanced to flatter the cloth.',
      },
      {
        heading: 'Accurate sizing',
        body: 'Our size guide, in inches and centimetres, is calibrated against actual garment measurements rather than generic standards. That is why sizes 12–40 mean something specific here.',
      },
      {
        heading: 'Every piece inspected',
        body: 'Each garment goes through a quality check before it reaches the store — fabric quality, stitching, colour fastness and finishing.',
      },
    ],
  },
  {
    title: 'The eight checks before dispatch',
    clauses: [
      { heading: '01 · Composition', body: 'Fabric composition matches the product description.' },
      { heading: '02 · Stitching', body: 'No loose threads or stitching defects.' },
      { heading: '03 · Colour', body: 'Colour matches the product photograph.' },
      { heading: '04 · Sizing', body: 'Correct sizing as per our size guide.' },
      { heading: '05 · Embellishment', body: 'Embroidery and embellishments are secure.' },
      { heading: '06 · Fastenings', body: 'Zippers, buttons and hooks all function properly.' },
      { heading: '07 · Condition', body: 'No stains or damage from storage.' },
      { heading: '08 · Presentation', body: 'Properly ironed and presented, so it arrives ready to wear.' },
    ],
  },
];

export default function AuthenticPage() {
  return (
    <PolicyDoc
      eyebrow="Authenticity"
      title="Everything here is what it says it is"
      standfirst="A shop that sells heirloom pieces cannot afford to be vague about what they are made of. This is what we check, and what we guarantee."
      updated="21 May 2026"
      sections={SECTIONS}
      footnote="If a piece ever arrives and does not match its description, that is a genuine fault and we treat it as one — tell us and we will make it right."
    />
  );
}
