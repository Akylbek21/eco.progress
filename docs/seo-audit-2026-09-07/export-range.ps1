param(
    [Parameter(Mandatory = $true)][int]$From,
    [Parameter(Mandatory = $true)][int]$To
)

$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$inputPath = Join-Path $base 'SEO-strategy-EcoProgress-2026-09-07.docx'
$outputPath = Join-Path $base ("render-part-{0:D3}-{1:D3}.pdf" -f $From, $To)
$donePath = Join-Path $base ("render-part-{0:D3}-{1:D3}.done" -f $From, $To)
$errorPath = Join-Path $base ("render-part-{0:D3}-{1:D3}.error.txt" -f $From, $To)
$word = $null
$doc = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($inputPath, $false, $true, $false)
    $doc.ExportAsFixedFormat($outputPath, 17, $false, 0, 3, $From, $To, 0, $false, $false, 0, $false, $true, $false)
    Set-Content -LiteralPath $donePath -Value 'ok' -Encoding utf8
}
catch {
    Set-Content -LiteralPath $errorPath -Value ($_ | Out-String) -Encoding utf8
}
finally {
    if ($doc) { $doc.Close($false) }
    if ($word) { $word.Quit() }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
