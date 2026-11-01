import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { saveExportFiles, validateExportFiles } = require("../../electron/export-files.cjs");

it("writes separate desktop playlists directly and preserves existing files and audio", async () => {
  const folder = await mkdtemp(join(tmpdir(), "usb-export-"));
  try {
    await writeFile(join(folder, "First - Rekordbox USB.nml"), "existing");
    await writeFile(join(folder, "song.mp3"), "audio");
    await saveExportFiles(fs, folder, [
      { path: "First - Rekordbox USB.nml", data: "first" },
      { path: "Second - Rekordbox USB.nml", data: "second" },
      { path: "Serato DJ/Subcrates/Set - Rekordbox USB.crate", data: new Uint8Array([1, 2]) },
    ]);
    expect(await readFile(join(folder, "First - Rekordbox USB.nml"), "utf8")).toBe("existing");
    expect(await readFile(join(folder, "First - Rekordbox USB (2).nml"), "utf8")).toBe("first");
    expect(await readFile(join(folder, "Second - Rekordbox USB.nml"), "utf8")).toBe("second");
    expect([...await readFile(join(folder, "Serato DJ/Subcrates/Set - Rekordbox USB.crate"))]).toEqual([1, 2]);
    expect(await readFile(join(folder, "song.mp3"), "utf8")).toBe("audio");
    expect((await readdir(folder)).some((name) => name.endsWith(".zip"))).toBe(false);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

it.each(["../escape.nml", "C:/escape.nml", "/escape.nml", "song.mp3", "Subcrates/../../escape.crate", "foo\\escape.nml"])("rejects unsafe or non-playlist output %s", (path) => {
  expect(() => validateExportFiles([{ path, data: "data" }])).toThrow("Invalid playlist export");
});