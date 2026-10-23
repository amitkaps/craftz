/** @prose
 * # Upgrade
 *
 * `craftz upgrade` moves a repository to the latest craftz on npm. It adds that version, exactly,
 * and runs its `craftz fix`, so the rules a repository is fixed to are the ones it moves to. Then
 * it installs what the fix moved, and writes the format. It ends with `craftz check`, which says
 * what's left to do by hand.
 *
 * The fix runs as its own process, from the version just added, not the one that started the
 * upgrade. So a repository on an older craftz gets the newer one's fixes, and so does
 * [align](align.ts), which runs these steps in a clone of each repository.
 *
 * align can hand it a packed craftz in place of npm's, to try a release before it's out.
 *
 * craftz itself isn't upgraded this way, since it checks itself from source. `pnpm bump` moves its
 * reference instead.
 */
import { CRAFTZ } from "./reference.ts";

/** Runs a command in the repository, and fails when it does. */
export type Run = (command: string, ...args: string[]) => Promise<unknown>;

/** Adds the latest craftz, or the one given, runs its fix, installs and writes the format. */
export async function upgrade(run: Run, craftz = `${CRAFTZ}@latest`): Promise<void> {
  await run("pnpm", "add", "--save-dev", "--save-exact", craftz);
  // fix exits 1 when something's left to do by hand, which the check after says.
  await run("pnpm", "exec", "craftz", "fix").catch(() => undefined);
  await run("pnpm", "install");
  await run("pnpm", "run", "fix");
}
