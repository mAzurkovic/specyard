import { useRef, useState } from "preact/hooks";
import type { RunKind } from "../../../src/runs/RunManager.js";
import { RunButton } from "./RunView.js";
import type { ProjectModel } from "../../../src/model.js";
import { addContextFile } from "../api.js";
import { nextStep } from "../nextStep.js";
import { projectSteps, Steps } from "./Steps.js";

const ACCEPT = ".md,.markdown,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg";

export function ProjectPage({ model, path }: { model: ProjectModel; path: string }) {
  const step = nextStep(model.files);
  return (
    <>
      <h2>{model.name}</h2>
      <div class="sub-h">
        Found in <code>{path}</code>
      </div>
      <Steps steps={projectSteps(model.files)} />
      {step && (
        <div class="panel next">
          <h3>{step.title}</h3>
          <p class="muted">{step.why}</p>
          <div class="row">
            <Command command={step.command} />
            {step.other && (
              <>
                <span class="muted">Or {step.other.label}:</span>
                <Command command={step.other.command} />
              </>
            )}
          </div>
        </div>
      )}
      <div class="panel">
        <h3>Found files</h3>
        <table class="files">
          <tbody>
            <tr class="group">
              <td colSpan={3}>Required</td>
            </tr>
            <FileRow name="requirements.md" found={model.files.requirements} />
            <FileRow name="design.md" found={model.files.design} />
            <tr class="group">
              <td colSpan={3}>
                Plan <span class="muted">· made by the skills</span>
              </td>
            </tr>
            <FileRow name="milestones.md" found={model.files.milestones} />
            <tr class="group">
              <td colSpan={3}>
                Context <span class="muted">· optional · passed to every skill run</span>
              </td>
            </tr>
            {model.contextFiles.length === 0 && (
              <tr>
                <td />
                <td colSpan={2} class="muted">
                  No files in context/ or mocks/
                </td>
              </tr>
            )}
            {model.contextFiles.map((f) => (
              <tr key={f.path}>
                <td>
                  <span class="dot ok" />
                </td>
                <td>
                  <code>{f.path}</code>
                </td>
                <td class="muted">
                  {formatSize(f.size)} · changed {new Date(f.mtime).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="row" style={{ marginTop: "10px" }}>
          <AddContextFile class="btn sm" />
          <span class="muted">Copies a file into context/: Markdown, PDF or image, up to 20 MB.</span>
        </div>
      </div>
    </>
  );
}

function FileRow({ name, found }: { name: string; found: boolean }) {
  return (
    <tr>
      <td>
        <span class={found ? "dot ok" : "dot"} />
      </td>
      <td>
        <code>{name}</code>
      </td>
      <td class="muted">{found ? "found" : "not found"}</td>
    </tr>
  );
}

/** A skill command to run in Claude Code, with a button that copies it. */
function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const copy = () =>
    navigator.clipboard.writeText(command).then(
      () => setCopied("yes"),
      () => setCopied("failed"),
    );
  return (
    <span class="row">
      <code class="cmd">{command}</code>
      <button class="btn sm" aria-label={`Copy ${command}`} onClick={() => void copy()}>
        {copied === "yes" ? "Copied" : copied === "failed" ? "Copy failed: select the command" : "Copy"}
      </button>
      <RunButton kind={command.slice(1) as RunKind} label="Run" />
    </span>
  );
}

const UPLOAD_ERRORS: Record<number, (name: string) => string> = {
  409: (name) => `context/${name} already exists`,
  413: (name) => `${name} is over 20 MB`,
  415: (name) => `${name}: only Markdown, PDF and images can be added`,
};

/** "+ Add context file": a file picker that copies the chosen file into context/. The watcher then lists it. */
export function AddContextFile({ class: className }: { class: string }) {
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const onChange = async (event: Event) => {
    const picker = event.currentTarget as HTMLInputElement;
    const file = picker.files?.[0];
    picker.value = "";
    if (!file) return;
    const status = await addContextFile(file).then(
      (res) => res.status,
      () => 0,
    );
    setError(status === 201 ? null : (UPLOAD_ERRORS[status]?.(file.name) ?? `Cannot add ${file.name}${status ? ` (${status})` : ": the server is not reachable"}`));
  };
  return (
    <>
      {/* A real button, so the picker is reachable from the keyboard; the file input itself stays hidden. */}
      <button type="button" class={className} onClick={() => input.current?.click()}>
        + Add context file
      </button>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => void onChange(e)} />
      {error && (
        <span class="error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
