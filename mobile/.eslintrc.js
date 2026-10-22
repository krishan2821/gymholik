module.exports = {
  root: true,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/theme/palette*', '**/palette*'],
            message: 'Direct imports of raw palette files outside the theme folder are forbidden. Use useTheme() or import from the theme facade.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/theme/**'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
