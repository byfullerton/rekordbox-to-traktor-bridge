// Pure helpers for the desktop auto-updater (no Electron imports, so they are unit-testable).
const REPO = "byfullerton/rekordbox-to-traktor-bridge";
const ASSET_NAME = "USB-DJ-Bridge-Setup.exe";
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

function parseVersion(v) {
  return String(v || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

/** True when `latest` is a strictly newer semantic version than `current`. */
function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Turns a GitHub "latest release" response into an update decision. */
function evaluateRelease(release, currentVersion) {
  const latest = String(release?.tag_name || "").replace(/^v/i, "");
  const asset = (release?.assets || []).find((a) => a.name === ASSET_NAME);
  if (!latest || !asset || !isNewer(latest, currentVersion)) {
    return { available: false, current: currentVersion, latest: latest || currentVersion };
  }
  return { available: true, current: currentVersion, latest, url: asset.browser_download_url };
}

module.exports = { REPO, ASSET_NAME, LATEST_RELEASE_API, isNewer, evaluateRelease };
