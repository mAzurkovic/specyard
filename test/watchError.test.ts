import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";

// The OS watcher is a boundary: a fake one lets the test send the error Linux sends when the folder is deleted.
const fake = Object.assign(new EventEmitter(), { close: vi.fn() });
vi.mock("node:fs", async (original) => ({ ...(await original<typeof import("node:fs")>()), watch: () => fake }));

afterEach(() => vi.restoreAllMocks());

it("logs a watcher error and stops watching instead of crashing", async () => {
  const { watchProject } = await import("../src/watch.js");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  watchProject("/any/project", () => {});
  fake.emit("error", new Error("folder deleted"));
  expect(errors).toHaveBeenCalledWith(expect.stringContaining("folder deleted"));
  expect(fake.close).toHaveBeenCalled();
});
