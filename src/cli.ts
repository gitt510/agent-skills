#!/usr/bin/env bun

import { lstat, mkdir, readdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const targetKeys = ["agents", "claude", "codex"] as const;
type TargetKey = (typeof targetKeys)[number];
type Status = "ok" | "missing";

type Target = {
  key: TargetKey;
  label: string;
  directory: string;
  // Claude Code can load this repository twice: once through these symlinks and
  // once as an installed plugin. Only a plugin-aware target has to divide the
  // skill set with that second route.
  pluginAware: boolean;
};

// What the enabled Claude Code plugin built from this repository provides.
// "none" also covers "no Claude Code CLI on PATH", which is indistinguishable
// from an uninstalled plugin as far as duplicate registration goes.
type PluginCoverage =
  | { kind: "none" }
  | { kind: "covered"; names: Set<string>; version: string }
  | { kind: "unknown"; reason: string };

type Skill = {
  name: string;
  source: string;
};

type Destination = {
  target: Target;
  skill: Skill;
  path: string;
  status: Status;
  kind: "missing" | "symlink" | "directory" | "file" | "other";
  linkTarget?: string;
  // The plugin already serves this skill here, so the symlink layer must not.
  delegated: boolean;
};

type InstalledEntry = {
  name: string;
  path: string;
  kind: "symlink" | "directory";
  linkTarget?: string;
};

type TargetInventory = {
  target: Target;
  destinations: Destination[];
  stale: InstalledEntry[];
  external: InstalledEntry[];
  invalid?: string;
};

type Inventory = {
  skills: Skill[];
  targets: TargetInventory[];
  coverage: PluginCoverage;
};

type ApplyResult = {
  target: string;
  linked: number;
  relinked: number;
  unlinked: number;
  pruned: number;
  unchanged: number;
};

const root = path.resolve(import.meta.dir, "..");
const sourceDirectory = path.join(root, "skills");
const userHome = process.env.HOME ?? homedir();
const marketplaceManifest = path.join(root, ".claude-plugin", "marketplace.json");
const targets: Target[] = [
  {
    key: "agents",
    label: "Agents",
    directory: path.join(userHome, ".config", "agents", "skills"),
    pluginAware: false,
  },
  {
    key: "claude",
    label: "Claude Code",
    directory: path.join(userHome, ".claude", "skills"),
    pluginAware: true,
  },
  {
    key: "codex",
    label: "Codex",
    directory: path.join(userHome, ".codex", "skills"),
    pluginAware: false,
  },
];

const colorEnabled = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const paint = {
  bold: (text: string) => colorEnabled ? `\u001b[1m${text}\u001b[22m` : text,
  dim: (text: string) => colorEnabled ? `\u001b[2m${text}\u001b[22m` : text,
  red: (text: string) => colorEnabled ? `\u001b[31m${text}\u001b[39m` : text,
  green: (text: string) => colorEnabled ? `\u001b[32m${text}\u001b[39m` : text,
  yellow: (text: string) => colorEnabled ? `\u001b[33m${text}\u001b[39m` : text,
  cyan: (text: string) => colorEnabled ? `\u001b[36m${text}\u001b[39m` : text,
  brightYellow: (text: string) => colorEnabled ? `\u001b[93m${text}\u001b[39m` : text,
  magenta: (text: string) => colorEnabled ? `\u001b[35m${text}\u001b[39m` : text,
};

async function lstatOrUndefined(filePath: string) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function realpathOrUndefined(filePath: string) {
  try {
    return await realpath(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP") return undefined;
    throw error;
  }
}

async function readdirOrUndefined(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

// The plugin names this repository publishes, read from our own manifest so the
// installed plugin id never has to be hardcoded here.
async function publishedPluginNames(): Promise<string[]> {
  const manifest = await Bun.file(marketplaceManifest).json();
  const plugins = (manifest as { plugins?: unknown }).plugins;
  if (!Array.isArray(plugins)) throw new Error(`${marketplaceManifest} has no plugins array`);
  return plugins
    .map((plugin) => (plugin as { name?: unknown }).name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
}

// Ask Claude Code itself which of our plugins is installed and enabled, then read
// the skill set out of its install path. `claude plugin list --json` is the public
// interface for this; the plugin cache and settings files are not.
async function detectPluginCoverage(): Promise<PluginCoverage> {
  let published: string[];
  try {
    published = await publishedPluginNames();
  } catch (error) {
    return { kind: "unknown", reason: (error as Error).message };
  }
  if (published.length === 0) return { kind: "none" };

  let output: string;
  let exitCode: number;
  try {
    const child = Bun.spawn(["claude", "plugin", "list", "--json"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  } catch {
    // No Claude Code CLI on PATH: nothing can be loading the plugin either.
    return { kind: "none" };
  }
  if (exitCode !== 0) {
    return { kind: "unknown", reason: `claude plugin list --json exited ${exitCode}` };
  }

  let entries: unknown;
  try {
    entries = JSON.parse(output);
  } catch {
    return { kind: "unknown", reason: "claude plugin list --json returned unparsable output" };
  }
  if (!Array.isArray(entries)) {
    return { kind: "unknown", reason: "claude plugin list --json returned a non-array" };
  }

  const names = new Set<string>();
  const versions: string[] = [];
  for (const entry of entries as Array<Record<string, unknown>>) {
    if (entry?.enabled !== true) continue;
    const [pluginName] = String(entry.id ?? "").split("@");
    if (!published.includes(pluginName)) continue;
    const installPath = typeof entry.installPath === "string" ? entry.installPath : "";
    if (!installPath) continue;
    const contents = await readdirOrUndefined(path.join(installPath, "skills"));
    if (!contents) continue;
    versions.push(typeof entry.version === "string" ? entry.version : "unknown");
    for (const item of contents) {
      if (item.isDirectory() && !item.name.startsWith(".")) names.add(item.name);
    }
  }

  if (names.size === 0) return { kind: "none" };
  return { kind: "covered", names, version: versions.join(", ") };
}

async function collectSkills(): Promise<Skill[]> {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    // A skill is a directory holding a SKILL.md. A directory without one cannot
    // load, so it is not a skill and never reaches a target; whether a manifest
    // is well-formed is asserted by the test suite, not reported at runtime.
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const source = path.join(sourceDirectory, entry.name);
    if (!(await lstatOrUndefined(path.join(source, "SKILL.md")))) continue;
    skills.push({ name: entry.name, source });
  }

  if (skills.length === 0) throw new Error(`No skills found in ${sourceDirectory}`);
  return skills;
}

async function inspectDestination(
  target: Target,
  skill: Skill,
  delegated: boolean,
): Promise<Destination> {
  const destinationPath = path.join(target.directory, skill.name);
  const metadata = await lstatOrUndefined(destinationPath);

  if (!metadata) {
    return {
      target,
      skill,
      path: destinationPath,
      status: "missing",
      kind: "missing",
      delegated,
    };
  }

  if (!metadata.isSymbolicLink()) {
    const kind = metadata.isDirectory() ? "directory" : metadata.isFile() ? "file" : "other";
    return { target, skill, path: destinationPath, status: "missing", kind, delegated };
  }

  const linkTarget = await readlink(destinationPath);
  const [resolvedDestination, resolvedSource] = await Promise.all([
    realpathOrUndefined(destinationPath),
    realpath(skill.source),
  ]);

  return {
    target,
    skill,
    path: destinationPath,
    status: resolvedDestination === resolvedSource ? "ok" : "missing",
    kind: "symlink",
    linkTarget,
    delegated,
  };
}

function blockedTarget(target: Target, skills: Skill[], invalid: string): TargetInventory {
  return {
    target,
    destinations: skills.map((skill) => ({
      target,
      skill,
      path: path.join(target.directory, skill.name),
      status: "missing",
      kind: "other",
      delegated: false,
    })),
    stale: [],
    external: [],
    invalid,
  };
}

async function inspectTarget(
  target: Target,
  skills: Skill[],
  coverage: PluginCoverage,
): Promise<TargetInventory> {
  if (target.pluginAware && coverage.kind === "unknown") {
    return blockedTarget(target, skills, `plugin state unknown: ${coverage.reason}`);
  }
  const delegatedNames = target.pluginAware && coverage.kind === "covered"
    ? coverage.names
    : new Set<string>();

  const metadata = await lstatOrUndefined(target.directory);
  if (metadata && (!metadata.isDirectory() || metadata.isSymbolicLink())) {
    return blockedTarget(target, skills, "target must be a real directory");
  }

  const destinations = await Promise.all(
    skills.map((skill) => inspectDestination(target, skill, delegatedNames.has(skill.name))),
  );
  const sourceNames = new Set(skills.map((skill) => skill.name));
  const stale: InstalledEntry[] = [];
  const external: InstalledEntry[] = [];

  if (metadata) {
    const entries = await readdir(target.directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const entryPath = path.join(target.directory, entry.name);
      if (entry.isSymbolicLink()) {
        const installed = {
          name: entry.name,
          path: entryPath,
          kind: "symlink" as const,
          linkTarget: await readlink(entryPath),
        };
        if (!(await realpathOrUndefined(entryPath))) {
          stale.push(installed);
          continue;
        }
        if (!sourceNames.has(entry.name)) external.push(installed);
        continue;
      }

      if (sourceNames.has(entry.name)) continue;
      external.push({ name: entry.name, path: entryPath, kind: "directory" });
    }
  }

  stale.sort((left, right) => left.name.localeCompare(right.name));
  external.sort((left, right) => left.name.localeCompare(right.name));
  return { target, destinations, stale, external };
}

async function inventory(selectedTargets: Target[]): Promise<Inventory> {
  const skills = await collectSkills();
  const coverage: PluginCoverage = selectedTargets.some((target) => target.pluginAware)
    ? await detectPluginCoverage()
    : { kind: "none" };
  return {
    skills,
    coverage,
    targets: await Promise.all(
      selectedTargets.map((target) => inspectTarget(target, skills, coverage)),
    ),
  };
}

type DisplayStatus =
  | "MANAGED"
  | "MISSING"
  | "MISSING/STALE"
  | "PLUGIN"
  | "DUPLICATE"
  | "STALE"
  | "EXTERNAL";

// Every label describes one destination on two axes:
//   ownership (Destination.delegated) — is this name ours, or the plugin's?
//   usability (Destination.status)    — does our symlink resolve to the source?
// Under delegation the plain skill name belongs to the plugin, so our own link
// there is a DUPLICATE and anything else is simply not ours.
function destinationStatus(destination: Destination, staleNames: Set<string>): DisplayStatus {
  if (destination.delegated) {
    if (staleNames.has(destination.skill.name)) return "STALE";
    if (destination.status === "ok") return "DUPLICATE";
    return destination.kind === "missing" ? "PLUGIN" : "EXTERNAL";
  }
  if (destination.status === "ok") return "MANAGED";
  return staleNames.has(destination.skill.name) ? "MISSING/STALE" : "MISSING";
}

// What apply would do at one destination. Pruning of stale links is decided
// separately from TargetInventory.stale; a "link" here may follow that prune.
function decideDestination(
  destination: Destination,
  staleNames: Set<string>,
): "link" | "relink" | "unlink" | "unchanged" | "skip" {
  if (destination.delegated) {
    // Converge on one registration: drop our link once the plugin covers it, and
    // never touch a destination the plugin owns but we did not create.
    if (staleNames.has(destination.skill.name)) return "skip";
    return destination.status === "ok" ? "unlink" : "skip";
  }
  if (destination.status === "ok") return "unchanged";
  if (destination.kind === "symlink" && !staleNames.has(destination.skill.name)) return "relink";
  return "link";
}

type TargetCounts = {
  managed: number;
  missing: number;
  duplicate: number;
  plugin: number;
  stale: number;
  external: number;
};

function summarize(target: TargetInventory): TargetCounts {
  const staleNames = new Set(target.stale.map((entry) => entry.name));
  const counts: TargetCounts = {
    managed: 0,
    missing: 0,
    duplicate: 0,
    plugin: 0,
    stale: target.stale.length,
    external: target.external.length,
  };
  for (const destination of target.destinations) {
    const status = destinationStatus(destination, staleNames);
    if (status === "MANAGED") counts.managed += 1;
    else if (status === "PLUGIN") counts.plugin += 1;
    else if (status === "DUPLICATE") counts.duplicate += 1;
    // A delegated destination reported STALE is already counted in target.stale.
    else if (status === "STALE") continue;
    else if (status === "EXTERNAL") counts.external += 1;
    else counts.missing += 1;
  }
  return counts;
}

function displayPath(filePath: string): string {
  if (filePath === userHome) return "~";
  if (filePath.startsWith(`${userHome}${path.sep}`)) return `~${filePath.slice(userHome.length)}`;
  return filePath;
}

function displayLinkTarget(destination: Destination): string {
  if (destination.kind === "missing") return "—";
  if (destination.kind !== "symlink") return `(${destination.kind})`;
  const linkTarget = destination.linkTarget ?? "";
  return path.isAbsolute(linkTarget) ? displayPath(linkTarget) : linkTarget;
}

function displayInstalledTarget(entry: InstalledEntry): string {
  if (entry.kind === "directory") return "(directory)";
  const linkTarget = entry.linkTarget ?? "";
  return path.isAbsolute(linkTarget) ? displayPath(linkTarget) : linkTarget;
}

function terminalWidth(): number {
  return Math.max(72, process.stdout.columns || Number(process.env.COLUMNS) || 100);
}

// Widths are display columns, not code units: CJK text occupies two columns
// per character, and length-based padding would push the table borders apart.
function cellWidth(text: string): number {
  return Bun.stringWidth(text);
}

function padCell(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - cellWidth(text)));
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];

  for (const sourceLine of text.split("\n")) {
    let remaining = sourceLine;
    while (cellWidth(remaining) > width) {
      // largest prefix that fits the column, counted in display columns
      let fit = 0;
      let used = 0;
      for (const character of remaining) {
        const characterWidth = cellWidth(character);
        if (used + characterWidth > width) break;
        used += characterWidth;
        fit += character.length;
      }
      if (fit === 0) fit = 1;

      // break at the last space or after the last slash, unless that leaves
      // the line shorter than half the column; then hard-cut at the edge
      const prefix = remaining.slice(0, fit);
      const space = prefix.lastIndexOf(" ");
      const slash = prefix.lastIndexOf("/") + 1;
      const soft = Math.max(space, slash);
      const cut = soft >= Math.floor(width / 2) ? soft : fit;
      lines.push(remaining.slice(0, cut).trimEnd());
      remaining = remaining.slice(cut).trimStart();
    }
    lines.push(remaining);
  }

  return lines;
}

type CellFormatter = (
  paddedCell: string,
  rawCell: string,
  rowIndex: number,
  columnIndex: number,
) => string;

function renderTable(
  headers: string[],
  rows: string[][],
  widths?: number[],
  formatCell?: CellFormatter,
): string {
  const columnWidths = widths ?? headers.map((header, columnIndex) => {
    const values = [header, ...rows.map((row) => row[columnIndex] ?? "")];
    return Math.max(...values.flatMap((value) => value.split("\n").map((line) => cellWidth(line))));
  });
  const horizontal = (left: string, middle: string, right: string) =>
    left + columnWidths.map((width) => "─".repeat(width + 2)).join(middle) + right;
  const output: string[] = [horizontal("┌", "┬", "┐")];

  const renderRow = (cells: string[], rowIndex: number, header = false) => {
    const wrapped = cells.map((cell, columnIndex) => wrapText(cell, columnWidths[columnIndex]));
    const height = Math.max(...wrapped.map((lines) => lines.length));

    for (let lineIndex = 0; lineIndex < height; lineIndex += 1) {
      const rendered = wrapped.map((lines, columnIndex) => {
        const rawCell = lines[lineIndex] ?? "";
        const paddedCell = ` ${padCell(rawCell, columnWidths[columnIndex])} `;
        if (header) return paint.bold(paddedCell);
        return formatCell?.(paddedCell, rawCell, rowIndex, columnIndex) ?? paddedCell;
      });
      output.push(`│${rendered.join("│")}│`);
    }
  };

  renderRow(headers, -1, true);
  output.push(horizontal("├", "┼", "┤"));
  rows.forEach((row, rowIndex) => {
    renderRow(row, rowIndex);
    if (rowIndex < rows.length - 1) output.push(horizontal("├", "┼", "┤"));
  });
  output.push(horizontal("└", "┴", "┘"));
  return output.join("\n");
}

// One severity ladder for every rendering:
//   red     — broken right now (a dead link, or one name registered twice)
//   yellow  — apply resolves it without a decision
//   magenta — apply refuses to act until a human moves something aside
//   green   — steady state this repository owns
//   cyan    — informational; apply never touches it
//   bright yellow — served by the plugin, not this repository's links
//   dim     — a count of zero
function statusColor(status: string, text: string): string {
  if (status === "MANAGED") return paint.green(text);
  if (status === "MISSING") return paint.yellow(text);
  if (status === "DUPLICATE") return paint.red(text);
  if (status.includes("STALE")) return paint.red(text);
  if (status === "EXTERNAL") return paint.cyan(text);
  if (status === "PLUGIN") return paint.brightYellow(text);
  return text;
}

// The same ladder for the doctor summary, whose columns carry no status text.
const summaryColumnColor: Array<((text: string) => string) | undefined> = [
  undefined, // Target
  paint.green, // Managed
  paint.yellow, // Missing
  paint.red, // Duplicate
  paint.brightYellow, // Plugin
  paint.red, // Stale
  paint.cyan, // External
];

// One header for every command: what this repository holds, and what the Claude
// Code plugin is already serving out of it.
function renderHeader(current: Inventory): void {
  console.log(
    `${paint.bold("Agent skills")}  ${current.skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );
  const coverage = current.coverage;
  if (coverage.kind === "covered") {
    console.log(
      `${paint.bold("Claude Code plugin")}  ${coverage.version} serves ${coverage.names.size} skill(s); the claude target links only the rest`,
    );
  } else if (coverage.kind === "unknown") {
    console.log(`${paint.yellow(paint.bold("PLUGIN STATE UNKNOWN"))}  ${coverage.reason}`);
  }
}

function renderDoctor(current: Inventory): void {
  renderHeader(current);
  console.log();

  const summaryRows = current.targets.map((target) => {
    const counts = summarize(target);
    return [
      target.target.label,
      String(counts.managed),
      String(counts.missing),
      String(counts.duplicate),
      String(counts.plugin),
      String(counts.stale),
      String(counts.external),
    ];
  });
  console.log(renderTable(
    ["Target", "Managed", "Missing", "Duplicate", "Plugin", "Stale", "External"],
    summaryRows,
    undefined,
    (cell, raw, _rowIndex, columnIndex) => {
      const color = summaryColumnColor[columnIndex];
      if (!color) return cell;
      // Severity belongs to the count, not the column: zero is never a finding.
      return raw.trim() === "0" ? paint.dim(cell) : color(cell);
    },
  ));

  const details = current.targets.flatMap((target) => {
    if (target.invalid) {
      return [["MISSING", target.target.label, "target directory", target.invalid]];
    }
    const staleNames = new Set(target.stale.map((entry) => entry.name));
    const rows: string[][] = [];
    for (const destination of target.destinations) {
      if (destination.kind === "missing") continue;
      const status = destinationStatus(destination, staleNames);
      if (status === "MISSING") {
        rows.push(["MISSING", target.target.label, destination.skill.name, displayLinkTarget(destination)]);
      } else if (status === "DUPLICATE") {
        rows.push(["DUPLICATE", target.target.label, destination.skill.name, displayLinkTarget(destination)]);
      }
    }
    for (const entry of target.stale) {
      rows.push(["STALE", target.target.label, entry.name, displayInstalledTarget(entry)]);
    }
    return rows;
  });

  if (details.length > 0) {
    const width = terminalWidth();
    const statusWidth = 10;
    const targetWidth = 11;
    const skillWidth = Math.min(25, Math.max(19, Math.floor(width * 0.26)));
    const currentWidth = Math.max(21, width - statusWidth - targetWidth - skillWidth - 13);
    console.log();
    console.log(paint.bold("Details"));
    console.log(renderTable(
      ["Status", "Target", "Skill", "Current"],
      details,
      [statusWidth, targetWidth, skillWidth, currentWidth],
      (cell, raw, rowIndex, columnIndex) =>
        columnIndex === 0 ? statusColor(details[rowIndex][0], cell) : raw === "" ? paint.dim(cell) : cell,
    ));
  }

  const totals = current.targets.reduce(
    (sum, target) => {
      const counts = summarize(target);
      sum.missing += counts.missing;
      sum.stale += counts.stale;
      sum.duplicate += counts.duplicate;
      return sum;
    },
    { missing: 0, stale: 0, duplicate: 0 },
  );

  console.log();
  if (totals.missing > 0 || totals.stale > 0 || totals.duplicate > 0) {
    console.log(`${paint.yellow(paint.bold("PENDING CHANGES"))}  run ${paint.cyan("just apply")}`);
  }
  if (totals.duplicate > 0) {
    console.log(
      `${paint.red(paint.bold("DUPLICATE"))}  ${totals.duplicate} skill(s) registered by both the plugin and a symlink — apply removes the symlink`,
    );
  }
  if (totals.missing === 0 && totals.stale === 0 && totals.duplicate === 0) {
    console.log(paint.green(paint.bold("HEALTHY")));
  }
}

// The description is the one manifest field the CLI displays. Frontmatter is
// hand-written YAML, so this reads only the shapes the repository uses — an
// inline scalar or a folded/literal block — and folds the value to one line.
async function readSkillDescription(skill: Skill): Promise<string> {
  const text = await Bun.file(path.join(skill.source, "SKILL.md")).text();
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return "";

  const collected: string[] = [];
  let inDescription = false;
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;
    if (inDescription) {
      if (line.trim() === "") continue;
      if (!/^\s/.test(line)) break;
      collected.push(line.trim());
      continue;
    }
    const match = line.match(/^description:\s*(.*)$/);
    if (!match) continue;
    inDescription = true;
    const inline = match[1].trim();
    if (inline && !["|", "|-", ">", ">-"].includes(inline)) {
      collected.push(inline.replace(/^["']|["']$/g, ""));
      break;
    }
  }
  return collected.join(" ");
}

// list is the inventory view: what skills this repository holds, straight from
// the manifests. Installation state belongs to scan, plan, and doctor.
async function renderList(skills: Skill[]): Promise<void> {
  console.log(
    `${paint.bold("Agent skills")}  ${skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );
  console.log();

  const rows = await Promise.all(
    skills.map(async (skill) => [skill.name, await readSkillDescription(skill)]),
  );
  const width = terminalWidth();
  const skillWidth = Math.max("Skill".length, ...rows.map((row) => row[0].length));
  const descriptionWidth = Math.max(30, width - skillWidth - 7);
  console.log(renderTable(["Skill", "Description"], rows, [skillWidth, descriptionWidth]));
}

function renderScan(current: Inventory): void {
  renderHeader(current);

  for (const target of current.targets) {
    const width = terminalWidth();
    const skillWidth = Math.min(25, Math.max(20, Math.floor(width * 0.28)));
    const statusWidth = 13;
    const linkWidth = Math.max(25, width - skillWidth - statusWidth - 10);
    const staleNames = new Set(target.stale.map((entry) => entry.name));
    const sourceNames = new Set(current.skills.map((skill) => skill.name));
    const rows = [
      ...target.destinations.map((destination) => [
        destination.skill.name,
        destinationStatus(destination, staleNames),
        displayLinkTarget(destination),
      ]),
      ...target.external.map((entry) => [
        entry.name,
        "EXTERNAL",
        displayInstalledTarget(entry),
      ]),
      ...target.stale
        .filter((entry) => !sourceNames.has(entry.name))
        .map((entry) => [
          entry.name,
          "STALE",
          displayInstalledTarget(entry),
        ]),
    ].sort((left, right) => left[0].localeCompare(right[0]));

    console.log();
    console.log(`${paint.bold(target.target.label)}  ${paint.dim(displayPath(target.target.directory))}`);
    console.log(renderTable(
      ["Skill", "Status", "Symlink target"],
      rows,
      [skillWidth, statusWidth, linkWidth],
      (cell, _raw, rowIndex, columnIndex) =>
        columnIndex === 1 ? statusColor(rows[rowIndex][1], cell) : cell,
    ));
  }
}

const actionColor: Record<string, (text: string) => string> = {
  LINK: paint.green,
  RELINK: paint.yellow,
  UNLINK: paint.red,
  PRUNE: paint.red,
  BLOCKED: paint.magenta,
};

function renderPlan(current: Inventory): void {
  renderHeader(current);
  console.log();

  const rows: string[][] = [];
  const counts = { link: 0, relink: 0, unlink: 0, unchanged: 0, prune: 0, plugin: 0, blocked: 0 };

  for (const target of current.targets) {
    const label = target.target.label;
    if (target.invalid) {
      rows.push(["BLOCKED", label, "target directory", target.invalid]);
      counts.blocked += 1;
      continue;
    }
    const staleNames = new Set(target.stale.map((entry) => entry.name));
    for (const entry of target.stale) {
      rows.push(["PRUNE", label, entry.name, displayInstalledTarget(entry)]);
      counts.prune += 1;
    }
    for (const destination of target.destinations) {
      if (
        !destination.delegated &&
        destination.status === "missing" &&
        destination.kind !== "missing" &&
        destination.kind !== "symlink"
      ) {
        rows.push(["BLOCKED", label, destination.skill.name, displayLinkTarget(destination)]);
        counts.blocked += 1;
        continue;
      }
      const decision = decideDestination(destination, staleNames);
      if (decision === "skip") {
        // Delegated destinations are a deliberate no-op, not an absence; say so
        // rather than letting the summary read as an empty target.
        if (destination.delegated) counts.plugin += 1;
        continue;
      }
      counts[decision] += 1;
      if (decision === "unchanged") continue;
      rows.push([decision.toUpperCase(), label, destination.skill.name, displayLinkTarget(destination)]);
    }
  }

  if (rows.length === 0) {
    const served = counts.plugin > 0 ? `, ${counts.plugin} served by the plugin` : "";
    console.log(
      `${paint.green(paint.bold("NO CHANGES"))}  ${counts.unchanged} destination(s) already up to date${served}`,
    );
    return;
  }

  const width = terminalWidth();
  const actionWidth = 8;
  const targetWidth = 11;
  const skillWidth = Math.min(25, Math.max(19, Math.floor(width * 0.26)));
  const currentWidth = Math.max(21, width - actionWidth - targetWidth - skillWidth - 13);
  console.log(renderTable(
    ["Action", "Target", "Skill", "Current"],
    rows,
    [actionWidth, targetWidth, skillWidth, currentWidth],
    (cell, raw, rowIndex, columnIndex) =>
      columnIndex === 0
        ? (actionColor[rows[rowIndex][0]] ?? ((text: string) => text))(cell)
        : raw === "" ? paint.dim(cell) : cell,
  ));

  console.log();
  const summary = [
    counts.link > 0 ? `${counts.link} to link` : "",
    counts.relink > 0 ? `${counts.relink} to relink` : "",
    counts.unlink > 0 ? `${counts.unlink} to unlink` : "",
    counts.prune > 0 ? `${counts.prune} to prune` : "",
    `${counts.unchanged} unchanged`,
    counts.plugin > 0 ? `${counts.plugin} served by the plugin` : "",
  ].filter(Boolean).join(", ");
  console.log(`${paint.bold("Plan")}  ${summary}`);
  if (counts.blocked > 0) {
    console.log(
      `${paint.magenta(paint.bold("BLOCKED"))}  apply will refuse until non-symlink entries are moved away`,
    );
    process.exitCode = 1;
  } else {
    console.log(paint.dim(`Run ${paint.cyan("just apply")} to make these changes`));
  }
}

function hasNonSymlinkObstructions(current: Inventory): boolean {
  return current.targets.some(
    (target) => target.invalid || target.destinations.some(
      (destination) =>
        !destination.delegated &&
        destination.status === "missing" &&
        destination.kind !== "missing" &&
        destination.kind !== "symlink",
    ),
  );
}

async function applyChanges(current: Inventory): Promise<ApplyResult[]> {
  if (hasNonSymlinkObstructions(current)) {
    throw new Error("Refusing to replace non-symlink entries; no changes were made");
  }

  const results: ApplyResult[] = [];
  for (const target of current.targets) {
    let linked = 0;
    let relinked = 0;
    let unlinked = 0;
    let pruned = 0;
    let unchanged = 0;
    const stale = new Set(target.stale.map((entry) => entry.name));
    await mkdir(target.target.directory, { recursive: true });

    for (const entry of target.stale) {
      await unlink(entry.path);
      pruned += 1;
    }

    for (const destination of target.destinations) {
      const decision = decideDestination(destination, stale);
      // skip: a manifest-less dir is not a loadable skill; never link it, and
      // leave any pre-existing link untouched so a human decides its fate.
      if (decision === "skip") continue;
      if (decision === "unchanged") {
        unchanged += 1;
      } else if (decision === "unlink") {
        await unlink(destination.path);
        unlinked += 1;
      } else if (decision === "relink") {
        await unlink(destination.path);
        await symlink(destination.skill.source, destination.path);
        relinked += 1;
      } else {
        await symlink(destination.skill.source, destination.path);
        linked += 1;
      }
    }

    results.push({ target: target.target.label, linked, relinked, unlinked, pruned, unchanged });
  }
  return results;
}

function renderApply(results: ApplyResult[]): void {
  console.log(paint.bold("Apply complete"));
  console.log();
  console.log(renderTable(
    ["Target", "Linked", "Relinked", "Unlinked", "Pruned", "Unchanged"],
    results.map((result) => [
      result.target,
      String(result.linked),
      String(result.relinked),
      String(result.unlinked),
      String(result.pruned),
      String(result.unchanged),
    ]),
  ));
}

function printHelp(): void {
  console.log(`${paint.bold("agent-skills")} — reconcile and inspect repo-managed skills

${paint.bold("Usage")}
  agent-skills <command> [--target <target>]

${paint.bold("Commands")}
  doctor   Show a compact health summary and blocking details
  list     Show each repo skill with its manifest description
  scan     List everything installed per target, including external skills
  plan     Preview what apply would change
  apply    Reconcile repo skills after a safe preflight
  help     Show this help

${paint.bold("Options")}
  -t, --target <target>   Limit to one destination: agents | claude | codex
                          Omit to process all three; list reads the repository
                          only and takes no target
  -h, --help              Show this help

${paint.bold("Claude Code plugin")}
  While this repository's plugin is installed and enabled, the claude target owns
  only the skills the plugin does not serve. apply links those, and removes its
  own links once the plugin covers them, so no skill is registered twice.`);
}

async function main(): Promise<void> {
  const command = Bun.argv[2] ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (!new Set(["doctor", "list", "scan", "plan", "apply"]).has(command)) {
    printHelp();
    throw new Error(`Unknown command: ${command}`);
  }

  const rest = Bun.argv.slice(3);
  let targetArgument: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const token = rest[index];
    if (token === "--help" || token === "-h") {
      printHelp();
      return;
    }
    let value: string | undefined;
    if (token === "--target" || token === "-t") value = rest[++index];
    else if (token.startsWith("--target=")) value = token.slice("--target=".length);
    else {
      const hint = targetKeys.includes(token as TargetKey) ? `; use --target ${token}` : "";
      throw new Error(`Unknown argument: ${token}${hint}`);
    }
    value = value?.trim();
    if (!value) throw new Error("--target requires a value");
    if (targetArgument) throw new Error("Only one target may be specified");
    if (!targetKeys.includes(value as TargetKey)) {
      throw new Error(`Unknown target: ${value}; expected ${targetKeys.join(" | ")}`);
    }
    targetArgument = value;
  }
  const selectedTargets = targetArgument
    ? targets.filter((target) => target.key === targetArgument)
    : targets;
  if (command === "list") {
    if (targetArgument) throw new Error("list reads the repository only; --target does not apply");
    await renderList(await collectSkills());
    return;
  }
  const current = await inventory(selectedTargets);
  if (command === "doctor") {
    renderDoctor(current);
    const unhealthy = current.targets.some((target) => {
      const counts = summarize(target);
      return counts.missing > 0 || counts.stale > 0 || counts.duplicate > 0;
    });
    if (unhealthy) process.exitCode = 1;
  } else if (command === "scan") {
    renderScan(current);
  } else if (command === "plan") {
    renderPlan(current);
  } else if (hasNonSymlinkObstructions(current)) {
    renderDoctor(current);
    throw new Error("Refusing to replace non-symlink entries; no changes were made");
  } else {
    renderApply(await applyChanges(current));
  }
}

main().catch((error) => {
  console.error();
  console.error(paint.red(`Error: ${(error as Error).message}`));
  process.exitCode = 1;
});
