import type { ExportFile } from "./exporters";

export async function saveFilesToDirectory(directory: FileSystemDirectoryHandle, files: ExportFile[]) {
  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop();
    if (!name) throw new Error("Missing playlist filename");
    let folder = directory;
    for (const part of parts) folder = await folder.getDirectoryHandle(part, { create: true });
    const dot = name.lastIndexOf(".");
    let candidate = name;
    for (let counter = 2; ; counter++) {
      try {
        await folder.getFileHandle(candidate);
        candidate = `${name.slice(0, dot)} (${counter})${name.slice(dot)}`;
      } catch (error) {
        if ((error as Error).name !== "NotFoundError") throw error;
        break;
      }
    }
    const handle = await folder.getFileHandle(candidate, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(typeof file.data === "string" ? file.data : new Blob([file.data as BlobPart]));
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
  }
}