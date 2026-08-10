Copy-Item -Path "$PSScriptRoot\manifest.firefox.json" -Destination "$PSScriptRoot\manifest.json" -Force
Write-Host "manifest.json is now the Firefox version (background scripts + sidebar)."