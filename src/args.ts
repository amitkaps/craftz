/** @prose
 * # How a command reads its arguments
 *
 * Every command and script of craftz reads its arguments here, so none of them decides alone what
 * an unknown option or the word `help` means. A command states what it takes in `SPECS`, and the
 * dispatcher in [cli.ts](cli.ts) calls `parsed` before it runs the command.
 *
 * `--help` and `-h` print the command's section of [usage](../docs/usage.md) and stop. Anything
 * the command doesn't take stops it with one line, before it reads or writes a file. That
 * includes the bare word `help`. An agent types it as an argument, and no command reads it as
 * one, so it would become a folder, a title or a name. `craftz help <command>` is the one
 * command that takes a command's name, and `help` is one.
 *
 * `SPECS` is data, and a test holds its commands to the ones usage states, both ways. A command
 * added without a spec has no handler in cli.ts either, since the compiler holds the two to the
 * same names.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { finding } from "@amitkaps/markz/rules";
import { helpOn, scriptHelp } from "./stated.ts";

/**
 * What a command takes after its name. `dir` is one folder, `one` and `command` one word, `none`
 * nothing, and `any` words the command counts itself, like a title or a version.
 */
type Takes = "none" | "dir" | "one" | "command" | "any";

type Spec = {
  /** How it's run, which its refusal names. */
  run: string;
  /** Its options by name, without dashes. A flag takes no value, and text takes one. */
  options?: Record<string, "flag" | "text">;
  takes: Takes;
  /** For a script of a checkout, the usage heading that holds its help. */
  heading?: string;
};

const CRAFTZ = "pnpm craftz";
const RUN = { flag: "flag", text: "text" } as const;

/** The commands of the package, each an id that usage states. */
export const SPECS = {
  rules: { run: `${CRAFTZ} rules`, takes: "one" },
  check: { run: `${CRAFTZ} check`, takes: "dir" },
  fix: { run: `${CRAFTZ} fix`, takes: "dir" },
  upgrade: { run: `${CRAFTZ} upgrade`, takes: "none" },
  settings: {
    run: `${CRAFTZ} settings`,
    options: { check: RUN.flag, yes: RUN.flag },
    takes: "dir",
  },
  status: {
    run: `${CRAFTZ} status`,
    options: { log: RUN.flag, notes: RUN.flag, timing: RUN.flag },
    takes: "dir",
  },
  deps: { run: `${CRAFTZ} deps`, takes: "dir" },
  deploy: { run: `${CRAFTZ} deploy`, takes: "none" },
  pr: {
    run: "pnpm pr",
    options: { title: RUN.text, label: RUN.text, body: RUN.text, wait: RUN.flag },
    takes: "any",
  },
  gone: { run: "pnpm gone", takes: "none" },
  clear: { run: `${CRAFTZ} clear`, options: { list: RUN.flag }, takes: "none" },
  release: { run: `${CRAFTZ} release`, options: { notes: RUN.text }, takes: "any" },
  shot: { run: `${CRAFTZ} shot`, options: { width: RUN.text }, takes: "any" },
  new: {
    run: "craftz new",
    options: {
      package: RUN.flag,
      private: RUN.flag,
      internal: RUN.flag,
      push: RUN.flag,
      site: RUN.text,
      description: RUN.text,
    },
    takes: "any",
  },
  help: { run: `${CRAFTZ} help`, takes: "command" },
} as const satisfies Record<string, Spec>;

/** The scripts of a checkout that aren't commands of the package. */
export const SCRIPTS = {
  align: {
    run: "pnpm align",
    options: { candidate: RUN.flag, local: RUN.flag },
    takes: "any",
    heading: "Aligning every repository",
  },
  bump: {
    run: "pnpm bump",
    options: { candidate: RUN.flag, local: RUN.flag },
    takes: "none",
    heading: "Moving the reference",
  },
} as const satisfies Record<string, Spec>;

export type Command = keyof typeof SPECS;
export type Script = keyof typeof SCRIPTS;

/** What a command was given, once `parsed` has accepted it. */
export type Parsed = {
  /** The words after the options, which `any` leaves for the command to count. */
  words: string[];
  /** The folder, for a command that takes one, and the current one by default. */
  dir: string;
  flag: (name: string) => boolean;
  text: (name: string) => string | undefined;
};

/**
 * The arguments with each text option's value joined to it, as `--body=<text>`, so a value can
 * open with a dash. What follows a `--` is left as it is, since it's input and no option.
 */
export function joined(args: string[], text: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    const value = args[i + 1];
    if (arg === "--") {
      out.push(...args.slice(i));
      break;
    }
    if (text.some((name) => arg === `--${name}`) && value !== undefined) {
      out.push(`${arg}=${value}`);
      i++;
    } else out.push(arg);
  }
  return out;
}

/**
 * Reads what a command was given, or stops. `--help` and `-h` print its section and exit 0.
 * An option it doesn't take, the word `help`, too many words and a folder that isn't there each
 * exit 1 with a line that names it.
 */
export function parsed(name: Command | Script, argv: string[]): Parsed {
  const spec: Spec = name in SCRIPTS ? SCRIPTS[name as Script] : SPECS[name as Command];
  const refuse = (
    message: string,
    instead = `and \`${spec.run} --help\` says what it takes`,
  ): never => {
    const said = `${spec.run}: ${message}, ${instead}`;
    console.error(finding({ tool: "craftz", level: "error", message: said }));
    process.exit(1);
  };

  // What follows a `--` is input, so it's never a request for help.
  const before = argv.includes("--") ? argv.slice(0, argv.indexOf("--")) : argv;
  if (before.some((arg) => arg === "--help" || arg === "-h")) {
    process.stdout.write(spec.heading ? scriptHelp(spec.heading)! : helpOn(name)!);
    process.exit(0);
  }

  const options = spec.options ?? {};
  let read;
  try {
    read = parseArgs({
      args: joined(
        argv,
        Object.keys(options).filter((key) => options[key] === "text"),
      ),
      allowPositionals: true,
      options: Object.fromEntries(
        Object.entries(options).map(([key, kind]) => [
          key,
          { type: kind === "flag" ? "boolean" : "string" } as const,
        ]),
      ),
    });
  } catch (error) {
    const why = error instanceof Error ? error.message.split(". ")[0]! : String(error);
    return refuse(why.replace(/\.$/, ""));
  }

  const { values, positionals: words } = read;
  if (spec.takes !== "command" && words.some((word) => word.trim().toLowerCase() === "help")) {
    refuse(
      "`help` isn't an argument",
      `and it has no help word. Run \`${spec.run} --help\` for what it does`,
    );
  }
  if (spec.takes === "none" && words.length) refuse("it takes no arguments");
  if (spec.takes === "dir" && words.length > 1) refuse("it takes one folder");
  if ((spec.takes === "one" || spec.takes === "command") && words.length > 1) {
    refuse("it takes one argument");
  }
  const dir = resolve(spec.takes === "dir" ? (words[0] ?? ".") : ".");
  if (spec.takes === "dir" && !existsSync(dir)) refuse(`${dir} isn't a folder`);

  return {
    words,
    dir,
    flag: (key) => values[key] === true,
    text: (key) => (typeof values[key] === "string" ? values[key] : undefined),
  };
}
