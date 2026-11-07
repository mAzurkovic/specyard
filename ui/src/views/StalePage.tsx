import { useEffect, useState } from "preact/hooks";
import type { ProjectModel } from "../../../src/model.js";
import type { StaleDetails } from "../../../src/staleApi.js";
import { markNotAffected, staleDetails } from "../api.js";
import { diffRows } from "../diffRows.js";
import { staleHref } from "../route.js";

type Load = { state: "loading" } | { state: "not-stale" } | { state: "ok"; details: StaleDetails };

export function StalePage({ model, file }: { model: ProjectModel; file: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  // Reload whenever this file's stale reasons change (a source edited again, a parent resolved), and drop a
  // response that arrives after a newer request.
  const reasons = JSON.stringify(model.stale.find((s) => s.file === file)?.reasons ?? null);
  useEffect(() => {
    if (reasons === "null") return setLoad({ state: "not-stale" });
    let current = true;
    void staleDetails(file).then((details) => {
      if (current) setLoad(details ? { state: "ok", details } : { state: "not-stale" });
    });
    return () => {
      current = false;
    };
  }, [file, reasons]);

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
            <MarkAction details={load.details} onMark={() => void mark()} />
            {error && <p class="error">{error}</p>}
          </div>
        </>
      )}
    </>
  );
}

/** A file stale only through another file has nothing to rewrite; that file is resolved first. */
function MarkAction({ details, onMark }: { details: StaleDetails; onMark: () => void }) {
  const through = details.reasons.every((r) => r.via) ? details.reasons[0]?.source : undefined;
  if (through !== undefined) {
    return (
      <p class="muted" style={{ marginTop: "10px" }}>
        This file changes when its source does. <a href={staleHref(through)}>Resolve {through} first</a>
      </p>
    );
  }
  return (
    <div class="row" style={{ marginTop: "10px" }}>
      <button class="btn" onClick={onMark}>
        Mark as not affected
      </button>
      <span class="muted">Writes the current source hashes into this file; nothing else changes.</span>
    </div>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  const MARK = { same: " ", add: "+", del: "-" } as const;
  return (
    <div class="diff">
      {diffRows(before, after).map((row, i) =>
        row.kind === "header" ? (
          <div key={i} class="h">
            {row.text}
          </div>
        ) : (
          <div key={i} class={row.kind === "add" ? "a" : row.kind === "del" ? "r" : undefined} data-diff={row.kind}>
            {`${MARK[row.kind]} ${row.text}`}
          </div>
        ),
      )}
    </div>
  );
}
