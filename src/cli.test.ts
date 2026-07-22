import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readlink, realpath, rm, symlink, unlink } from "node:fs/promises";
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

function run(command: string, home: string, target?: string) {
  const result = Bun.spawnSync({
    cmd: [process.execPath, cli, command, ...(target ? [target] : [])],
    env: { ...process.env, HOME: home, NO_COLOR: "1", COLUMNS: "90" },
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
  test("distributes missing skills and reports healthy", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

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
    expect(list.stdout).toContain("Symlink target");
    expect(list.stdout).toContain("tmux");
    expect(list.stdout).toContain("MANAGED");
  });

  test("makes no changes when a non-symlink occupies a destination", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

    const skills = path.join(home, ".claude", "skills");
    await unlink(path.join(skills, "tmux"));
    await mkdir(path.join(skills, "tmux"));
    await unlink(path.join(skills, "yt-digest"));

    const result = run("distribute", home);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no changes were made");
    expect(await lstat(path.join(skills, "yt-digest")).catch(() => undefined)).toBeUndefined();
  });

  test("relinks a symlink that points somewhere else", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

    const destination = path.join(home, ".claude", "skills", "tmux");
    const otherSkill = path.join(home, "other-tmux");
    await mkdir(otherSkill);
    await unlink(destination);
    await symlink(otherSkill, destination);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("MISSING");

    const result = run("distribute", home);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Relinked");
    expect(await realpath(destination)).toBe(await realpath(path.join(root, "skills", "tmux")));
  });

  test("lists external entries and their symlink targets", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

    await mkdir(path.join(home, ".claude", "external-source"));
    await symlink(
      "../external-source",
      path.join(home, ".claude", "skills", "external-skill"),
    );
    await mkdir(path.join(home, ".codex", "skills", "local-skill"));

    const list = run("list", home);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("external-skill");
    expect(list.stdout).toContain("../external-source");
    expect(list.stdout).toContain("local-skill");
    expect(list.stdout).toContain("(directory)");
    expect(list.stdout).toContain("EXTERNAL");
  });

  test("reports and prunes external dangling symlinks", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

    const stale = path.join(home, ".claude", "skills", "removed-skill");
    await symlink(path.join(home, "missing-external-skill"), stale);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("STALE");
    expect(doctor.stdout).toContain("removed-skill");

    const list = run("list", home);
    expect(list.stdout).toContain("removed-skill");
    expect(list.stdout).toContain("STALE");
    expect(list.stdout).toContain("~/missing-external-skill");

    expect(run("distribute", home).exitCode).toBe(0);
    expect(await lstat(stale).catch(() => undefined)).toBeUndefined();
  });

  test("repairs a repo skill that is both missing and stale", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

    const destination = path.join(home, ".codex", "skills", "tmux");
    await unlink(destination);
    await symlink(path.join(home, "missing-tmux"), destination);

    const doctor = run("doctor", home);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("STALE");

    const list = run("list", home);
    expect(list.stdout).toContain("MISSING");

    expect(run("distribute", home).exitCode).toBe(0);
    expect(await realpath(destination)).toBe(await realpath(path.join(root, "skills", "tmux")));
  });

  test("creates absolute symlinks in all three destinations", async () => {
    const home = await createHome();
    expect(run("distribute", home).exitCode).toBe(0);

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
    const distribute = run("distribute", home, "agents");
    expect(distribute.exitCode).toBe(0);
    expect(await realpath(path.join(home, ".config", "agents", "skills", "tmux"))).toBe(
      await realpath(path.join(root, "skills", "tmux")),
    );
    expect(await lstat(path.join(home, ".claude")).catch(() => undefined)).toBeUndefined();
    expect(await lstat(path.join(home, ".codex")).catch(() => undefined)).toBeUndefined();

    const doctor = run("doctor", home, "agents");
    const output = doctor.stdout;
    expect(doctor.exitCode).toBe(0);
    expect(output).toContain("Agents");
    expect(output).not.toContain("Claude Code");
    expect(output).not.toContain("Codex");

    const list = run("list", home, "agents");
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("Agents");
    expect(list.stdout).not.toContain("Claude Code");
    expect(list.stdout).not.toContain("Codex");
  });

  test("rejects unknown targets", async () => {
    const home = await createHome();
    const result = run("list", home, "unknown");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("expected agents | claude | codex");
  });
});
