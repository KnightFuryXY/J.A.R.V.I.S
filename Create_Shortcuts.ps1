# Configuration
$ProjectDir = (Get-Location).Path
$LauncherPath = Join-Path $ProjectDir "Start_JARVIS.vbs"
$ShortcutName = "MARK XXXV - JARVIS.lnk"

# Destination Paths
$DesktopPath = [Environment]::GetFolderPath("Desktop")
# Check for OneDrive Desktop
if (Test-Path "$HOME\OneDrive\Desktop") { $DesktopPath = "$HOME\OneDrive\Desktop" }

$StartupPath = [Environment]::GetFolderPath("Startup")

function Create-Shortcut {
    param ([string]$DestinationPath)
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($DestinationPath)
    $Shortcut.TargetPath = $LauncherPath
    $Shortcut.WorkingDirectory = $ProjectDir
    $Shortcut.Description = "Launch JARVIS Assistant (Mark XXXV)"
    $Shortcut.IconLocation = Join-Path $ProjectDir "icon.ico"
    $Shortcut.Save()
}

Write-Host "Creating Desktop shortcut..." -ForegroundColor Cyan
Create-Shortcut (Join-Path $DesktopPath $ShortcutName)

Write-Host "Creating Startup shortcut..." -ForegroundColor Cyan
Create-Shortcut (Join-Path $StartupPath $ShortcutName)

Write-Host "`n✅ Success! JARVIS will now start automatically when you log in." -ForegroundColor Green
Write-Host "You can also launch it from the shortcut on your Desktop." -ForegroundColor Green
