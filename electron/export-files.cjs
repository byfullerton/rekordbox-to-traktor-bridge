const path = require("node:path");

const EXTENSIONS = new Set([".nml", ".m3u8", ".crate", ".vdjfolder"]);

function validateExportFiles(files) {
  if (!Array.isArray(files) || !files.length) throw new Error("No playlists to save.");
  for (const file of files) {
    if (typeof file.path !== "string" || !file.path || file.path.includes("\\") ||
        file.path.split("/").some((part) => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part)) ||
        !EXTENSIONS.has(path.posix.extname(file.path).toLowerCase()) ||
        !(typeof file.data === "string" || file.data instanceof Uint8Array)) {
      throw new Error("Invalid playlist export.");
    }
  }
}

async function saveExportFiles(fs, destination, files) {
  validateExportFiles(files);
  const saved = [];
  for (const file of files) {
    const original = path.join(destination, ...file.path.split("/"));
    await fs.mkdir(path.dirname(original), { recursive: true });
    const parsed = path.parse(original);
    let candidate = original;
    for (let counter = 2; ; counter++) {
      try {
        await fs.writeFile(candidate, file.data, { flag: "wx" });
        saved.push(candidate);
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        candidate = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
      }
    }
  }
  return saved;
}

module.exports = { validateExportFiles, saveExportFiles };