import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@input': path.resolve(__dirname, 'src/input'),
      '@flow': path.resolve(__dirname, 'src/flow'),
      '@gameplay': path.resolve(__dirname, 'src/gameplay'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@audio': path.resolve(__dirname, 'src/audio'),
      '@persistence': path.resolve(__dirname, 'src/persistence'),
      '@definitions': path.resolve(__dirname, 'src/definitions'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
