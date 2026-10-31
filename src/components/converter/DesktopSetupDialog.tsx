import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Cmd = ({ children }: { children: string }) => (
  <pre className="rounded border border-border bg-background px-3 py-2 font-mono text-xs text-primary">{children}</pre>
);

export function DesktopSetupDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Monitor className="h-4 w-4" /> Desktop (.exe) Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Build the Windows desktop app (.exe)</DialogTitle>
          <DialogDescription>
            The browser version already converts USB sticks. The native .exe adds automatic drive letter detection and
            direct native file access.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li>
            <h3 className="font-semibold">1. Download the codebase</h3>
            <p className="text-muted-foreground">
              In Lovable, open <b>Project settings → Git → Download codebase</b> (paid plans), or click{" "}
              <b>Download codebase</b> at the bottom of the Code editor's file panel. Alternatively, connect the
              project to GitHub with Git sync and clone or download the repository. Unzip it to a folder on your PC.
            </p>
          </li>
          <li>
            <h3 className="font-semibold">2. Install prerequisites</h3>
            <p className="text-muted-foreground">
              Install <b>Node.js LTS</b> from nodejs.org (this includes npm). Restart your terminal afterwards.
            </p>
          </li>
          <li>
            <h3 className="font-semibold">3. Run these commands</h3>
            <p className="mb-2 text-muted-foreground">
              Open PowerShell or Command Prompt in the project folder, then run:
            </p>
            <div className="space-y-2">
              <Cmd>npm install</Cmd>
              <Cmd>npm install --save-dev electron @electron/packager</Cmd>
              <Cmd>npm run electron:package</Cmd>
            </div>
          </li>
          <li>
            <h3 className="font-semibold">4. Find your executable</h3>
            <p className="text-muted-foreground">The app is created at:</p>
            <Cmd>electron-release/USB-NML-win32-x64/USB-NML.exe</Cmd>
            <p className="mt-2 text-muted-foreground">
              Keep the whole <span className="font-mono">USB-NML-win32-x64</span> folder together; zip it to share.
            </p>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
