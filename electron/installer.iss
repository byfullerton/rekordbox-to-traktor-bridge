; Inno Setup script: bundles the packaged Electron folder into one setup .exe.
; The app's support files are installed into the user's Programs folder, not next to the download.
#define AppName "USB DJ Bridge"
#define AppExe "USB-NML.exe"

[Setup]
AppId={{6E0B5A61-3C2B-4C3E-9C1D-USBDJBRIDGE01}
AppName={#AppName}
AppVersion=1.0.0
AppPublisher=USB DJ Bridge
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=..\electron-release
OutputBaseFilename=USB-DJ-Bridge-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExe}

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\electron-release\USB-NML-win32-x64\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent
