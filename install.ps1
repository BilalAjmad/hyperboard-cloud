# HyperBoard installer - creates desktop shortcut
param([string]$InstallDir = $PSScriptRoot)
$desktop = [Environment]::GetFolderPath("Desktop")
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut("$desktop\HyperBoard.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -Command `"cd '$InstallDir'; pnpm dev`""
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "HyperBoard - Realtime Collaborative Whiteboard"
$shortcut.Save()
Write-Host "Desktop shortcut created: $desktop\HyperBoard.lnk"
Write-Host "Double-click it to start HyperBoard."