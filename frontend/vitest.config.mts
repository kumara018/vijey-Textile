import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Node environment, not jsdom, and that is deliberate.
 *
 * Everything worth testing without a browser here is a pure function. Pulling
 * in jsdom would let component tests be written that assert against a fake DOM
 * with no compositor, no GPU and no layout — which is precisely the class of
 * "passing test, broken page" this project has already been bitten by. The
 * things that need a real browser get one: the failure drills and the keyboard
 * and reduced-motion passes run against GPU Chrome and a live server.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // A test run that reports success having found nothing is a lie.
    passWithNoTests: false,
  },
});
