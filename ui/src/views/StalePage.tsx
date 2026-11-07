import { diffLines } from "diff";
import { useEffect, useState } from "preact/hooks";
import type { ProjectModel } from "../../../src/model.js";
import type { StaleDetails } from "../../../src/staleApi.js";
import { markNotAffected, staleDetails } from "../api.js";
import { staleHref } from "../route.js";

type Load = { state: "loading" } | { state: "not-stale" } | { state: "ok"; details: StaleDetails };

export function StalePage({ model, file }: { model: ProjectModel; file: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  // The model's version changes on every rebuild, so a fixed file reloads its details when it is no longer stale.
  const isStale = model.stale.some((s) => s.file === file);
  useEffect(() => {
    if (!isStale) return setLoad({ state: "not-stale" });
    void staleDetails(file).then((details) => setLoad(details ? { state: "ok", details } : { state: "not-stale" }));
  }, [file, isStale]);

  const mark = async () => {
    const res = await markNotAffected(file);
    setError(res.ok ? null : `Cannot mark ${file} (${res.status})`);
  };

  return (
    <>
      <div class="crumb">
        {model.name} › stale
      </div>
      <h2>{file}</h2>
      {load.state === "loading" && <p class="muted">Loading…</p>}
      {load.state === "not-stale" && <p class="muted">This file is not stale.</p>}
      {load.state === "ok" && (
        <>
          <div class="panel stale-banner">
            Made from a source that changed since. <b>{load.details.reasons.length}</b> source{load.details.reasons.length === 1 ? "" : "s"} below.
          </div>
          {load.details.reasons.map((r) => (
            <div class="panel" key={r.source} data-source={r.source}>
              <h3>
                <code>{r.source}</code>{" "}
                <span class="muted mono">
                  recorded {r.recorded} · now {r.current ?? "missing"}
                </span>
              </h3>
              {r.via ? (
                <p class="muted">
                  Unchanged itself, but stale: <a href={staleHref(r.source)}>review {r.source}</a>.
                </p>
              ) : r.oldText === null || r.newText === null ? (
                <p class="muted">{r.newText === null ? "The source is missing or outside the project." : "Old version not found, no diff."}</p>
              ) : (
                <Diff before={r.oldText} after={r.newText} />
              )}
            </div>
          ))}
          <div class="panel">
            <h3>Affected</h3>
            {load.details.affected.length === 0 ? (
              <p class="muted">No other file is stale through this one.</p>
            ) : (
              load.details.affected.map((a) => (
                <div key={a}>
                  <a href={staleHref(a)}>{a}</a>
                </div>
              ))
            )}
            <div class="row" style={{ marginTop: "10px" }}>
              <button class="btn" onClick={() => void mark()}>
                Mark as not affected
              </button>
              <span class="muted">Writes the current source hashes into this file; nothing else changes.</span>
            </div>
            {error && <p class="error">{error}</p>}
          </div>
        </>
      )}
    </>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <div class="diff">
      {diffLines(before, after).flatMap((part, i) =>
        part.value
          .replace(/\n$/, "")
          .split("\n")
          .map((line, j) => (
            <div key={`${i}-${j}`} class={part.added ? "a" : part.removed ? "r" : undefined} data-diff={part.added ? "add" : part.removed ? "del" : "same"}>
              {part.added ? "+ " : part.removed ? "- " : "  "}
              {line}
            </div>
          )),
      )}
    </div>
  );
}
