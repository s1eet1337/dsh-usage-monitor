$ErrorActionPreference = 'Stop'
$gbk = [System.Text.Encoding]::GetEncoding(936)
$utf8 = [System.Text.Encoding]::UTF8

$json = [System.IO.File]::ReadAllText('C:\Users\sjyhz\AppData\Roaming\dsh-desktop\harness\storages\session_projcache\sessions\session-66903b55-e1f8-4b1e-954a-841d2ac2d405.json', [System.Text.Encoding]::UTF8)
$obj = $json | ConvertFrom-Json
$title = $obj.record.rows.title.val
$decoded = $utf8.GetString($gbk.GetBytes($title))
[System.IO.File]::WriteAllText('C:\Users\sjyhz\Desktop\dsh-usage-monitor\scripts\decoded-title.txt', $decoded, $utf8)

$ws = [System.IO.File]::ReadAllText('C:\Users\sjyhz\AppData\Roaming\dsh-desktop\harness\storages\workspace.json', [System.Text.Encoding]::UTF8)
$wsobj = $ws | ConvertFrom-Json
$lines = @()
foreach ($key in $wsobj.tables.workspaces.PSObject.Properties.Name) {
  $w = $wsobj.tables.workspaces.$key
  $lines += ("workspace " + $key + " path=" + $w.path + " title=" + $utf8.GetString($gbk.GetBytes($w.title)))
}
[System.IO.File]::WriteAllLines('C:\Users\sjyhz\Desktop\dsh-usage-monitor\scripts\decoded-workspaces.txt', $lines, $utf8)
