$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $root "..")

Get-ChildItem -Path $repo -Recurse -Filter *.b64 | ForEach-Object {
  $inPath = $_.FullName
  $outPath = $inPath -replace '\.b64$',''
  $b64 = Get-Content $inPath -Raw
  [IO.File]::WriteAllBytes($outPath, [Convert]::FromBase64String($b64))
  Write-Host "Decoded $outPath"
}
