import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const skillsDirectory = path.join(root, "skills");
const skillNames = (await readdir(skillsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

function parseFrontmatter(markdown: string): Record<string, unknown> {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") throw new Error("SKILL.md must start with YAML frontmatter");

  const closingFence = lines.indexOf("---", 1);
  if (closingFence === -1) throw new Error("SKILL.md frontmatter is not closed");

  const value = Bun.YAML.parse(lines.slice(1, closingFence).join("\n"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SKILL.md frontmatter must be a YAML mapping");
  }
  return value as Record<string, unknown>;
}

describe("skill manifests", () => {
  test("repository contains at least one skill directory", () => {
    expect(skillNames.length).toBeGreaterThan(0);
  });

  for (const skillName of skillNames) {
    test(`${skillName} has a valid matching SKILL.md`, async () => {
      const manifestPath = path.join(skillsDirectory, skillName, "SKILL.md");
      const metadata = parseFrontmatter(await readFile(manifestPath, "utf8"));

      expect(metadata.name).toBe(skillName);
      expect(typeof metadata.description).toBe("string");
      expect((metadata.description as string).trim().length).toBeGreaterThan(0);
    });
  }
});
