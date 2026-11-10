/** @type {import('prettier').Config} */
export default {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  plugins: ['prettier-plugin-jsdoc', 'prettier-plugin-jinja-template'],
  overrides: [
    {
      files: ['**/*.njk'],
      options: {
        parser: 'jinja-template',
      },
    },
  ],
};
