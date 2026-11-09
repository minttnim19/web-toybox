import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['scripts/**', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // core/ is pure game logic: it must stay free of DOM, canvas and window access
    // so it can run anywhere (tests, a server-side authority in phase 2, ...).
    files: ['widgets/*/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'requestAnimationFrame',
        'HTMLElement',
        'Element',
        'CanvasRenderingContext2D',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/platform/**', '**/render/**', '**/ui/**', '**/shared/**'],
              message: 'core/ must not depend on browser-facing code.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
