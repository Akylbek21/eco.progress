$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$inputPath = Join-Path $base 'SEO-strategy-EcoProgress-2026-09-07.docx'
$outputPath = Join-Path $base 'SEO-strategy-EcoProgress-2026-09-07.pdf'
$donePath = Join-Path $base 'word-export.done'
$errorPath = Join-Path $base 'word-export.error.txt'
$word = $null
$doc = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($inputPath, $false, $true, $false)
    $doc.ExportAsFixedFormat($outputPath, 17, $false, 0, 0, 1, 9999, 0, $false, $false, 0, $false, $true, $false)
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
