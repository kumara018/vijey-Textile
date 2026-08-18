/**
 * Temporary hero fixture.
 *
 * A real garment from the live catalogue, hardcoded so the hero can be
 * evaluated as designed while the local backend is offline. These are the
 * production Cloudinary URLs the live site already serves — not stock imagery
 * and not a placeholder.
 *
 * REMOVE THIS once the hero reads from the products query in every
 * environment. `HERO_FIXTURE` is only consulted when the query returns nothing;
 * a live product always wins. It exists so an empty catalogue shows a composed
 * frame rather than an empty state, never to override real data.
 */
export interface HeroFixture {
  id: number;
  name: string;
  category: string;
  price: number;
  images: string[];
}

export const HERO_FIXTURE: HeroFixture = {
  id: 28,
  name: 'Aari Pattu knots model frock',
  category: 'Baby Frocks',
  price: 999,
  images: [
    'https://res.cloudinary.com/dovkyontt/image/upload/v1786526535/vijeytextile/products/t6jrzmdfyp8pms3hjdw2.jpg',
  ],
};
