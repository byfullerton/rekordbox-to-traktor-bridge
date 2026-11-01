import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConverterApp } from "./ConverterApp";
import { strFromU8, unzipSync } from "fflate";

afterEach(() => {
  cleanup();
  delete window.usbBridge;
});

it("exports every checked playlist separately, regardless of the active playlist", async () => {
  const saveFile = vi.fn().mockResolvedValue(true);
  window.usbBridge = { pickFolder: vi.fn(), readFile: vi.fn(), saveFile };
  const { container } = render(<ConverterApp />);
  const input = container.querySelector('input[accept=".xml"]');
  if (!input) throw new Error("Missing XML input");
  const file = new File([], "library.xml", { type: "application/xml" });
  Object.defineProperty(file, "text", { value: async () => `
    <DJ_PLAYLISTS><COLLECTION Entries="3">
      <TRACK TrackID="1" Name="One" Location="file://localhost/E:/Contents/one.mp3"/>
      <TRACK TrackID="2" Name="Two" Location="file://localhost/E:/Contents/two.mp3"/>
      <TRACK TrackID="3" Name="Three" Location="file://localhost/E:/Contents/three.mp3"/>
    </COLLECTION><PLAYLISTS><NODE Type="0" Name="ROOT">
      <NODE Type="1" Name="First"><TRACK Key="2"/><TRACK Key="1"/></NODE>
      <NODE Type="1" Name="Second"><TRACK Key="3"/><TRACK Key="1"/></NODE>
      <NODE Type="1" Name="Unselected"><TRACK Key="2"/></NODE>
    </NODE></PLAYLISTS></DJ_PLAYLISTS>` });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select First" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Second" }));
  fireEvent.click(screen.getByRole("button", { name: /^First$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected (2)" }));
  await waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
  expect(saveFile.mock.calls[0]?.[0]).toBe("usb-E-traktor.zip");
  const data = saveFile.mock.calls[0]?.[1];
  if (!(data instanceof Uint8Array)) throw new Error("Missing exported batch ZIP");
  const files = unzipSync(data);
  expect(Object.keys(files)).toEqual([
    "Traktor Pro 4/First - Rekordbox USB.nml",
    "Traktor Pro 4/Second - Rekordbox USB.nml",
  ]);
  const docs = Object.values(files).map((file) => new DOMParser().parseFromString(strFromU8(file), "application/xml"));
  expect(docs.map((doc) => doc.querySelector('NODE[NAME="$ROOT"] > SUBNODES > NODE')?.getAttribute("NAME")))
    .toEqual(["First - Rekordbox USB", "Second - Rekordbox USB"]);
  expect(docs.map((doc) => [...doc.querySelectorAll("PRIMARYKEY")].map((key) => key.getAttribute("KEY"))))
    .toEqual([
      ["E:/:Contents/:two.mp3", "E:/:Contents/:one.mp3"],
      ["E:/:Contents/:three.mp3", "E:/:Contents/:one.mp3"],
    ]);
  expect(new Set(docs.map((doc) => doc.querySelector("PLAYLIST")?.getAttribute("UUID"))).size).toBe(2);
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Second" }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected (1)" }));
  await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
  expect(saveFile.mock.calls[1]?.[0]).toBe("First - Rekordbox USB.nml");
  expect(typeof saveFile.mock.calls[1]?.[1]).toBe("string");
});
it("hides the desktop setup button inside the desktop app", async () => {
  window.usbBridge = { pickFolder: vi.fn(), readFile: vi.fn(), saveFile: vi.fn() };
  render(<ConverterApp />);
  await waitFor(() => expect(screen.queryByRole("link", { name: /Download for Windows/ })).toBeNull());
});

it("shows the desktop setup button in the browser", () => {
  render(<ConverterApp />);
  expect(screen.getByRole("link", { name: /Download for Windows/ })).toBeTruthy();
});

it("links the Windows download straight to the latest setup file", () => {
  render(<ConverterApp />);
  expect(screen.getByRole("link", { name: /Download for Windows/ }).getAttribute("href")).toBe(
    "https://github.com/byfullerton/rekordbox-to-traktor-bridge/releases/latest/download/USB-DJ-Bridge-Setup.exe",
  );
});

it("shows the SmartScreen note only after clicking download, then starts the download", () => {
  render(<ConverterApp />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: /Download for Windows/ }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("More info");
  expect(dialog.textContent).toContain("Run anyway");
  const downloadNow = screen.getByRole("link", { name: /Download now/ });
  expect(downloadNow.getAttribute("href")).toBe(
    "https://github.com/byfullerton/rekordbox-to-traktor-bridge/releases/latest/download/USB-DJ-Bridge-Setup.exe",
  );
  fireEvent.click(downloadNow);
  expect(screen.queryByRole("dialog")).toBeNull();
});
