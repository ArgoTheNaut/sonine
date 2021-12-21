param(
[Parameter(Mandatory=$true)]$itemCSVfilePath,
[Parameter(Mandatory=$true)]$itemStatsCSVfilePath,
[Parameter(Mandatory=$true)]$exportCSVfilePath
)





cd ~\Desktop
$itemData = Import-Csv $itemCSVfilePath
$itemStatsData = Import-Csv $itemStatsCSVfilePath

$minData = @()


$itemData | foreach{
    $nextSong = [pscustomobject]@{
        GUID= "_"+$_.pid
        artist = $_.artist
        title = $_.title
        plays = -1
    }
    Write-Host "Processing " $nextSong.artist " - " $nextSong.title
   $nextSong.plays = ($itemStatsData | where {$nextSong.GUID -eq (“_” + $_.item_pid)}).play_count_user
$minData += $nextSong
}


$minData | Export-Csv -Path $exportCSVfilePath -NoTypeInformation
