import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  realpath,
  rm,
  symlink,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const cli = path.join(root, "src", "cli.ts");
const temporaryHomes: string[] = [];

async function createHome(): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), "agent-skills-test-"));
  temporaryHomes.push(home);
  return home;
}

// PATH holds only the temporary home's bin so plugin detection sees exactly the
// `claude` these tests install, never the one on the developer's machine.
async function writeFakeClaude(home: string, script: string): Promise<void> {
  const bin = path.join(home, "bin");
  await mkdir(bin, { recursive: true });
  const executable = path.join(bin, "claude");
  await Bun.write(executable, script);
  await chmod(executable, 0o755);
}

async function installFakePlugin(
  home: string,
  skillNames: string[],
  options: { enabled?: boolean } = {},
): Promise<void> {
  const manifest = await Bun.file(path.join(root, ".claude-plugin", "marketplace.json")).json();
  const installPath = path.join(home, "plugin-cache");
  for (const name of skillNames) {
    await mkdir(path.join(installPath, "skills", name), { recursive: true });
  }
  const entries = [
    {
      id: `${manifest.plugins[0].name}@${manifest.name}`,
      version: "test-version",
      scope: "user",
      enabled: options.enabled ?? true,
      installPath,
    },
  ];
  // echo, not cat: PATH holds only the fake bin, so the script gets no coreutils
  await writeFakeClaude(home, `#!/bin/sh\necho '${JSON.stringify(entries)}'\n`);
}

function run(command: string, home: string, ...extra: string[]) {
  const result = Bun.spawnSync({
    cmd: [process.execPath, cli, command, ...extra],
    env: {
      ...process.env,
      HOME: home,
      PATH: path.join(home, "bin"),
      NO_COLOR: "1",
      COLUMNS: "90",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  return {
    exitCode: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

afterEach(async () => {
  await Promise.all(temporaryHomes.splice(0).map((home) => rm(home, { recursive: true })));
});

describe("agent-skills CLI", () => {
  test("applies missing skills and reports healthy", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const destination = path.join(home, ".claude", "skills", "tmux");
    expect(await realpath(destination)).toBe(await realpath(path.join(root, "skills", "tmux")));
    expect(await realpath(path.join(home, ".config", "agents", "skills", "tmux"))).toBe(
      await realpath(path.join(root, "skills", "tmux")),
    );

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).toContain("HEALTHY");

    const list = run("list", home);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("Skill");
    expect(list.stdout).toContain("Agents");
    expect(list.stdout).toContain("Claude Code");
    expect(list.stdout).toContain("Codex");
    expect(list.stdout).toContain("tmux");
    expect(list.stdout).toContain("MANAGED");
    expect(list.stdout).not.toContain("Symlink target");

    const scan = run("scan", home);
    expect(scan.exitCode).toBe(0);
    expect(scan.stdout).toContain("Symlink target");
    expect(scan.stdout).toContain("tmux");
    expect(scan.stdout).toContain("MANAGED");
  });

  test("makes no changes when a non-symlink occupies a destination", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const skills = path.join(home, ".claude", "skills");
    await unlink(path.join(skills, "tmux"));
    await mkdir(path.join(skills, "tmux"));
    await unlink(path.join(skills, "yt-digest"));

    const result = run("apply", home);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no changes were made");
    expect(await lstat(path.join(skills, "yt-digest")).catch(() => undefined)).toBeUndefined();
  });

  test("relinks a symlink that points somewhere else", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const destination = path.join(home, ".claude", "skills", "tmux");
    const otherSkill = path.join(home, "other-tmux");
    await mkdir(otherSkill);
    await unlink(destination);
    await symlink(otherSkill, destination);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("MISSING");

    const result = run("apply", home);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Relinked");
    expect(await realpath(destination)).toBe(await realpath(path.join(root, "skills", "tmux")));
  });

  test("scan lists external entries and their symlink targets", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    await mkdir(path.join(home, ".claude", "external-source"));
    await symlink(
      "../external-source",
      path.join(home, ".claude", "skills", "external-skill"),
    );
    await mkdir(path.join(home, ".codex", "skills", "local-skill"));

    const scan = run("scan", home);
    expect(scan.exitCode).toBe(0);
    expect(scan.stdout).toContain("external-skill");
    expect(scan.stdout).toContain("../external-source");
    expect(scan.stdout).toContain("local-skill");
    expect(scan.stdout).toContain("(directory)");
    expect(scan.stdout).toContain("EXTERNAL");

    // list stays repo-centric: external entries never appear in the matrix
    const list = run("list", home);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).not.toContain("external-skill");
    expect(list.stdout).not.toContain("local-skill");
  });

  test("reports and prunes external dangling symlinks", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const stale = path.join(home, ".claude", "skills", "removed-skill");
    await symlink(path.join(home, "missing-external-skill"), stale);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("STALE");
    expect(doctor.stdout).toContain("removed-skill");

    const scan = run("scan", home);
    expect(scan.stdout).toContain("removed-skill");
    expect(scan.stdout).toContain("STALE");
    expect(scan.stdout).toContain("~/missing-external-skill");

    expect(run("apply", home).exitCode).toBe(0);
    expect(await lstat(stale).catch(() => undefined)).toBeUndefined();
  });

  test("repairs a repo skill that is both missing and stale", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const destination = path.join(home, ".codex", "skills", "tmux");
    await unlink(destination);
    await symlink(path.join(home, "missing-tmux"), destination);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("STALE");

    const list = run("list", home);
    expect(list.stdout).toContain("MISSING");

    expect(run("apply", home).exitCode).toBe(0);
    expect(await realpath(destination)).toBe(await realpath(path.join(root, "skills", "tmux")));
  });

  test("creates absolute symlinks in all three destinations", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const destinations = [
      path.join(home, ".claude", "skills", "tmux"),
      path.join(home, ".codex", "skills", "tmux"),
      path.join(home, ".config", "agents", "skills", "tmux"),
    ];
    for (const destination of destinations) {
      expect(path.isAbsolute(await readlink(destination))).toBeTrue();
    }
  });

  test("limits every command to the selected target", async () => {
    const home = await createHome();
    const apply = run("apply", home, "--target", "agents");
    expect(apply.exitCode).toBe(0);
    expect(await realpath(path.join(home, ".config", "agents", "skills", "tmux"))).toBe(
      await realpath(path.join(root, "skills", "tmux")),
    );
    expect(await lstat(path.join(home, ".claude")).catch(() => undefined)).toBeUndefined();
    expect(await lstat(path.join(home, ".codex")).catch(() => undefined)).toBeUndefined();

    const doctor = run("doctor", home, "--target", "agents");
    const output = doctor.stdout;
    expect(doctor.exitCode).toBe(0);
    expect(output).toContain("Agents");
    expect(output).not.toContain("Claude Code");
    expect(output).not.toContain("Codex");

    const list = run("list", home, "--target", "agents");
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("Agents");
    expect(list.stdout).not.toContain("Claude Code");
    expect(list.stdout).not.toContain("Codex");

    const scan = run("scan", home, "--target", "agents");
    expect(scan.exitCode).toBe(0);
    expect(scan.stdout).toContain("Agents");
    expect(scan.stdout).not.toContain("Claude Code");
    expect(scan.stdout).not.toContain("Codex");
  });

  test("ignores a directory without SKILL.md", async () => {
    const home = await createHome();
    const fixture = path.join(root, "skills", "zz-no-manifest-fixture");
    await mkdir(fixture, { recursive: true });
    try {
      // a directory that cannot load is not a skill: never linked, never reported
      expect(run("apply", home, "--target", "claude").exitCode).toBe(0);
      const doctor = run("doctor", home, "--target", "claude");
      expect(doctor.exitCode).toBe(0);
      expect(doctor.stdout).toContain("HEALTHY");
      expect(doctor.stdout).not.toContain("zz-no-manifest-fixture");
      expect(await lstat(path.join(home, ".claude", "skills", "zz-no-manifest-fixture")).catch(() => undefined)).toBeUndefined();

      const list = run("list", home, "--target", "claude");
      expect(list.stdout).not.toContain("zz-no-manifest-fixture");

      // a link installed by hand is simply a name this repository does not own
      await symlink(fixture, path.join(home, ".claude", "skills", "zz-no-manifest-fixture"));
      const scan = run("scan", home, "--target", "claude");
      expect(scan.stdout).toContain("zz-no-manifest-fixture");
      expect(scan.stdout).toContain("EXTERNAL");
      expect(run("doctor", home, "--target", "claude").exitCode).toBe(0);

      // apply leaves it alone
      expect(run("apply", home, "--target", "claude").exitCode).toBe(0);
      expect(await lstat(path.join(home, ".claude", "skills", "zz-no-manifest-fixture")).catch(() => undefined)).toBeDefined();
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  test("plan previews pending changes without applying them", async () => {
    const home = await createHome();
    const plan = run("plan", home);
    expect(plan.exitCode).toBe(0);
    expect(plan.stdout).toContain("LINK");
    expect(plan.stdout).toContain("tmux");
    expect(plan.stdout).toContain("to link");
    expect(await lstat(path.join(home, ".claude", "skills", "tmux")).catch(() => undefined)).toBeUndefined();

    expect(run("apply", home).exitCode).toBe(0);
    const settled = run("plan", home);
    expect(settled.exitCode).toBe(0);
    expect(settled.stdout).toContain("NO CHANGES");
  });

  test("plan flags non-symlink obstructions as blocked", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);

    const skills = path.join(home, ".claude", "skills");
    await unlink(path.join(skills, "tmux"));
    await mkdir(path.join(skills, "tmux"));

    const plan = run("plan", home);
    expect(plan.exitCode).toBe(1);
    expect(plan.stdout).toContain("BLOCKED");
    expect(plan.stdout).toContain("tmux");
  });

  test("leaves plugin-served skills to the plugin in the claude target", async () => {
    const home = await createHome();
    await installFakePlugin(home, ["tmux"]);

    expect(run("apply", home).exitCode).toBe(0);
    const claudeSkills = path.join(home, ".claude", "skills");
    expect(await lstat(path.join(claudeSkills, "tmux")).catch(() => undefined)).toBeUndefined();
    expect(await realpath(path.join(claudeSkills, "yt-digest"))).toBe(
      await realpath(path.join(root, "skills", "yt-digest")),
    );
    // other targets know nothing about the plugin
    expect(await realpath(path.join(home, ".codex", "skills", "tmux"))).toBe(
      await realpath(path.join(root, "skills", "tmux")),
    );

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).toContain("HEALTHY");
    expect(doctor.stdout).toContain("test-version serves 1 skill(s)");

    const list = run("list", home, "-t", "claude");
    expect(list.stdout).toContain("PLUGIN");

    const plan = run("plan", home);
    expect(plan.stdout).toContain("NO CHANGES");
    expect(plan.stdout).toContain("1 served by the plugin");
  });

  test("removes its own link once the plugin serves that skill", async () => {
    const home = await createHome();
    expect(run("apply", home).exitCode).toBe(0);
    const destination = path.join(home, ".claude", "skills", "tmux");
    expect(await lstat(destination).catch(() => undefined)).toBeDefined();

    await installFakePlugin(home, ["tmux"]);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("DUPLICATE");
    expect(doctor.stdout).toContain("tmux");

    const plan = run("plan", home);
    expect(plan.exitCode).toBe(0);
    expect(plan.stdout).toContain("UNLINK");
    expect(plan.stdout).toContain("1 to unlink");

    const apply = run("apply", home);
    expect(apply.exitCode).toBe(0);
    expect(apply.stdout).toContain("Unlinked");
    expect(await lstat(destination).catch(() => undefined)).toBeUndefined();
    // only the served skill goes; the rest of the claude target stays linked
    expect(await realpath(path.join(home, ".claude", "skills", "yt-digest"))).toBe(
      await realpath(path.join(root, "skills", "yt-digest")),
    );
    expect(run("doctor", home).exitCode).toBe(0);
  });

  test("ignores a disabled plugin", async () => {
    const home = await createHome();
    await installFakePlugin(home, ["tmux"], { enabled: false });

    expect(run("apply", home).exitCode).toBe(0);
    expect(await realpath(path.join(home, ".claude", "skills", "tmux"))).toBe(
      await realpath(path.join(root, "skills", "tmux")),
    );
    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).not.toContain("serves");
  });

  test("refuses to touch the claude target when plugin state is unknown", async () => {
    const home = await createHome();
    await writeFakeClaude(home, "#!/bin/sh\nexit 3\n");

    const plan = run("plan", home);
    expect(plan.exitCode).toBe(1);
    expect(plan.stdout).toContain("PLUGIN STATE UNKNOWN");
    expect(plan.stdout).toContain("BLOCKED");

    const apply = run("apply", home);
    expect(apply.exitCode).toBe(1);
    expect(apply.stderr).toContain("no changes were made");
    expect(await lstat(path.join(home, ".claude")).catch(() => undefined)).toBeUndefined();

    // the other targets stay reachable on their own
    expect(run("apply", home, "-t", "codex").exitCode).toBe(0);
  });

  test("treats unparsable plugin output as unknown state", async () => {
    const home = await createHome();
    await writeFakeClaude(home, "#!/bin/sh\necho not-json\n");

    const plan = run("plan", home, "-t", "claude");
    expect(plan.exitCode).toBe(1);
    expect(plan.stdout).toContain("unparsable");
  });

  test("rejects unknown targets", async () => {
    const home = await createHome();
    const result = run("list", home, "--target", "unknown");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("expected agents | claude | codex");
  });

  test("accepts -t as a short form of --target", async () => {
    const home = await createHome();
    const result = run("list", home, "-t", "agents");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Agents");
    expect(result.stdout).not.toContain("Codex");
  });

  test("prints help for <command> --help", async () => {
    const home = await createHome();
    const result = run("list", home, "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage");
    expect(result.stdout).toContain("--target <target>");
  });

  test("rejects a bare operand and hints at --target", async () => {
    const home = await createHome();
    const result = run("list", home, "codex");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown argument: codex; use --target codex");
  });
});
