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
 * WHILE THIS IS EMPTY the opening falls back to the featured products, so the
 * space is never blank. That fallback is a stopgap, not the intent — the
 * featured shots are catalogue photographs and some of them have children in
 * them.
 */
export const HERO_GARMENTS: string[] = [];
