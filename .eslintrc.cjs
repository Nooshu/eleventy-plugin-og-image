module.exports = {
  root: true,
  extends: ['plugin:n/recommended', 'airbnb-base', 'prettier'],

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  rules: {
    'newline-before-return': 'error',
    'no-param-reassign': ['error', { props: false }],
    'import/prefer-default-export': 'off',
    'import/no-default-export': 'error',
    'import/extensions': [
      'error',
      {
        js: 'ignorePackages',
      },
    ],
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['./example/**', './example/.eleventy.js', './test/**', './scripts/**'] },
    ],
  },

  overrides: [
    {
      files: '.eleventy.js',
      rules: {
        'func-names': ['off'],
        'import/no-default-export': ['off'],
      },
    },
    {
      files: ['./example/**', './.prettierrc.js'],
      rules: {
        'import/no-default-export': ['off'],
        // Example emoji loader uses global fetch; available on the Node versions we run.
        'n/no-unsupported-features/node-builtins': ['error', { ignores: ['fetch'] }],
      },
    },
    {
      files: './test/**',
      rules: {
        'import/no-unresolved': ['off'],
      },
    },
  ],
};
