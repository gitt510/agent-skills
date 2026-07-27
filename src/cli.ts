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
};

type Skill = {
  name: string;
  source: string;
  hasManifest: boolean;
};

type Destination = {
  target: Target;
  skill: Skill;
  path: string;
  status: Status;
  kind: "missing" | "symlink" | "directory" | "file" | "other";
  linkTarget?: string;
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
};

type ApplyResult = {
  target: string;
  linked: number;
  relinked: number;
  pruned: number;
  unchanged: number;
};

const root = path.resolve(import.meta.dir, "..");
const sourceDirectory = path.join(root, "skills");
const userHome = process.env.HOME ?? homedir();
const targets: Target[] = [
  { key: "agents", label: "Agents", directory: path.join(userHome, ".config", "agents", "skills") },
  { key: "claude", label: "Claude Code", directory: path.join(userHome, ".claude", "skills") },
  { key: "codex", label: "Codex", directory: path.join(userHome, ".codex", "skills") },
];

const colorEnabled = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const paint = {
  bold: (text: string) => colorEnabled ? `\u001b[1m${text}\u001b[22m` : text,
  dim: (text: string) => colorEnabled ? `\u001b[2m${text}\u001b[22m` : text,
  red: (text: string) => colorEnabled ? `\u001b[31m${text}\u001b[39m` : text,
  green: (text: string) => colorEnabled ? `\u001b[32m${text}\u001b[39m` : text,
  yellow: (text: string) => colorEnabled ? `\u001b[33m${text}\u001b[39m` : text,
  cyan: (text: string) => colorEnabled ? `\u001b[36m${text}\u001b[39m` : text,
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

async function collectSkills(): Promise<Skill[]> {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    // A skill is a directory; whether it is a valid, loadable skill (has a
    // SKILL.md manifest) is a separate axis carried on hasManifest, not a filter.
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const source = path.join(sourceDirectory, entry.name);
    const hasManifest = Boolean(await lstatOrUndefined(path.join(source, "SKILL.md")));
    skills.push({ name: entry.name, source, hasManifest });
  }

  if (skills.length === 0) throw new Error(`No skills found in ${sourceDirectory}`);
  return skills;
}

async function inspectDestination(target: Target, skill: Skill): Promise<Destination> {
  const destinationPath = path.join(target.directory, skill.name);
  const metadata = await lstatOrUndefined(destinationPath);

  if (!metadata) {
    return {
      target,
      skill,
      path: destinationPath,
      status: "missing",
      kind: "missing",
    };
  }

  if (!metadata.isSymbolicLink()) {
    const kind = metadata.isDirectory() ? "directory" : metadata.isFile() ? "file" : "other";
    return { target, skill, path: destinationPath, status: "missing", kind };
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
  };
}

async function inspectTarget(target: Target, skills: Skill[]): Promise<TargetInventory> {
  const metadata = await lstatOrUndefined(target.directory);
  if (metadata && (!metadata.isDirectory() || metadata.isSymbolicLink())) {
    return {
      target,
      destinations: skills.map((skill) => ({
        target,
        skill,
        path: path.join(target.directory, skill.name),
        status: "missing",
        kind: "other",
      })),
      stale: [],
      external: [],
      invalid: "target must be a real directory",
    };
  }

  const destinations = await Promise.all(
    skills.map((skill) => inspectDestination(target, skill)),
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
  return {
    skills,
    targets: await Promise.all(selectedTargets.map((target) => inspectTarget(target, skills))),
  };
}

type DisplayStatus = "MANAGED" | "INCOMPLETE" | "MISSING" | "MISSING/STALE";

// Two independent axes decide a destination's label:
//   provenance/link (Destination.status) — is our symlink correctly in place?
//   validity (Skill.hasManifest)         — does the source hold a SKILL.md?
// A source that is ours but lacks a manifest is INCOMPLETE, never EXTERNAL.
function destinationStatus(destination: Destination, staleNames: Set<string>): DisplayStatus {
  if (!destination.skill.hasManifest) return "INCOMPLETE";
  if (destination.status === "ok") return "MANAGED";
  return staleNames.has(destination.skill.name) ? "MISSING/STALE" : "MISSING";
}

// What apply would do at one destination. Pruning of stale links is decided
// separately from TargetInventory.stale; a "link" here may follow that prune.
function decideDestination(
  destination: Destination,
  staleNames: Set<string>,
): "link" | "relink" | "unchanged" | "skip" {
  if (!destination.skill.hasManifest) return "skip";
  if (destination.status === "ok") return "unchanged";
  if (destination.kind === "symlink" && !staleNames.has(destination.skill.name)) return "relink";
  return "link";
}

type TargetCounts = {
  managed: number;
  incomplete: number;
  missing: number;
  stale: number;
  external: number;
};

function summarize(target: TargetInventory): TargetCounts {
  const staleNames = new Set(target.stale.map((entry) => entry.name));
  const counts: TargetCounts = {
    managed: 0,
    incomplete: 0,
    missing: 0,
    stale: target.stale.length,
    external: target.external.length,
  };
  for (const destination of target.destinations) {
    const status = destinationStatus(destination, staleNames);
    if (status === "MANAGED") counts.managed += 1;
    else if (status === "INCOMPLETE") {
      // Only a symlink actually installed against a manifest-less source is a
      // defect; a manifest-less repo dir never linked is a benign work-in-progress.
      if (destination.status === "ok") counts.incomplete += 1;
    } else counts.missing += 1;
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

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];

  for (const sourceLine of text.split("\n")) {
    let remaining = sourceLine;
    while (remaining.length > width) {
      const slash = remaining.lastIndexOf("/", width - 1);
      const cut = slash >= Math.floor(width / 2) ? slash + 1 : width;
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
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
    return Math.max(...values.flatMap((value) => value.split("\n").map((line) => line.length)));
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
        const paddedCell = ` ${rawCell.padEnd(columnWidths[columnIndex])} `;
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

function statusColor(status: string, text: string): string {
  if (status === "MANAGED") return paint.green(text);
  if (status === "INCOMPLETE") return paint.magenta(text);
  if (status === "MISSING") return paint.yellow(text);
  if (status.includes("STALE")) return paint.red(text);
  if (status === "EXTERNAL") return paint.cyan(text);
  return text;
}

function renderDoctor(current: Inventory): void {
  console.log(
    `${paint.bold("Agent skills")}  ${current.skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );
  console.log();

  const summaryRows = current.targets.map((target) => {
    const counts = summarize(target);
    return [
      target.target.label,
      String(counts.managed),
      String(counts.incomplete),
      String(counts.missing),
      String(counts.stale),
      String(counts.external),
    ];
  });
  console.log(renderTable(
    ["Target", "Managed", "Incomplete", "Missing", "Stale", "External"],
    summaryRows,
    undefined,
    (cell, _raw, _rowIndex, columnIndex) => {
      if (columnIndex === 1) return paint.green(cell);
      if (columnIndex === 2) return paint.magenta(cell);
      if (columnIndex === 3) return paint.yellow(cell);
      if (columnIndex === 4) return paint.red(cell);
      if (columnIndex === 5) return paint.cyan(cell);
      return cell;
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
      } else if (status === "INCOMPLETE" && destination.status === "ok") {
        rows.push(["INCOMPLETE", target.target.label, destination.skill.name, displayLinkTarget(destination)]);
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
      sum.incomplete += counts.incomplete;
      return sum;
    },
    { missing: 0, stale: 0, incomplete: 0 },
  );

  console.log();
  if (totals.missing > 0 || totals.stale > 0) {
    console.log(`${paint.yellow(paint.bold("PENDING CHANGES"))}  run ${paint.cyan("just apply")}`);
  }
  if (totals.incomplete > 0) {
    console.log(
      `${paint.magenta(paint.bold("INCOMPLETE"))}  ${totals.incomplete} installed skill(s) missing SKILL.md — add a manifest or remove`,
    );
  }
  if (totals.missing === 0 && totals.stale === 0 && totals.incomplete === 0) {
    console.log(paint.green(paint.bold("HEALTHY")));
  }
}

function renderList(current: Inventory): void {
  console.log(
    `${paint.bold("Agent skills")}  ${current.skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );
  console.log();

  const staleNames = current.targets.map(
    (target) => new Set(target.stale.map((entry) => entry.name)),
  );
  const rows = current.skills.map((skill, skillIndex) => [
    skill.name,
    ...current.targets.map((target, targetIndex) =>
      destinationStatus(target.destinations[skillIndex], staleNames[targetIndex]),
    ),
  ]);

  console.log(renderTable(
    ["Skill", ...current.targets.map((target) => target.target.label)],
    rows,
    undefined,
    (cell, _raw, rowIndex, columnIndex) =>
      columnIndex === 0 ? cell : statusColor(rows[rowIndex][columnIndex], cell),
  ));
}

function renderScan(current: Inventory): void {
  console.log(
    `${paint.bold("Agent skills")}  ${current.skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );

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
  PRUNE: paint.red,
  BLOCKED: paint.magenta,
};

function renderPlan(current: Inventory): void {
  console.log(
    `${paint.bold("Agent skills")}  ${current.skills.length} from ${paint.dim(displayPath(sourceDirectory))}`,
  );
  console.log();

  const rows: string[][] = [];
  const counts = { link: 0, relink: 0, unchanged: 0, prune: 0, blocked: 0 };

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
        destination.status === "missing" &&
        destination.kind !== "missing" &&
        destination.kind !== "symlink"
      ) {
        rows.push(["BLOCKED", label, destination.skill.name, displayLinkTarget(destination)]);
        counts.blocked += 1;
        continue;
      }
      const decision = decideDestination(destination, staleNames);
      if (decision === "skip") continue;
      counts[decision] += 1;
      if (decision === "unchanged") continue;
      rows.push([decision.toUpperCase(), label, destination.skill.name, displayLinkTarget(destination)]);
    }
  }

  if (rows.length === 0) {
    console.log(
      `${paint.green(paint.bold("NO CHANGES"))}  ${counts.unchanged} destination(s) already up to date`,
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
    counts.prune > 0 ? `${counts.prune} to prune` : "",
    `${counts.unchanged} unchanged`,
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
      } else if (decision === "relink") {
        await unlink(destination.path);
        await symlink(destination.skill.source, destination.path);
        relinked += 1;
      } else {
        await symlink(destination.skill.source, destination.path);
        linked += 1;
      }
    }

    results.push({ target: target.target.label, linked, relinked, pruned, unchanged });
  }
  return results;
}

function renderApply(results: ApplyResult[]): void {
  console.log(paint.bold("Apply complete"));
  console.log();
  console.log(renderTable(
    ["Target", "Linked", "Relinked", "Pruned", "Unchanged"],
    results.map((result) => [
      result.target,
      String(result.linked),
      String(result.relinked),
      String(result.pruned),
      String(result.unchanged),
    ]),
  ));
}

function printHelp(): void {
  console.log(`${paint.bold("agent-skills")} — reconcile and inspect repo-managed skills

${paint.bold("Usage")}
  agent-skills <command> [target]

${paint.bold("Commands")}
  doctor   Show a compact health summary and blocking details
  list     Show each repo skill's status across targets
  scan     List everything installed per target, including external skills
  plan     Preview what apply would change
  apply    Reconcile repo skills after a safe preflight
  help     Show this help

${paint.bold("Targets")}
  agents | claude | codex
  Omit target to process all three destinations.`);
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

  const targetArgument = Bun.argv[3]?.trim();
  if (Bun.argv.length > 4) throw new Error("Only one target may be specified");
  if (targetArgument && !targetKeys.includes(targetArgument as TargetKey)) {
    throw new Error(`Unknown target: ${targetArgument}; expected ${targetKeys.join(" | ")}`);
  }
  const selectedTargets = targetArgument
    ? targets.filter((target) => target.key === targetArgument)
    : targets;
  const current = await inventory(selectedTargets);
  if (command === "doctor") {
    renderDoctor(current);
    const unhealthy = current.targets.some((target) => {
      const counts = summarize(target);
      return counts.missing > 0 || counts.stale > 0 || counts.incomplete > 0;
    });
    if (unhealthy) process.exitCode = 1;
  } else if (command === "list") {
    renderList(current);
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
