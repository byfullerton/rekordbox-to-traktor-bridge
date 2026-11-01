import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import updater from "../../electron/update.cjs";

const { isNewer, evaluateRelease } = updater as {
  isNewer(a: string, b: string): boolean;
  evaluateRelease(r: unknown, v: string): { available: boolean; latest: string; url?: string };
};

const asset = { name: "USB-DJ-Bridge-Setup.exe", browser_download_url: "https://example.com/setup.exe" };

describe("desktop auto-update", () => {
  it("detects newer versions numerically, not alphabetically", () => {
    expect(isNewer("v1.10.0", "1.9.0")).toBe(true);
    expect(isNewer("1.0.1", "1.0.0")).toBe(true);
  });

  it("does not offer the same or an older version", () => {
    expect(isNewer("v1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("0.9.9", "1.0.0")).toBe(false);
  });

  it("offers the installer when a newer release has it attached", () => {
    const r = evaluateRelease({ tag_name: "v1.2.0", assets: [asset] }, "1.0.0");
    expect(r).toMatchObject({ available: true, latest: "1.2.0", url: asset.browser_download_url });
  });

  it("does not offer a newer release that has no installer yet", () => {
    expect(evaluateRelease({ tag_name: "v1.2.0", assets: [] }, "1.0.0").available).toBe(false);
  });
});
