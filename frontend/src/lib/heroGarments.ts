/**
 * The photographs that appear in the opening.
 *
 * WHY THIS FILE EXISTS RATHER THAN THE OPENING PICKING FOR ITSELF. Two
 * requirements the code cannot satisfy on its own:
 *
 *   GARMENTS, NOT PEOPLE. The brief is the clothes rather than a child
 *   wearing them. Nothing here can look at a photograph and tell whether
 *   somebody is in it, so the only honest way to guarantee it is for a person
 *   to choose the files.
 *
 *   NOT THE CATALOGUE PHOTOGRAPHS. The product shots are taken to sit in a
 *   grid at postage-stamp size. An opening is nearly a metre wide on a
 *   desktop, and a catalogue shot blown up that far looks like exactly what it
 *   is. The opening wants photographs taken for it.
 *
 * HOW TO USE IT
 *
 *   1. Put the images in `frontend/public/hero/`.
 *   2. List them below, in the order they should appear.
 *
 *      export const HERO_GARMENTS = [
 *        '/hero/lehenga-ivory.jpg',
 *        '/hero/pattu-pavadai-green.jpg',
 *        '/hero/frock-blush.jpg',
 *      ];
 *
 * WHAT TO SHOOT. Portrait, roughly 3:4 — that is the shape of the frame, so a
 * 3:4 photograph fills it with nothing cropped away. The garment whole, on a
 * hanger or laid flat, with room around it. Around 1200px on the long edge is
 * plenty; anything larger is bandwidth a customer on a phone pays for and
 * cannot see.
 *
 * THIS LIST IS NOW THE OPENING. While it has entries the product fallback is
 * not used at all, so what shows here is exactly what is listed and in this
 * order — nothing arrives because a piece happened to be marked featured.
 *
 * Cloudinary URLs are fine to list directly; they are already the canonical
 * address of that image. To swap one, replace the line. To reorder, move it.
 * To go back to picking automatically from featured products, empty the array.
 */
export const HERO_GARMENTS: string[] = [
  // Leghenga 24NJA — the SEATED shot, not the standing one.
  //
  // The opening used to take each product's FIRST image, and for this piece
  // that is the standing photograph. The one that was asked for is the second
  // in the same product's gallery: seated on the bench, the tiered skirt open
  // so the floral border reads, the palace arches behind. Same garment, better
  // picture, and there was no way to say "the second image of this product"
  // except by naming it here.
  'https://res.cloudinary.com/dovkyontt/image/upload/v1787054336/vijeytextile/products/snlcmdum0d8zqkgnz8s1.jpg',

  // Multi colour Top and pant set
  'https://res.cloudinary.com/dovkyontt/image/upload/v1786527625/vijeytextile/products/oehrqs7lbrsoif0lfjg3.jpg',

  // Aari Pattu knots model frock
  'https://res.cloudinary.com/dovkyontt/image/upload/v1786526535/vijeytextile/products/t6jrzmdfyp8pms3hjdw2.jpg',
];
