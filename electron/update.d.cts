declare const updater: {
  REPO: string;
  ASSET_NAME: string;
  LATEST_RELEASE_API: string;
  isNewer(latest: string, current: string): boolean;
  evaluateRelease(
    release: unknown,
    currentVersion: string,
  ): { available: boolean; current: string; latest: string; url?: string };
};
export = updater;
