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

type DistributionResult = {
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
    if (!entry.isDirectory()) continue;
    const source = path.join(sourceDirectory, entry.name);
    if (!(await lstatOrUndefined(path.join(source, "SKILL.md")))) continue;
    skills.push({ name: entry.name, source });
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

function countStatuses(target: TargetInventory): Record<Status, number> {
  const counts: Record<Status, number> = { ok: 0, missing: 0 };
  for (const destination of target.destinations) counts[destination.status] += 1;
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
    const counts = countStatuses(target);
    return [
      target.target.label,
      String(counts.ok),
      String(counts.missing),
      String(target.stale.length),
      String(target.external.length),
    ];
  });
  console.log(renderTable(
    ["Target", "Managed", "Missing", "Stale", "External"],
    summaryRows,
    undefined,
    (cell, _raw, _rowIndex, columnIndex) => {
      if (columnIndex === 1) return paint.green(cell);
      if (columnIndex === 2) return paint.yellow(cell);
      if (columnIndex === 3) return paint.red(cell);
      if (columnIndex === 4) return paint.cyan(cell);
      return cell;
    },
  ));

  const details = current.targets.flatMap((target) => [
    ...(target.invalid
      ? [["MISSING", target.target.label, "target directory", target.invalid]]
      : target.destinations
          .filter(
            (destination) =>
              destination.status === "missing" &&
              destination.kind !== "missing" &&
              !target.stale.some((entry) => entry.name === destination.skill.name),
          )
          .map((destination) => [
            "MISSING",
            target.target.label,
            destination.skill.name,
            displayLinkTarget(destination),
          ])),
    ...target.stale.map((entry) => [
      "STALE",
      target.target.label,
      entry.name,
      displayInstalledTarget(entry),
    ]),
  ]);

  if (details.length > 0) {
    const width = terminalWidth();
    const statusWidth = 8;
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
      const counts = countStatuses(target);
      sum.missing += counts.missing;
      sum.stale += target.stale.length;
      return sum;
    },
    { missing: 0, stale: 0 },
  );

  console.log();
  if (totals.missing > 0 || totals.stale > 0) {
    console.log(`${paint.yellow(paint.bold("NEEDS DISTRIBUTION"))}  run ${paint.cyan("just distribute")}`);
  } else {
    console.log(paint.green(paint.bold("HEALTHY")));
  }
}

function renderList(current: Inventory): void {
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
        destination.status === "missing" && staleNames.has(destination.skill.name)
          ? "MISSING/STALE"
          : destination.status === "ok" ? "MANAGED" : "MISSING",
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

async function applyDistribution(current: Inventory): Promise<DistributionResult[]> {
  if (hasNonSymlinkObstructions(current)) {
    throw new Error("Refusing to replace non-symlink entries; no changes were made");
  }

  const results: DistributionResult[] = [];
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
      if (destination.status === "ok") {
        unchanged += 1;
      } else if (destination.kind === "symlink" && !stale.has(destination.skill.name)) {
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

function renderDistribution(results: DistributionResult[]): void {
  console.log(paint.bold("Distribution complete"));
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
  console.log(`${paint.bold("agent-skills")} — distribute and inspect repo-managed skills

${paint.bold("Usage")}
  agent-skills <command> [target]

${paint.bold("Commands")}
  doctor       Show a compact health summary and blocking details
  list         List repo and external skills with symlink targets
  distribute   Reconcile repo skills after a safe preflight
  help         Show this help

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
  if (!new Set(["doctor", "list", "distribute"]).has(command)) {
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
      const counts = countStatuses(target);
      return counts.missing > 0 || target.stale.length > 0;
    });
    if (unhealthy) process.exitCode = 1;
  } else if (command === "list") {
    renderList(current);
  } else if (hasNonSymlinkObstructions(current)) {
    renderDoctor(current);
    throw new Error("Refusing to replace non-symlink entries; no changes were made");
  } else {
    renderDistribution(await applyDistribution(current));
  }
}

main().catch((error) => {
  console.error();
  console.error(paint.red(`Error: ${(error as Error).message}`));
  process.exitCode = 1;
});
