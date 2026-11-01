import { expect, it, vi } from "vitest";
import { saveFilesToDirectory } from "./save-files";

it("saves distinct browser playlist files directly without overwriting an existing playlist", async () => {
  const writes = new Map<string, unknown>();
  const getFileHandle = vi.fn(async (name: string, options?: { create?: boolean }) => {
    if (!options?.create) {
      if (name === "First - Rekordbox USB.nml") return {};
      throw Object.assign(new Error("Missing"), { name: "NotFoundError" });
    }
    return { createWritable: async () => ({
      write: async (data: unknown) => { writes.set(name, data); }, close: vi.fn(), abort: vi.fn(),
    }) };
  });
  const directory = { getFileHandle } as unknown as FileSystemDirectoryHandle;
  await saveFilesToDirectory(directory, [
    { path: "First - Rekordbox USB.nml", data: "first" },
    { path: "Second - Rekordbox USB.nml", data: "second" },
  ]);
  expect([...writes]).toEqual([["First - Rekordbox USB (2).nml", "first"], ["Second - Rekordbox USB.nml", "second"]]);
});

it("creates Serato Subcrates inside the selected browser destination", async () => {
  const write = vi.fn();
  const subfolder = { getFileHandle: vi.fn(async (_name, options) => {
    if (!options?.create) throw Object.assign(new Error("Missing"), { name: "NotFoundError" });
    return { createWritable: async () => ({ write, close: vi.fn(), abort: vi.fn() }) };
  }) };
  const getDirectoryHandle = vi.fn().mockResolvedValue(subfolder);
  await saveFilesToDirectory({ getDirectoryHandle } as unknown as FileSystemDirectoryHandle, [{ path: "Subcrates/Set - Rekordbox USB.crate", data: new Uint8Array([1, 2]) }]);
  expect(getDirectoryHandle).toHaveBeenCalledWith("Subcrates", { create: true });
  expect(subfolder.getFileHandle).toHaveBeenLastCalledWith("Set - Rekordbox USB.crate", { create: true });
  expect(write).toHaveBeenCalledOnce();
});