const js = require("@eslint/js");
const globals = require("globals");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
    js.configs.recommended,
    { 
        files: ["**/*.{js,mjs,cjs}"], 
        plugins: { js }, 
        extends: ["js/recommended"],
        languageOptions: { globals: globals.node },
        rules: {
            "indent": ["error", 4],
        },
    }
]);
