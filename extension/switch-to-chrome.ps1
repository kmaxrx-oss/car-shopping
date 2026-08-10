Copy-Item -Path "$PSScriptRoot\manifest.chrome.json" -Destination "$PSScriptRoot\manifest.json" -Force
Write-Host "manifest.json is now the Chrome version (service worker + side panel)."