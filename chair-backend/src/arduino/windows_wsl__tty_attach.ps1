
# This script scans every three seconds wether the connection routing from ttyCOM0 to wsl
# /dev/ttyUSB0 is still alive, and if not it restarts it. The session is not persistent.
while ($true) {
    $device = usbipd list | Select-String "0403:6001"
    if ($device) {
        $line = $device.ToString().Trim()
        $busid = ($line -split '\s+')[0]
        $isAttached = $line -match "Attached"
        if (-not $isAttached) {
            usbipd attach --wsl --busid $busid
            Write-Host "Attached $busid"
        }
    }
    Start-Sleep -Seconds 3
}
