function Try-Url($url, $bodyJson) {
    try {
        $r = Invoke-WebRequest -Uri $url -Method POST -ContentType 'application/json' -Body $bodyJson -TimeoutSec 60
        Write-Output ("HTTP " + $r.StatusCode)
        Write-Output $r.Content
    } catch [System.Net.WebException] {
        $we = $_.Exception
        if ($we.Response) {
            $sr = New-Object System.IO.StreamReader($we.Response.GetResponseStream())
            Write-Output ("HTTP " + [int]$we.Response.StatusCode)
            Write-Output $sr.ReadToEnd()
        } else {
            Write-Output ("NETERR: " + $we.Message)
        }
    } catch {
        Write-Output ("ERR: " + $_.Exception.GetType().FullName + " :: " + $_.Exception.Message)
        if ($_.Exception.InnerException) { Write-Output ("INNER: " + $_.Exception.InnerException.Message) }
    }
}

Write-Output "=== /health ==="
try { $h = Invoke-WebRequest -Uri http://localhost:8080/health -TimeoutSec 10; Write-Output $h.Content } catch { Write-Output ("HEALTH ERR: " + $_.Exception.Message) }

$body = [ordered]@{
    dat_path   = 'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\data\2A_DA_111017_115542.dat'
    wave       = 'Img1'
    max_records = 5
    start_record = 10
    step       = 10
    niti_type  = 'Gra+Bin'
    grad_type  = 0
    gain       = 1
    threshold  = 30
    color_point = 150
    area_x     = 32
    area_y     = 29
    area_w     = 41
    area_h     = 37
    black      = $true
} | ConvertTo-Json -Compress

Write-Output "=== /api/graph/make ==="
Try-Url -url http://localhost:8080/api/graph/make -bodyJson $body
