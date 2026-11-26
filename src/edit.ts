/** @prose
 * # Editing a repository's files
 *
 * The fixes that edit `vite.config.ts` and `cloudflare.config.ts`, code a repository writes
 * itself, to write in the values the rules set and add the task `verify`
 * runs. [rules.ts](rules.ts) reads and writes the files, and keeps only the
 * rules. CI and pnpm's settings are craftz's, written whole.
 *
 * An edit takes a file's text and gives back the fixed text. It finds where to write by parsing
 * the config, as [config.ts](config.ts) does, and writes there, so the rest of the file stays as
 * it was. A config it can't place the edit in comes back unchanged, so its check still drifts.
 *
 * A fix that moves repositories off an old layout is deleted once every repository is past it.
 */
import { type Node, at, exported, literal, properties } from "./config.ts";
import { type Config, written } from "./ruled.ts";

/** @prose
 * # The values a config writes out
 *
 * The toolchain's and the releases' fixes write their values into the config, each key at its
 * path, like `lint.options.typeAware`. A key that's there with another value has the value
 * replaced. A missing key goes in the deepest block the path reaches, after its last key, so
 * `fmt: { ignorePatterns }` gains `proseWrap`, and a config with no `lint` gains the whole block.
 *
 * Where the path meets something that isn't an object, like `lint: shared`, the edit stops, and
 * the check still drifts, naming the key to set by hand. The edit writes each value on one line,
 * as `written` spells it, and `vp check --fix` lays it out after.
 */

// The paths to each value in a block, with the value, like `[["fmt", "proseWrap"], "never"]`.
const leaves = (value: unknown, path: string[] = []): [string[], unknown][] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, it]) => leaves(it, [...path, key]))
    : [[path, value]];

// A value as text to compare, with a regex as it's written, since JSON has none.
const compared = (value: unknown): string | undefined =>
  JSON.stringify(value, (_, it: unknown) => (it instanceof RegExp ? String(it) : it));

// Lists a repository may add to, like the plugins its own lint rules need. The rule asks that its
// entries are there, and the fix keeps what else the list holds.
const ADDITIVE = ["lint.plugins", "test.exclude"];

// What a path's value is to be, by what the config has. An additive list is the config's own with
// the missing entries after it, or nothing where it holds them all.
function wanted(have: unknown, path: string[], value: unknown): unknown {
  if (!ADDITIVE.includes(path.join(".")) || !Array.isArray(have) || !Array.isArray(value)) {
    return value;
  }
  const missing = value.filter((it) => !have.includes(it));
  return missing.length ? [...have, ...missing] : have;
}

/** Each value in `values` that a config sets otherwise, or not at all, by its path. */
export const unlike = (vite: string, values: Config): [string[], unknown][] =>
  leaves(values)
    .map(([path, value]): [string[], unknown] => {
      const have = literal(at(exported(vite), path));
      return [path, wanted(have, path, value)];
    })
    .filter(([path, value]) => compared(literal(at(exported(vite), path))) !== compared(value));

// Adds `key: value` to an object node, after its last key, or as its only one.
function withKey(text: string, object: Node, key: string, value: string, top: boolean): string {
  const last = (object["properties"] as Node[]).at(-1);
  if (!last) return `${text.slice(0, object.start)}{ ${key}: ${value} }${text.slice(object.end)}`;
  const comma = text[last.end] === ",";
  const after = last.end + (comma ? 1 : 0);
  const line = /^\s*/.exec(text.slice(text.lastIndexOf("\n", last.start) + 1, last.start))?.[0];
  const multiline = text.slice(object.start, object.end).includes("\n");
  const gap = multiline ? `${top ? "\n\n" : "\n"}${line}` : " ";
  return `${text.slice(0, after)}${comma ? "" : ","}${gap}${key}: ${value}${comma && multiline ? "," : ""}${text.slice(after)}`;
}

// An additive list with its missing entries written after its last one, so what the config works
// out inside it, like a spread, stays. `undefined` where the node isn't an array of its own.
function appended(text: string, node: Node, value: unknown): string | undefined {
  const elements = node["elements"];
  if (node.type !== "ArrayExpression" || !Array.isArray(elements) || !Array.isArray(value)) return;
  const have = literal(node) as unknown[];
  const missing = value.filter((it) => !have.includes(it)).map(written);
  const last = (elements as Node[]).at(-1);
  if (!missing.length) return text;
  if (!last) return `${text.slice(0, node.start)}[${missing.join(", ")}]${text.slice(node.end)}`;
  return `${text.slice(0, last.end)}, ${missing.join(", ")}${text.slice(last.end)}`;
}

// A config with `value` at `path`, or as it was where the path can't be reached.
function withValue(text: string, path: string[], value: unknown): string {
  let object = exported(text);
  for (const [i, key] of path.entries()) {
    if (object?.type !== "ObjectExpression") return text;
    const node = at(object, [key]);
    if (!node) {
      const rest = path.slice(i + 1).reduceRight<unknown>((it, inner) => ({ [inner]: it }), value);
      return withKey(text, object, key, written(rest), i === 0);
    }
    if (i === path.length - 1) {
      const added = ADDITIVE.includes(path.join(".")) ? appended(text, node, value) : undefined;
      if (added !== undefined) return added;
      return `${text.slice(0, node.start)}${written(value)}${text.slice(node.end)}`;
    }
    object = node;
  }
  return text;
}

/** A Vite config with each of `values` set at its path, where the path can be reached. */
export const withValues = (vite: string, values: Config): string =>
  unlike(vite, values).reduce((text, [path, value]) => withValue(text, path, value), vite);

/** @prose
 * # Running verify
 *
 * `verify` is `vp run --log grouped all`, and `all` is a task in `vite.config.ts` that runs the
 * repository's scripts side by side, one for each entry in its `dependsOn`. SvelteKit's scripts
 * are an exception: sync, check, test and build run in that order, since each Vite command may
 * rewrite the shared `node_modules/$app/tsconfig.json`.
 *
 * `scripts-verify`'s fix moves a `verify` that chained them with `&&` into that list, and adds
 * the `run` block after the config's last key. A config that already has a `run` block comes
 * back unchanged, so the task is added by hand.
 *
 * Only `test` and `build` are cached, as the tasks `tested` and `built`, since everything they
 * read is a file. `all`, `synced`, `checked` and `site` stay uncached, because a cached step
 * replays its output without running, and `prose build` and `craftz check` read the last commit
 * and GitHub, which the cache can't see. `verify` is what CI, `pr` and a release trust.
 */

/** The scripts the config's `all` task depends on, or `undefined` without one. */
export function allOf(vite: string): string[] | undefined {
  const list = literal(at(exported(vite), ["run", "tasks", "all", "dependsOn"]));
  return Array.isArray(list) ? list.filter((it) => typeof it === "string") : undefined;
}

/**
 * The scripts `all` runs, each as the task that runs it: the script's own name, or a task of the
 * repository's whose command is `pnpm run <script>`. A task can't share a script's name, so
 * `tested` and `built` are how `test` and `build` are cached, and `built` is also how `build`
 * waits for `check`. `undefined` without an `all` task.
 */
export function allRuns(vite: string): string[] | undefined {
  const names = allOf(vite);
  if (!names) return undefined;
  const tasks = literal(at(exported(vite), ["run", "tasks"]));
  const defined = tasks && typeof tasks === "object" ? (tasks as Record<string, unknown>) : {};
  return names.map((name) => {
    const task = defined[name];
    const command =
      task && typeof task === "object" ? (task as { command?: unknown }).command : undefined;
    const script =
      typeof command === "string" ? /^pnpm run ([\w:-]+)$/.exec(command)?.[1] : undefined;
    return script ?? name;
  });
}

// The cached scripts, and the task each is run as, since a task can't share a script's name.
const CACHED: Record<string, string> = { test: "tested", build: "built" };
const SVELTEKIT: Record<string, string> = { check: "checked", ...CACHED };

// What a cached task leaves out of its inputs: `.prose`, which `site` writes, `dist` for `tested`,
// which `built` writes, and for a SvelteKit repository what `check` rewrites as they read it.
const left = (it: string, scripts: string[], kit: boolean): string[] => [
  ...(scripts.includes("site") ? ["!.prose/**"] : []),
  ...(it === "test" && scripts.includes("build") ? ["!dist/**"] : []),
  ...(kit ? ["!.svelte-kit/**", "!node_modules/$app/**"] : []),
];

/**
 * The `run` block whose `all` task runs these scripts, as a config's key, indented. `tested` and
 * `built` leave out what runs beside them: `.prose`, which `site` writes, and for `tested`, the
 * `dist` that `built` writes. A fresh checkout has neither, so a cache that counted them missed.
 */
export const runBlock = (scripts: string[], kit = false): string => {
  const cached = scripts.filter((it) => CACHED[it]);
  const tasks = (kit ? [] : cached).map((it) => {
    const input = left(it, scripts, kit);
    const cache = input.length
      ? `, cache: { input: [{ auto: true }, ${input.map((i) => JSON.stringify(i)).join(", ")}] }`
      : "";
    return `      ${CACHED[it]}: { command: "pnpm run ${it}"${cache} },\n`;
  });
  if (kit) {
    tasks.push(
      '      synced: { command: "svelte-kit sync", cache: false },\n',
      '      checked: { command: "pnpm run check", dependsOn: ["synced"], cache: false },\n',
    );
    let before = "checked";
    for (const name of cached) {
      const input = left(name, scripts, kit);
      const cache = input.length
        ? `, cache: { input: [{ auto: true }, ${input.map((i) => JSON.stringify(i)).join(", ")}] }`
        : "";
      const dependsOn = [before, "synced"].map((it) => JSON.stringify(it)).join(", ");
      tasks.push(
        `      ${CACHED[name]}: { command: "pnpm run ${name}", dependsOn: [${dependsOn}]${cache} },\n`,
      );
      before = CACHED[name]!;
    }
  }
  const names = scripts.map((it) =>
    JSON.stringify(kit ? (SVELTEKIT[it] ?? it) : (CACHED[it] ?? it)),
  );
  if (kit) names.unshift('"synced"');
  return `  run: {
    cache: { scripts: false, tasks: true },
    tasks: {
${tasks.join("")}      all: { command: "true", cache: false, dependsOn: [${names.join(", ")}] },
    },
  },
`;
};

/** A Vite config whose `all` task runs these scripts, added after its last key. */
export function withVerify(vite: string, scripts: string[], kit = false): string {
  const config = exported(vite);
  const last = properties(config).at(-1);
  if (!last || at(config, ["run"])) return vite;
  const comma = vite[last.end] === ",";
  const after = last.end + (comma ? 1 : 0);
  const block = runBlock(scripts, kit).trimEnd();
  return `${vite.slice(0, after)}${comma ? "" : ","}\n\n${block}${vite.slice(after)}`;
}

/** @prose
 * # The cached form
 *
 * A repository whose `all` ran `test` and `build` as scripts is moved to the cached form. It gets
 * `run.cache`, the tasks `tested` and `built`, an uncached `all`, and `dependsOn` lists that name
 * the tasks.
 *
 * A task of the repository's own stays as it is, and so does a cache it set on `tested` or
 * `built`, since only it knows what they read. A `run` block that isn't plain values, or has no
 * `all`, is left alone, so its check still drifts.
 */

// The values the cached form sets in a config, or `undefined` where it has no `all` to go on.
function cachedValues(vite: string, scripts: string[], kit: boolean): Config | undefined {
  const names = allOf(vite);
  if (!names) return undefined;
  const found = literal(at(exported(vite), ["run", "tasks"]));
  const defined = (found && typeof found === "object" ? found : {}) as Record<string, unknown>;
  const own = (name: string): { command?: unknown; cache?: unknown; dependsOn?: unknown } => {
    const task = defined[name];
    return task && typeof task === "object" ? task : {};
  };
  // `test` or `build` as the script, which no task of that name stands in for.
  const taskName = (name: string): string =>
    !defined[name] ? ((kit ? SVELTEKIT : CACHED)[name] ?? name) : name;
  const renamed = (list: unknown): string[] | undefined =>
    Array.isArray(list) &&
    list.some((it) => typeof it === "string" && (kit ? SVELTEKIT[it] : CACHED[it]) && !defined[it])
      ? list.map((it: string) => taskName(it))
      : undefined;
  const tasks: Config = {};
  if (kit) {
    tasks["synced"] = { command: "svelte-kit sync", cache: false };
    tasks["checked"] = {
      command: "pnpm run check",
      dependsOn: ["synced"],
      cache: false,
    };
  }
  const ordered = scripts.filter((it) => SVELTEKIT[it]);
  for (const script of Object.keys(CACHED)) {
    const task = CACHED[script]!;
    const runs = names.includes(script) || names.includes(task);
    if (!scripts.includes(script) || !runs) continue;
    const command = own(task).command;
    if (command !== undefined && command !== `pnpm run ${script}`) continue;
    const input = left(script, scripts, kit);
    tasks[task] = {
      command: `pnpm run ${script}`,
      ...(kit
        ? {
            dependsOn: [
              SVELTEKIT[ordered[ordered.indexOf(script) - 1] ?? "check"] ?? "checked",
              "synced",
            ],
          }
        : {}),
      ...(input.length && own(task).cache === undefined
        ? { cache: { input: [{ auto: true }, ...input] } }
        : {}),
    };
  }
  const all = renamed(names) ?? names;
  tasks["all"] = {
    cache: false,
    dependsOn: kit ? ["synced", ...all.filter((it) => it !== "synced")] : all,
  };
  for (const name of Object.keys(defined)) {
    const dependsOn = renamed(own(name).dependsOn);
    if (
      name !== "all" &&
      dependsOn &&
      !(kit && ["synced", ...Object.values(SVELTEKIT)].includes(name))
    )
      tasks[name] = { dependsOn };
  }
  return { run: { cache: CACHE, tasks } };
}

/** What the cached form sets that a config sets otherwise, by its path, for the check to name. */
export function uncached(vite: string, scripts: string[], kit = false): [string[], unknown][] {
  const values = cachedValues(vite, scripts, kit);
  if (!values) return [];
  const found = unlike(vite, values);
  // `cache: false` is no block to set keys in, so it's the one thing to set.
  return plainCache(vite)
    ? found
    : [[["run", "cache"], CACHE], ...found.filter(([path]) => path[1] !== "cache")];
}

const CACHE = { scripts: false, tasks: true };

// Whether `run.cache` is a block of keys, or not there, as the cached form sets keys in it.
const plainCache = (vite: string): boolean => {
  const node = at(exported(vite), ["run", "cache"]);
  return !node || node.type === "ObjectExpression";
};

/** A Vite config in the cached form, where its `run` block can be edited. */
export function withCached(vite: string, scripts: string[], kit = false): string {
  const values = cachedValues(vite, scripts, kit);
  if (!values) return vite;
  const text = plainCache(vite) ? vite : withValue(vite, ["run", "cache"], {});
  return withValues(text, values);
}
