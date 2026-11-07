import { useEffect, useState } from "preact/hooks";
import type { Feature, ProjectModel } from "../../../src/model.js";
import { fetchFile } from "../api.js";
import { Markdown } from "../markdown.js";
import { featureHref, milestoneHref, staleHref } from "../route.js";
import { StageBadge } from "../stage.js";
import { featureSteps, Steps } from "./Steps.js";

const SPEC_TABS = ["requirements", "design", "tasks"] as const;
type SpecTab = (typeof SPEC_TABS)[number];
const TABS = { requirements: "Requirements", design: "Design", tasks: "Tasks", run: "Run", evidence: "Evidence" } as const;
type Tab = keyof typeof TABS;
const WRITER: Record<SpecTab, string> = { requirements: "/to-brd", design: "/to-design", tasks: "/to-tasks" };

const isTab = (tab: string | undefined): tab is Tab => tab !== undefined && Object.hasOwn(TABS, tab);
const isSpecTab = (tab: Tab): tab is SpecTab => (SPEC_TABS as readonly string[]).includes(tab);

export function FeaturePage({ model, id, tab }: { model: ProjectModel; id: string; tab: string | undefined }) {
  const feature = model.features.find((f) => f.id === id);
  if (!feature) {
    return (
      <div class="panel">
        <h3>No feature {id}</h3>
        <p class="muted">milestones.md does not list it.</p>
      </div>
    );
  }
  const milestone = model.milestones.find((m) => m.id === feature.milestone);
  const current = isTab(tab) ? tab : "tasks";
  return (
    <>
      <div class="crumb">
        {model.name} › <a href={milestoneHref(feature.milestone)}>{`${feature.milestone} ${milestone?.name ?? ""}`}</a> ›{" "}
        <code>{feature.dir ? `${feature.dir}/` : "no folder yet"}</code>
      </div>
      <div class="row">
        <h2>{`${feature.feature} ${feature.name}`}</h2>
        <StageBadge stage={feature.stage} />
      </div>
      <Steps steps={featureSteps(feature)} />
      {feature.staleFiles.map((file) => (
        <div class="panel stale-banner" key={file}>
          <span class="badge stale">stale</span> <code>{file}</code> was made from a source that changed since.{" "}
          <a href={staleHref(file)}>Review the change</a>
        </div>
      ))}
      <div class="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <a key={t} role="tab" aria-selected={t === current} class={t === current ? "on" : undefined} href={featureHref(feature.id, t)}>
            {TABS[t]}
          </a>
        ))}
      </div>
      <div class="tab-body" role="tabpanel">
        {isSpecTab(current) ? <SpecTabBody feature={feature} tab={current} version={model} /> : <p class="muted">No runs yet</p>}
      </div>
    </>
  );
}

function SpecTabBody({ feature, tab, version }: { feature: Feature; tab: SpecTab; version: unknown }) {
  if (feature.dir && feature.hasFile[tab]) return <SpecFile path={`${feature.dir}/${tab}.md`} version={version} />;
  if (!feature.docs.includes(tab)) return <p class="muted">Not needed</p>;
  return (
    <p class="muted">
      Not written yet: run <code>{`${WRITER[tab]} ${feature.milestone} ${feature.feature}`}</code>
    </p>
  );
}

type Loaded = { path: string; text: string } | { path: string; error: string };

/** Renders a spec file, and reads it again whenever `version` changes. */
function SpecFile({ path, version }: { path: string; version: unknown }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    fetchFile(path).then(
      (text) => live && setLoaded({ path, text }),
      (error: Error) => live && setLoaded({ path, error: error.message }),
    );
    return () => {
      live = false;
    };
  }, [path, version]);
  if (loaded?.path !== path) return <p class="muted">Loading…</p>;
  if ("error" in loaded) return <p class="error">Cannot read {loaded.error}</p>;
  return <Markdown text={loaded.text} />;
}
