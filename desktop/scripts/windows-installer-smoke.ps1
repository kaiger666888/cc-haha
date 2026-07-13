[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ArtifactsDir,
  [ValidateSet('x64')][string]$Arch = 'x64'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:CI -ne 'true') {
  throw 'This installer smoke mutates Windows installer registry state and may run only on an ephemeral CI runner.'
}

$resolvedArtifactsDir = (Resolve-Path -LiteralPath $ArtifactsDir).Path
$installers = @(Get-ChildItem -LiteralPath $resolvedArtifactsDir -File |
  Where-Object { $_.Name -like "Claude-Code-Haha-*-win-$Arch.exe" })
if ($installers.Count -ne 1) {
  throw "Expected exactly one Windows $Arch installer in $resolvedArtifactsDir, found $($installers.Count)."
}
$installer = $installers[0].FullName

$testRoot = Join-Path ([IO.Path]::GetTempPath()) "cc-haha-installer-smoke-$([Guid]::NewGuid().ToString('N'))"
$installDir = Join-Path $testRoot 'Claude Code Haha'
$appData = Join-Path $testRoot 'AppData\Roaming'
$localAppData = Join-Path $testRoot 'AppData\Local'
$userProfile = Join-Path $testRoot 'UserProfile'
$appExe = Join-Path $installDir 'Claude Code Haha.exe'
$uninstaller = Join-Path $installDir 'Uninstall Claude Code Haha.exe'

$savedEnvironment = @{}
foreach ($name in @('APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'CLAUDE_CONFIG_DIR', 'CC_HAHA_APP_PORTABLE_DIR')) {
  $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Invoke-CheckedInstaller {
  param(
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $process = Start-Process -FilePath $installer -ArgumentList $Arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "$Stage failed with installer exit code $($process.ExitCode)."
  }
}

try {
  New-Item -ItemType Directory -Path $appData, $localAppData, $userProfile -Force | Out-Null
  $env:APPDATA = $appData
  $env:LOCALAPPDATA = $localAppData
  $env:USERPROFILE = $userProfile
  Remove-Item Env:CLAUDE_CONFIG_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:CC_HAHA_APP_PORTABLE_DIR -ErrorAction SilentlyContinue

  Invoke-CheckedInstaller -Stage 'Fresh install' -Arguments @('/S', '/currentuser', "/D=$installDir")
  if (-not (Test-Path -LiteralPath $appExe -PathType Leaf)) {
    throw "Fresh install did not create the application executable: $appExe"
  }

  Invoke-CheckedInstaller -Stage 'Default-mode reinstall' -Arguments @('--updated', '/S', '/currentuser', "/D=$installDir")
  if (-not (Test-Path -LiteralPath $appExe -PathType Leaf)) {
    throw "Reinstall removed the application executable: $appExe"
  }

  [Console]::Out.WriteLine('Windows installer fresh-install and default-mode reinstall smoke passed.')
} finally {
  if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
    Start-Process -FilePath $uninstaller -ArgumentList @('/S', '/KEEP_APP_DATA', '/currentuser') -Wait | Out-Null
  }
  foreach ($name in $savedEnvironment.Keys) {
    $value = $savedEnvironment[$name]
    if ($null -eq $value) {
      [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    } else {
      [Environment]::SetEnvironmentVariable($name, [string]$value, 'Process')
    }
  }
  Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
