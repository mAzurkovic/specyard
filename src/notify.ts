import { execFile } from "node:child_process";

/** An AppleScript string literal. */
const quote = (text: string) => `"${text.replace(/[\\"]/g, "\\$&")}"`;

/** Shows an OS notification where the system has a way to; a missing or failing notifier is logged, never thrown. */
export function notify(title: string, message: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  const command =
    platform === "darwin"
      ? (["osascript", ["-e", `display notification ${quote(message)} with title ${quote(title)}`]] as const)
      : platform === "linux"
        ? (["notify-send", [title, message]] as const)
        : undefined;
  if (!command) return Promise.resolve();
  return new Promise((resolve) => {
    execFile(command[0], [...command[1]], (error) => {
      // Many Linux machines have no notify-send; that only means no notification.
      if (error && (error as NodeJS.ErrnoException).code !== "ENOENT") console.error(`specyard: cannot show a notification: ${error.message}`);
      resolve();
    });
  });
}
