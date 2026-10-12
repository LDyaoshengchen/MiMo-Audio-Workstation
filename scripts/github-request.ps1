param([string]$Uri, [string]$Method, [string]$BodyFile, [string]$ContentType)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (([Uri]$Uri).Host -notin @('api.github.com', 'uploads.github.com')) { throw 'Unexpected GitHub host' }
$headers = @{ Authorization = "Bearer $env:MIMO_RELEASE_TOKEN"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'MiMo-release' }
$parameters = @{ Uri=$Uri; Method=$Method; Headers=$headers; TimeoutSec=900 }
if ($BodyFile) { $parameters.InFile=$BodyFile; $parameters.ContentType=$ContentType }
try { $result = Invoke-RestMethod @parameters }
catch { Write-Output ("GITHUB_REQUEST_FAILED status=" + [string]$_.Exception.Response.StatusCode + " type=" + $_.Exception.GetType().Name); exit 1 }
ConvertTo-Json -InputObject $result -Depth 30 -Compress
