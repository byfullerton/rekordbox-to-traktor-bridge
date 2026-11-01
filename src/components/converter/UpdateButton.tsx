import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest?: string;
  error?: string;
}

export interface UpdaterBridge {
  checkForUpdates(): Promise<UpdateInfo>;
  installUpdate(): Promise<{ ok: boolean; error?: string }>;
}

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest"; version: string }
  | { kind: "available"; version: string }
  | { kind: "installing" }
  | { kind: "error"; message: string };

/** Desktop-only: checks for a new version on launch and installs it on click. */
export function UpdateButton({ bridge }: { bridge: UpdaterBridge }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function check() {
    setState({ kind: "checking" });
    const r = await bridge.checkForUpdates();
    if (r.error) setState({ kind: "error", message: "Couldn't check for updates" });
    else if (r.available) setState({ kind: "available", version: r.latest ?? "" });
    else setState({ kind: "latest", version: r.current });
  }

  async function install() {
    setState({ kind: "installing" });
    const r = await bridge.installUpdate();
    if (!r.ok) setState({ kind: "error", message: "Update failed, try again" });
  }

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === "available")
    return (
      <Button size="sm" onClick={install}>
        <RefreshCw className="h-4 w-4" /> Install update v{state.version}
      </Button>
    );

  const label =
    state.kind === "checking"
      ? "Checking…"
      : state.kind === "installing"
        ? "Installing update…"
        : state.kind === "latest"
          ? `Up to date (v${state.version})`
          : state.kind === "error"
            ? state.message
            : "Check for updates";

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={check}
      disabled={state.kind === "checking" || state.kind === "installing"}
    >
      <RefreshCw className={state.kind === "checking" || state.kind === "installing" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {label}
    </Button>
  );
}
