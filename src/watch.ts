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
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}
