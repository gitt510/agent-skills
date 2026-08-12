import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// The TUI uses indexed colors so the user's terminal palette decides the actual
// shade. Direct RGB foreground and background colors are banned outright.
const banDirectColor = {
  "no-restricted-syntax": [
    "error",
    {
      selector: String.raw`:matches(TemplateElement[value.raw=/[34]8;2;/], Literal[value=/[34]8;2;/])`,
      message: "Do not specify RGB colors; use an indexed terminal color.",
    },
  ],
};

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: banDirectColor,
  },
);
