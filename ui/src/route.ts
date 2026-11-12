import { useEffect, useState } from "preact/hooks";

export type Route =
  | { page: "home" }
  | { page: "graph" }
  | { page: "list" }
  | { page: "project" }
  | { page: "feature"; id: string; tab: string | undefined }
  | { page: "milestone"; id: string }
  | { page: "run"; id: string };

export const featureHref = (id: string, tab?: string) => `#/f/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`;
export const milestoneHref = (id: string) => `#/m/${encodeURIComponent(id)}`;

export function parseRoute(hash: string): Route {
  let parts: string[];
  try {
    parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  } catch {
    return { page: "home" };
  }
  const [page, id, tab] = parts;
  if (page === "project" || page === "graph" || page === "list") return { page };
  if (page === "f" && id) return { page: "feature", id, tab };
  if (page === "m" && id) return { page: "milestone", id };
  if (page === "run" && id) return { page: "run", id };
  return { page: "home" };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return parseRoute(hash);
}
