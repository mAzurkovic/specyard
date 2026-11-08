import { watch } from "node:fs";
import { sep } from "node:path";

const OWN_DIR = ".specyard";

/** Calls `onChange` once per burst of file changes under `dir`. Returns a function that stops watching. */
export function watchProject(dir: string, onChange: () => void, debounceMs = 150): () => void {
  let timer: NodeJS.Timeout | undefined;
  const watcher = watch(dir, { recursive: true }, (_event, file) => {
    if (file !== null && (file === OWN_DIR || file.startsWith(OWN_DIR + sep))) return;
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  });
  const stop = () => {
    clearTimeout(timer);
    watcher.close();
  };
  // Linux reports a deleted watched folder as an error event; without a listener it would crash the process.
  watcher.on("error", (error) => {
    console.error(`specyard: stopped watching ${dir}: ${error.message}`);
    stop();
  });
  return stop;
}
