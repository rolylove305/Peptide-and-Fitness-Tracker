import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://app.biotrackai.online/',
      },
    },
    setupFiles: ['./src/test/setupTests.ts'],
    restoreMocks: true,
  },
});
