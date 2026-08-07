import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// Every color in the TUI stays a 16-color slot so the user's terminal theme
// decides the actual shade. 256-color and truecolor parameters pin a fixed
// palette and are banned outright.
const banFixedPalettes = {
  "no-restricted-syntax": [
    "error",
    {
      selector: String.raw`TemplateElement[value.raw=/[34]8;[25];/]`,
      message: "256-color / truecolor SGR is banned; use an ANSI-16 slot so the terminal theme decides the shade.",
    },
    {
      selector: String.raw`Literal[value=/[34]8;[25];/]`,
      message: "256-color / truecolor SGR is banned; use an ANSI-16 slot so the terminal theme decides the shade.",
    },
  ],
};

// Raw escape sequences live only in cli.ts's paint definition; everything
// else goes through paint.* so styling stays in one place.
const banRawEscapes = {
  "no-restricted-syntax": [
    "error",
    ...banFixedPalettes["no-restricted-syntax"].slice(1),
    {
      selector: String.raw`TemplateElement[value.raw=/\\u001b|\\x1b/i]`,
      message: "Do not write escape sequences directly; go through paint.*.",
    },
    {
      selector: String.raw`Literal[raw=/\\u001b|\\x1b/i]`,
      message: "Do not write escape sequences directly; go through paint.*.",
    },
  ],
};

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: banFixedPalettes,
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/cli.ts"],
    rules: banRawEscapes,
  },
);
