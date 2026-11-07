import { parseArgs } from "node:util";

export const USAGE = `Usage: specyard [--path <project dir>]
       specyard --version`;

export type CliArgs =
  | { ok: true; command: "start"; path: string | undefined }
  | { ok: true; command: "version" }
  | { ok: false; error: string };

export function parseCliArgs(argv: string[]): CliArgs {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { version: { type: "boolean" }, path: { type: "string" } },
      strict: true,
      allowPositionals: false,
    });
    if (values.version) return { ok: true, command: "version" };
    return { ok: true, command: "start", path: values.path };
  } catch (error) {
    return { ok: false, error: `${(error as Error).message}\n${USAGE}` };
  }
}
