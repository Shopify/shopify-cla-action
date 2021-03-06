module.exports = {
  extends: [
    "plugin:@shopify/typescript",
    "plugin:@shopify/typescript-type-checking",
    "plugin:@shopify/prettier",
  ],
  parserOptions: {
    project: "tsconfig.json"
  },
  rules: {
    "@typescript-eslint/naming-convention": "off",
  },
};
