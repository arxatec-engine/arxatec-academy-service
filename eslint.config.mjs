import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'src/generated/**',
      'coverage/**',
      'node_modules/**',
      'prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.tests.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Exports con nombre: el export default esta prohibido (01_reglas_globales.md 2).',
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'Usa un objeto as const en src/constants en lugar de un enum de TypeScript.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/utils',
              message: 'Importa el submodulo directo: @/utils/errors, @/utils/build_http_response.',
            },
            {
              name: '@/constants',
              message: 'Importa el submodulo directo: @/constants/error_codes, @/constants/auth.',
            },
            {
              name: '@/infrastructure',
              message:
                'Importa el submodulo directo: @/infrastructure/jwt, @/infrastructure/email/send_email.',
            },
            {
              name: '@/types',
              message: 'Importa el submodulo directo: @/types/authenticated_user.',
            },
          ],
        },
      ],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['src/**/test/**/*.ts', 'src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
