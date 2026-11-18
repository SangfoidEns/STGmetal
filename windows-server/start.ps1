$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js 18+ required: https://nodejs.org/' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path 'node_modules\electron')) {
  Write-Host 'Installing Electron…'
  npm install
}

if (-not $env:PORT) { $env:PORT = '8787' }
if (-not $env:HOST) { $env:HOST = '127.0.0.1' }

Write-Host ''
Write-Host ' STGmetal — Windows server' -ForegroundColor DarkGreen
Write-Host " Port: $($env:PORT)  Bind: $($env:HOST)"
Write-Host ''
npm start
