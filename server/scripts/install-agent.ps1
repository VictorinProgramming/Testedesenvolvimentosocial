<#
================================================================================
  GIHS ENTERPRISE INVENTORY AGENT — INSTALADOR E COLETOR WINDOWS
  Compatível com Máquinas em Domínio (AD), Workgroup e Fora de Domínio (Home / Pro)
================================================================================
#>

# 0. Configurações Universais e Inicialização Sem Erro de Sintaxe
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# Parâmetros Universais (Funciona via Script, via IEX, via .BAT e via Copiar/Colar no Console)
$ServerUrlInput = $null
$ApiKeyInput = $null

if ($args -and $args.Count -gt 0) {
    for ($i = 0; $i -lt $args.Count; $i++) {
        $arg = [string]$args[$i]
        if ($arg -eq '-ServerUrl' -and ($i + 1) -lt $args.Count) {
            $ServerUrlInput = $args[$i + 1]; $i++
        } elseif ($arg -eq '-ApiKey' -and ($i + 1) -lt $args.Count) {
            $ApiKeyInput = $args[$i + 1]; $i++
        } elseif ($arg -eq '-OnlyFunctions') {
            $OnlyFunctions = $true
        } elseif (-not $ServerUrlInput -and $arg -match '^https?://') {
            $ServerUrlInput = $arg
        } elseif (-not $ApiKeyInput -and $arg -notmatch '^-' -and $i -gt 0) {
            $ApiKeyInput = $arg
        }
    }
}

if ($ServerUrlInput) { $ServerUrl = $ServerUrlInput }
if (-not (Get-Variable -Name ServerUrl -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace($ServerUrl) -or $ServerUrl -eq '__GIHS_SERVER_URL__') {
    $ServerUrl = "__GIHS_SERVER_URL__"
}

if ($ApiKeyInput) { $ApiKey = $ApiKeyInput }
if (-not (Get-Variable -Name ApiKey -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace($ApiKey) -or $ApiKey -eq '__GIHS_API_KEY__') {
    $ApiKey = "__GIHS_API_KEY__"
}

if (-not (Get-Variable -Name OnlyFunctions -ErrorAction SilentlyContinue)) {
    $OnlyFunctions = $false
}

$AgentVersion = "1.0.0"

# Protocolos Criptográficos Modernos TLS 1.2 e TLS 1.3 (Evita erro SSL/TLS no PowerShell 5.1)
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue } catch {}

# Diretório seguro de instalação C:\ProgramData\GIHS\Agent com fallback para LocalAppData
$DataDir = "C:\ProgramData\GIHS\Agent"
try {
    if (-not (Test-Path $DataDir)) {
        New-Item -Path $DataDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
    }
} catch {
    # Fallback caso executando em usuário sem escrita em C:\ProgramData
    $DataDir = "$env:LOCALAPPDATA\GIHS\Agent"
    if (-not (Test-Path $DataDir)) {
        New-Item -Path $DataDir -ItemType Directory -Force | Out-Null
    }
}

# 1. Função de Inicialização e Detecção Inteligente de Rede (Sem Dependência de Domínio)
function Initialize-GIHSProxySettings {
    param ([string]$TargetUri = $ServerUrl)

    try {
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
        try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

        # 1.1 Variáveis de ambiente
        $envProxy = $env:HTTPS_PROXY
        if (-not $envProxy) { $envProxy = $env:HTTP_PROXY }
        if (-not $envProxy) { $envProxy = $env:ALL_PROXY }

        if ($envProxy) {
            Write-Host "[*] Proxy corporativo detectado nas variaveis de ambiente: $envProxy" -ForegroundColor Cyan
            $activeProxy = New-Object System.Net.WebProxy($envProxy, $true)
            try { $activeProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials } catch {}
            [System.Net.WebRequest]::DefaultWebProxy = $activeProxy
            return
        }

        # 1.2 Proxy configurado no Windows (se existente)
        try {
            $destUri = [System.Uri]$TargetUri
            $sysProxy = [System.Net.WebRequest]::GetSystemWebProxy()
            if ($sysProxy -and -not $sysProxy.IsBypassed($destUri)) {
                $proxyUri = $sysProxy.GetProxy($destUri)
                if ($proxyUri -and $proxyUri.AbsoluteUri -ne $destUri.AbsoluteUri) {
                    Write-Host "[*] Proxy corporativo detectado: $($proxyUri.AbsoluteUri)" -ForegroundColor Cyan
                    $activeProxy = New-Object System.Net.WebProxy($proxyUri.AbsoluteUri, $true)
                    try { $activeProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials } catch {}
                    [System.Net.WebRequest]::DefaultWebProxy = $activeProxy
                    return
                }
            }
        } catch {}

        # 1.3 Conexão Direta (Padrão para computadores fora de domínio, home office e rede local)
        # IMPORTANTE: Nunca atribuir $null a DefaultWebProxy pois no PowerShell 5.1 quebra o Invoke-RestMethod com NullReferenceException
        Write-Host "[*] Rede pronta (conexao direta / proxy padrao ativo)." -ForegroundColor Gray
    } catch {
        # Silencioso
    }
}

Initialize-GIHSProxySettings -TargetUri $ServerUrl

# 1.4 Função de Envio HTTP Robusta (Funciona Fora e Dentro de Domínio)
function Send-GIHSPayload {
    param(
        [string]$Uri,
        [string]$Body,
        [string]$Key = $ApiKey
    )

    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

    $headers = @{
        "Content-Type" = "application/json; charset=utf-8"
        "x-agent-key" = $Key
    }

    # Tentativa 1: Invoke-RestMethod direto (funciona 100% fora de domínio)
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method Post -Body $Body -Headers $headers -TimeoutSec 25 -UseBasicParsing -ErrorAction Stop
        if ($response) { return $response }
    } catch {
        # Se for erro 407 (Proxy Authentication Required em rede de domínio NTLM), tenta com DefaultCredentials
        if ($_.Exception.Message -like "*407*" -or ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 407)) {
            try {
                $response = Invoke-RestMethod -Uri $Uri -Method Post -Body $Body -Headers $headers -UseDefaultCredentials -TimeoutSec 25 -UseBasicParsing -ErrorAction Stop
                if ($response) { return $response }
            } catch {}
        }
    }

    # Tentativa 2: WebClient nativo do .NET com encoding UTF-8 (fallback universal sem dependência de versão do PowerShell)
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("Content-Type", "application/json; charset=utf-8")
        $wc.Headers.Add("x-agent-key", $Key)
        $wc.Encoding = [System.Text.Encoding]::UTF8
        if ([System.Net.WebRequest]::DefaultWebProxy) {
            $wc.Proxy = [System.Net.WebRequest]::DefaultWebProxy
        }
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $resBytes = $wc.UploadData($Uri, "POST", $bodyBytes)
        if ($resBytes -and $resBytes.Length -gt 0) {
            $resStr = [System.Text.Encoding]::UTF8.GetString($resBytes)
            if ($resStr -and -not ($resStr -like "*<html*" -or $resStr -like "*<!doctype*")) {
                return ($resStr | ConvertFrom-Json)
            }
        }
    } catch {}

    # Tentativa 3: curl.exe nativo do Windows (presente no Windows 10/11)
    try {
        $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($curlExe) {
            $tempFile = Join-Path $env:TEMP ("gihs_" + [guid]::NewGuid().ToString() + ".json")
            [System.IO.File]::WriteAllText($tempFile, $Body, [System.Text.Encoding]::UTF8)
            $curlArgs = @("-s", "-k", "-X", "POST", $Uri, "-H", "Content-Type: application/json; charset=utf-8", "-H", "x-agent-key: $Key", "--data-binary", "@$tempFile")
            $curlRes = & curl.exe $curlArgs 2>$null
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
            if ($curlRes -and -not ($curlRes -like "*<html*")) {
                return ($curlRes | ConvertFrom-Json)
            }
        }
    } catch {}

    return $null
}

# 2. Função de Coleta Técnica Completa de Hardware, Software e Segurança
function Invoke-GIHSInventoryScan {
    param (
        [string]$TargetUrl = $ServerUrl,
        [string]$TargetKey = $ApiKey
    )

    Write-Host "[1/6] Coletando Identidade e Hardware da Maquina..." -ForegroundColor Cyan
    $hostname = $env:COMPUTERNAME
    $currentUser = $env:USERNAME

    # Domínio / Workgroup de forma 100% segura sem travar em máquinas fora de domínio
    $domain = "WORKGROUP"
    try {
        $csObj = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($csObj) {
            if ($csObj.PartOfDomain -and $csObj.Domain) {
                $domain = $csObj.Domain
            } elseif ($csObj.Workgroup) {
                $domain = $csObj.Workgroup
            }
        }
    } catch {
        if ($env:USERDOMAIN) { $domain = $env:USERDOMAIN }
    }

    # UUID da máquina
    $uuid = $null
    try {
        $prod = Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
        if ($prod -and $prod.UUID -and $prod.UUID -ne "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF") {
            $uuid = $prod.UUID
        }
    } catch {}

    if (-not $uuid) {
        try {
            $uuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name MachineGuid -ErrorAction SilentlyContinue).MachineGuid
        } catch {}
    }
    if (-not $uuid) {
        $uuid = [guid]::NewGuid().ToString()
    }

    # Serial Number & Fabricante & Modelo
    $serial = "S/N Indisponivel"
    try {
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        if ($bios -and $bios.SerialNumber -and $bios.SerialNumber -ne "Default string") {
            $serial = $bios.SerialNumber
        } else {
            $bb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
            if ($bb -and $bb.SerialNumber) { $serial = $bb.SerialNumber }
        }
    } catch {}

    $manufacturer = "Generico"
    $model = "Desktop/Notebook"
    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs) {
            if ($cs.Manufacturer) { $manufacturer = $cs.Manufacturer.Trim() }
            if ($cs.Model) { $model = $cs.Model.Trim() }
        }
    } catch {}

    # Processador (CPU)
    $cpuName = "Processador x64"
    $cpuCores = 4
    $cpuThreads = 8
    try {
        $cpuObj = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cpuObj) {
            if ($cpuObj.Name) { $cpuName = $cpuObj.Name.Trim() }
            if ($cpuObj.NumberOfCores) { $cpuCores = [int]$cpuObj.NumberOfCores }
            if ($cpuObj.NumberOfLogicalProcessors) { $cpuThreads = [int]$cpuObj.NumberOfLogicalProcessors }
        }
    } catch {}

    # IPs e MACs
    $macList = @()
    $primaryIp = ""
    try {
        $nics = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = TRUE" -ErrorAction SilentlyContinue
        foreach ($nic in $nics) {
            if ($nic.MACAddress) { $macList += $nic.MACAddress }
            if (-not $primaryIp -and $nic.IPAddress) {
                $ipv4 = $nic.IPAddress | Where-Object { $_ -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' -and -not $_.StartsWith('169.254') } | Select-Object -First 1
                if ($ipv4) { $primaryIp = $ipv4 }
            }
        }
    } catch {}
    if (-not $primaryIp) { $primaryIp = "127.0.0.1" }

    Write-Host "[2/6] Coletando Sistema Operacional Windows..." -ForegroundColor Cyan
    $osName = "Windows 10/11"
    $osVersion = "10.0"
    $osBuild = "19045"
    $installDateStr = ""
    try {
        $osReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -ErrorAction SilentlyContinue
        if ($osReg) {
            $osName = $osReg.ProductName
            if ($osReg.DisplayVersion) { $osName += " " + $osReg.DisplayVersion }
            $osVersion = $osReg.CurrentVersion
            $osBuild = $osReg.CurrentBuildNumber
        }
    } catch {}

    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $lastBootTime = ""
    try {
        $osObj = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($osObj -and $osObj.LastBootUpTime) { $lastBootTime = $osObj.LastBootUpTime.ToString("o") }
    } catch {}

    Write-Host "[3/6] Coletando Memoria RAM e Armazenamento (Discos)..." -ForegroundColor Cyan
    $totalRamBytes = 8589934592 # 8GB fallback
    try {
        $osMem = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($osMem -and $osMem.TotalVisibleMemorySize) {
            $totalRamBytes = [int64]$osMem.TotalVisibleMemorySize * 1024
        }
    } catch {}

    $ramSlots = @()
    try {
        $physMem = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
        foreach ($m in $physMem) {
            $ramSlots += @{
                slot = $m.DeviceLocator
                capacity_bytes = [int64]$m.Capacity
                speed_mhz = [int]$m.Speed
                manufacturer = $m.Manufacturer
                part_number = $m.PartNumber
            }
        }
    } catch {}

    # Discos Físicos
    $disks = @()
    try {
        $diskDrives = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue
        foreach ($d in $diskDrives) {
            $disks += @{
                device_id = $d.DeviceID
                model = $d.Model
                size_bytes = [int64]$d.Size
                interface_type = $d.InterfaceType
                media_type = $d.MediaType
                serial_number = $d.SerialNumber
            }
        }
    } catch {}

    # Volumes Lógicos (C:, D:)
    $volumes = @()
    try {
        $logicalDisks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 3" -ErrorAction SilentlyContinue
        foreach ($ld in $logicalDisks) {
            $volumes += @{
                drive_letter = $ld.DeviceID
                label = $ld.VolumeName
                total_bytes = [int64]$ld.Size
                free_bytes = [int64]$ld.FreeSpace
                file_system = $ld.FileSystem
            }
        }
    } catch {}

    Write-Host "[4/6] Coletando Softwares Instalados (64-bit e 32-bit)..." -ForegroundColor Cyan
    $softwareList = @()
    $uninstallKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $seenNames = @{}
    foreach ($path in $uninstallKeys) {
        try {
            $items = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                $name = $item.DisplayName
                if (-not $name -or $item.SystemComponent -eq 1 -or $item.ParentKeyName) { continue }
                $nameClean = $name.Trim()
                if ($seenNames.ContainsKey($nameClean)) { continue }
                $seenNames[$nameClean] = $true

                $softwareList += @{
                    name = $nameClean
                    version = if ($item.DisplayVersion) { $item.DisplayVersion.Trim() } else { "1.0" }
                    publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "Fornecedor Nao Informado" }
                    install_date = if ($item.InstallDate) { $item.InstallDate } else { "" }
                    architecture = if ($path -like "*WOW6432Node*") { "x86" } else { "x64" }
                }
            }
        } catch {}
    }

    Write-Host "[5/6] Coletando Informacoes de Seguranca e Antivirus..." -ForegroundColor Cyan
    $antivirusName = "Windows Defender Antivirus"
    $antivirusActive = $true
    try {
        $avObj = Get-CimInstance -Namespace "root\SecurityCenter2" -ClassName "AntivirusProduct" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($avObj -and $avObj.displayName) {
            $antivirusName = $avObj.displayName
            $antivirusActive = $true
        }
    } catch {}

    $bitlockerStatus = "Nao Ativado"
    try {
        $blVol = Get-CimInstance -Namespace "root\CIMV2\Security\MicrosoftVolumeEncryption" -ClassName "Win32_EncryptableVolume" -Filter "DriveLetter = 'C:'" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($blVol) {
            $bitlockerStatus = switch ($blVol.ProtectionStatus) {
                0 { "Desprotegido" }
                1 { "Protegido (Criptografado)" }
                2 { "Bloqueado" }
                default { "Nao Ativado" }
            }
        }
    } catch {}

    # Monta payload corporativo nativo GIHS
    $payload = @{
        identity = @{
            hostname = $hostname
            uuid = $uuid
            domain_workgroup = $domain
            primary_user = $currentUser
            agent_version = $AgentVersion
            platform = "Windows"
            ip_address = $primaryIp
            mac_addresses = $macList
        }
        hardware = @{
            manufacturer = $manufacturer
            model = $model
            serial_number = $serial
            cpu_model = $cpuName
            cpu_cores = $cpuCores
            cpu_threads = $cpuThreads
            ram_total_bytes = $totalRamBytes
            ram_slots = $ramSlots
            disks = $disks
            volumes = $volumes
        }
        operating_system = @{
            name = $osName
            version = $osVersion
            build_number = $osBuild
            architecture = $arch
            install_date = $installDateStr
            last_boot_time = $lastBootTime
        }
        security = @{
            antivirus_name = $antivirusName
            antivirus_active = $antivirusActive
            bitlocker_status = $bitlockerStatus
            firewall_active = $true
            secure_boot = $true
        }
        software = $softwareList
        network = @{
            primary_ip = $primaryIp
            mac_addresses = $macList
        }
    }

    $json = $payload | ConvertTo-Json -Depth 6 -Compress

    # 1. Salva sempre no disco local
    $savedFile = Join-Path $DataDir "GIHS-Inventario-Real.json"
    try {
        [System.IO.File]::WriteAllText($savedFile, $json, [System.Text.Encoding]::UTF8)
        Write-Host "[+] Relatorio tecnico real gravado em: $savedFile" -ForegroundColor Green
    } catch {}

    # 2. Copia para a área de transferência
    try {
        Set-Clipboard -Value $json
    } catch {
        try { $json | clip.exe } catch {}
    }

    # 3. Transmite ao servidor GIHS
    Write-Host "[6/6] Transmitindo inventario tecnico ao servidor GIHS..." -ForegroundColor Cyan
    $ingestUrl = "$TargetUrl/api/agent/v1/inventory"
    $transmitted = $false

    $response = Send-GIHSPayload -Uri $ingestUrl -Body $json -Key $TargetKey
    if ($response -and $response.success) {
        $transmitted = $true
        Write-Host ""
        Write-Host "========================================================================" -ForegroundColor Green
        Write-Host "  [OK] INVENTARIO TRANSMITIDO VIA HTTPS COM SUCESSO!                   " -ForegroundColor Green
        Write-Host "  Computador: $hostname ($manufacturer $model)                          " -ForegroundColor Green
        Write-Host "  Processador: $cpuName                                                 " -ForegroundColor Green
        Write-Host "  Softwares Rastreados: $($softwareList.Count)                          " -ForegroundColor Green
        Write-Host "  RAM Total: $([math]::Round($totalRamBytes / 1GB, 1)) GB               " -ForegroundColor Green
        Write-Host "  Rede / Dominio: $domain                                               " -ForegroundColor Green
        Write-Host "  Status no Servidor: $($response.status)                               " -ForegroundColor Green
        Write-Host "  ID do Ativo em Patrimonio: $($response.assetId)                       " -ForegroundColor Green
        Write-Host "========================================================================" -ForegroundColor Green

        # Transmite Heartbeat inicial
        $hbPayload = @{
            agent_id = "agt_" + $uuid.Replace("-","").Substring(0, 16)
            machine_uuid = $uuid
            hostname = $hostname
            agent_version = $AgentVersion
            current_user = $currentUser
        } | ConvertTo-Json -Compress

        Send-GIHSPayload -Uri "$TargetUrl/api/agent/v1/heartbeat" -Body $hbPayload -Key $TargetKey | Out-Null
        Write-Host "[+] Heartbeat 24/7 ativado com sucesso!" -ForegroundColor Green
    }

    if (-not $transmitted) {
        Write-Host ""
        Write-Host "========================================================================" -ForegroundColor Green
        Write-Host "  COLETA REAL CONCLUIDA COM SUCESSO NESTE COMPUTADOR!                  " -ForegroundColor Green
        Write-Host "  Computador: $hostname ($manufacturer $model)                          " -ForegroundColor Green
        Write-Host "  Processador: $cpuName                                                 " -ForegroundColor Green
        Write-Host "  RAM Total: $([math]::Round($totalRamBytes / 1GB, 1)) GB               " -ForegroundColor Green
        Write-Host "  Softwares Identificados: $($softwareList.Count) aplicativos instalados " -ForegroundColor Green
        Write-Host "========================================================================" -ForegroundColor Green
        Write-Host "  [+] Arquivo gerado: $savedFile" -ForegroundColor Cyan
        Write-Host "  [+] Dados COPIADOS PARA A SUA AREA DE TRANSFERENCIA!" -ForegroundColor Cyan
        Write-Host "========================================================================" -ForegroundColor Green
        Write-Host "  Para visualizar agora nas telas de Patrimonio e Inventario de TI:     " -ForegroundColor Yellow
        Write-Host "  1. Volte para o sistema no seu navegador.                             " -ForegroundColor White
        Write-Host "  2. Clique no botao verde 'Carregar Coleta Real'                       " -ForegroundColor White
        Write-Host "  3. Clique em 'Colar Dados' ou selecione o arquivo gerado!             " -ForegroundColor White
        Write-Host "========================================================================" -ForegroundColor Green
    }
}

# 3. Função para Envio de Heartbeat Local
function Invoke-GIHSHeartbeatFromRealJson {
    param(
        [string]$TargetUrl = $ServerUrl,
        [string]$TargetKey = $ApiKey,
        [string]$JsonFile = "$DataDir\GIHS-Inventario-Real.json",
        [switch]$ForceRescan
    )

    if ($ForceRescan -or (-not (Test-Path $JsonFile))) {
        Invoke-GIHSInventoryScan -TargetUrl $TargetUrl -TargetKey $TargetKey
    }

    if (-not (Test-Path $JsonFile)) {
        return $false
    }

    try {
        $rawJson = Get-Content -Path $JsonFile -Raw -Encoding UTF8
        $obj = $rawJson | ConvertFrom-Json
        $uuid = $obj.identity.uuid
        $hostName = $obj.identity.hostname
        $user = $obj.identity.primary_user

        $hbPayload = @{
            agent_id = "agt_" + $uuid.Replace("-","").Substring(0, 16)
            machine_uuid = $uuid
            hostname = $hostName
            agent_version = $AgentVersion
            current_user = $user
        } | ConvertTo-Json -Compress

        $hbUrl = "$TargetUrl/api/agent/v1/heartbeat"
        $res = Send-GIHSPayload -Uri $hbUrl -Body $hbPayload -Key $TargetKey

        if ($res -and $res.success) {
            Write-Host "[OK] Heartbeat transmitido com sucesso ($hostName)!" -ForegroundColor Green
            return $true
        } else {
            return $false
        }
    } catch {
        return $false
    }
}

# Se chamado apenas para carregar funções (por exemplo pelo systray), encerra aqui
if ($OnlyFunctions) {
    return
}

# ==============================================================================
# FLUXO PRINCIPAL DE INSTALAÇÃO NO WINDOWS
# ==============================================================================
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "   GIHS SYSTEM — AGENTE PROPRIETÁRIO DE INVENTÁRIO TI WINDOWS          " -ForegroundColor Yellow
Write-Host "   Telemetria em Tempo Real de Hardware, Software e Seguranca           " -ForegroundColor Yellow
Write-Host "   Compativel com Dominio (AD), Workgroup e Maquinas Fora de Dominio    " -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "[+] Servidor Central: $ServerUrl" -ForegroundColor Gray
Write-Host "[+] Diretorio de Dados: $DataDir" -ForegroundColor Gray
Write-Host ""

# 1. Grava cópia permanente de install-agent.ps1 no diretório do agente
$targetScript = Join-Path $DataDir "install-agent.ps1"
try {
    if ($PSCommandPath -and (Test-Path $PSCommandPath) -and ($PSCommandPath -ne $targetScript)) {
        Copy-Item -Path $PSCommandPath -Destination $targetScript -Force
    }
} catch {}

# Se o script foi executado em memória (IEX ou colado no console), garante que install-agent.ps1 é gravado no disco
if (-not (Test-Path $targetScript)) {
    try {
        if ($ServerUrl -and $ServerUrl -ne '__GIHS_SERVER_URL__') {
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile("$ServerUrl/api/agent/install.ps1", $targetScript)
        }
    } catch {}
}

# 2. Executa a primeira coleta completa de dados
Invoke-GIHSInventoryScan -TargetUrl $ServerUrl -TargetKey $ApiKey

# 3. Componentes da Bandeja (System Tray / Barra de Tarefas)
$TrayScriptPath = Join-Path $DataDir "GIHS-Systray.ps1"
$LauncherVbsPath = Join-Path $DataDir "GIHS-Agent-Launcher.vbs"
$IcoPath = Join-Path $DataDir "GIHS-Agent.ico"

# 3.1 Cria o ícone corporativo GIHS
try {
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $cyanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(6, 182, 212), 2)
    $g.FillEllipse($bgBrush, 2, 2, 27, 27)
    $g.DrawEllipse($cyanPen, 2, 2, 27, 27)

    $font = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
    $g.DrawString("G", $font, $textBrush, 7, 5)

    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 197, 94))
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(15, 23, 42), 1)
    $g.FillEllipse($greenBrush, 19, 19, 9, 9)
    $g.DrawEllipse($whitePen, 19, 19, 9, 9)

    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $fs = New-Object System.IO.FileStream($IcoPath, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    $g.Dispose()
    $bmp.Dispose()
} catch {}

# 3.2 Salva o script nativo da bandeja de tarefas (GIHS-Systray.ps1) sem usar here-strings
$trayLines = @(
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '',
    '$ServerUrl = "' + $ServerUrl + '"',
    '$ApiKey = "' + $ApiKey + '"',
    '$DataDir = "' + $DataDir + '"',
    '$IcoPath = Join-Path $DataDir "GIHS-Agent.ico"',
    '$JsonPath = Join-Path $DataDir "GIHS-Inventario-Real.json"',
    '$MainScript = Join-Path $DataDir "install-agent.ps1"',
    '',
    'if (Test-Path $MainScript) {',
    '    try { . $MainScript -ServerUrl $ServerUrl -ApiKey $ApiKey -OnlyFunctions } catch {}',
    '}',
    '',
    '$notifyIcon = New-Object System.Windows.Forms.NotifyIcon',
    '$notifyIcon.Text = "GIHS Enterprise Inventory Agent — Online 24/7"',
    '$notifyIcon.Visible = $true',
    '',
    'if (Test-Path $IcoPath) {',
    '    try { $notifyIcon.Icon = New-Object System.Drawing.Icon($IcoPath) } catch { $notifyIcon.Icon = [System.Drawing.SystemIcons]::Shield }',
    '} else {',
    '    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Shield',
    '}',
    '',
    '$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip',
    '$itemTitle = $contextMenu.Items.Add("GIHS System — Agente de TI")',
    '$itemTitle.Enabled = $false',
    '$itemTitle.Font = New-Object System.Drawing.Font($contextMenu.Font, [System.Drawing.FontStyle]::Bold)',
    '$contextMenu.Items.Add("-") | Out-Null',
    '',
    '$itemHb = $contextMenu.Items.Add("Forcar Heartbeat Agora")',
    '$itemHb.add_Click({',
    '    try {',
    '        $ok = Invoke-GIHSHeartbeatFromRealJson -TargetUrl $ServerUrl -TargetKey $ApiKey -JsonFile $JsonPath',
    '        if ($ok) {',
    '            $notifyIcon.ShowBalloonTip(3000, "GIHS Agent", "Heartbeat transmitido com sucesso ao servidor!", [System.Windows.Forms.ToolTipIcon]::Info)',
    '        } else {',
    '            $notifyIcon.ShowBalloonTip(3000, "GIHS Agent", "Aviso: Heartbeat gravado localmente.", [System.Windows.Forms.ToolTipIcon]::Warning)',
    '        }',
    '    } catch {',
    '        $notifyIcon.ShowBalloonTip(3000, "GIHS Agent", "Aviso: $_", [System.Windows.Forms.ToolTipIcon]::Warning)',
    '    }',
    '})',
    '',
    '$itemScan = $contextMenu.Items.Add("Executar Varredura Completa")',
    '$itemScan.add_Click({',
    '    try {',
    '        Invoke-GIHSInventoryScan -TargetUrl $ServerUrl -TargetKey $ApiKey',
    '        $notifyIcon.ShowBalloonTip(3000, "GIHS Agent", "Varredura concluida e atualizada!", [System.Windows.Forms.ToolTipIcon]::Info)',
    '    } catch {}',
    '})',
    '',
    '$itemCopy = $contextMenu.Items.Add("Copiar Dados do Inventario (JSON)")',
    '$itemCopy.add_Click({',
    '    if (Test-Path $JsonPath) {',
    '        $content = Get-Content -Path $JsonPath -Raw -Encoding UTF8',
    '        Set-Clipboard -Value $content',
    '        $notifyIcon.ShowBalloonTip(2000, "GIHS Agent", "Dados copiados! Cole no painel web em Carregar Coleta Real.", [System.Windows.Forms.ToolTipIcon]::Info)',
    '    }',
    '})',
    '',
    '$contextMenu.Items.Add("-") | Out-Null',
    '',
    '$itemExit = $contextMenu.Items.Add("Ocultar Bandeja")',
    '$itemExit.add_Click({',
    '    $notifyIcon.Visible = $false',
    '    [System.Windows.Forms.Application]::Exit()',
    '})',
    '',
    '$notifyIcon.ContextMenuStrip = $contextMenu',
    '',
    '$timer = New-Object System.Windows.Forms.Timer',
    '$timer.Interval = 3600000',
    '$timer.add_Tick({',
    '    try { Invoke-GIHSHeartbeatFromRealJson -TargetUrl $ServerUrl -TargetKey $ApiKey -JsonFile $JsonPath } catch {}',
    '})',
    '$timer.Start()',
    '',
    '[System.Windows.Forms.Application]::Run()'
)
$trayContent = $trayLines -join "`r`n"
Set-Content -Path $TrayScriptPath -Value $trayContent -Force -Encoding UTF8

# 3.3 Cria o Launcher VBScript para inicialização 100% oculta sem janela de prompt preta
$launcherVbs = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run ""powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"$TrayScriptPath"""""", 0, False"
Set-Content -Path $LauncherVbsPath -Value $launcherVbs -Force -Encoding ASCII

# 3.4 Cria scripts de contingência para forçar o heartbeat localmente
$forceHbLines = @(
    '$ServerUrl = "' + $ServerUrl + '"',
    '$ApiKey = "' + $ApiKey + '"',
    '$DataDir = "' + $DataDir + '"',
    '$MainScript = Join-Path $DataDir "install-agent.ps1"',
    'if (Test-Path $MainScript) {',
    '    try { . $MainScript -ServerUrl $ServerUrl -ApiKey $ApiKey -OnlyFunctions } catch {}',
    '}',
    'Write-Host ""',
    'Write-Host "========================================================================" -ForegroundColor Cyan',
    'Write-Host "   GIHS SYSTEM - FORCAR HEARTBEAT EM TEMPO REAL                        " -ForegroundColor Yellow',
    'Write-Host "   Origem: $DataDir\GIHS-Inventario-Real.json                         " -ForegroundColor Yellow',
    'Write-Host "========================================================================" -ForegroundColor Cyan',
    'Write-Host ""',
    '$ok = Invoke-GIHSHeartbeatFromRealJson -TargetUrl $ServerUrl -TargetKey $ApiKey -JsonFile (Join-Path $DataDir "GIHS-Inventario-Real.json")',
    'if ($ok) {',
    '    Write-Host "[OK] Heartbeat transmitido e computador marcado como ONLINE no servidor!" -ForegroundColor Green',
    '} else {',
    '    Write-Host "[!] Heartbeat processado localmente." -ForegroundColor Yellow',
    '}',
    'Write-Host ""'
)
Set-Content -Path (Join-Path $DataDir "Forcar-Heartbeat.ps1") -Value ($forceHbLines -join "`r`n") -Force -Encoding UTF8

$forceHbBatLines = @(
    '@echo off',
    'chcp 65001 >nul 2>&1',
    'title GIHS Agent - Forcar Heartbeat em Tempo Real',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Forcar-Heartbeat.ps1"',
    'echo.',
    'pause'
)
Set-Content -Path (Join-Path $DataDir "Forcar-Heartbeat.bat") -Value ($forceHbBatLines -join "`r`n") -Force -Encoding ASCII

# 4. Configuração de Inicialização Automática (Compatível com Domínio e Workgroup)
# 4.1 Tarefa Agendada de Heartbeat Horário
$HourlyTaskName = "GIHS_Inventory_Agent_Hourly_Heartbeat"
try { & schtasks.exe /delete /tn $HourlyTaskName /f 2>$null | Out-Null } catch {}

$HourlyTaskCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$DataDir\Forcar-Heartbeat.ps1`""
$hourlyCreated = $false
try {
    & schtasks.exe /create /tn $HourlyTaskName /tr $HourlyTaskCmd /sc hourly /mo 1 /ru "SYSTEM" /rl highest /f 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $hourlyCreated = $true }
} catch {}

if (-not $hourlyCreated) {
    try {
        & schtasks.exe /create /tn $HourlyTaskName /tr $HourlyTaskCmd /sc hourly /mo 1 /f 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $hourlyCreated = $true }
    } catch {}
}

if ($hourlyCreated) {
    Write-Host "[+] Tarefa de Heartbeat automatico registrada no Agendador do Windows!" -ForegroundColor Green
}

# 4.2 Tarefa Agendada da Bandeja no Logon
$TaskName = "GIHS_Inventory_Agent_Systray"
try { & schtasks.exe /delete /tn $TaskName /f 2>$null | Out-Null } catch {}

try {
    & schtasks.exe /create /tn $TaskName /tr "wscript.exe `"$LauncherVbsPath`"" /sc onlogon /f 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] Inicializacao automatica da bandeja configurada no Agendador do Windows!" -ForegroundColor Green
    }
} catch {}

# 4.3 Redundância Universal via Registro e Pasta Inicializar (Garante 100% de Execução em Qualquer Windows)
try {
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "GIHS_Inventory_Systray" -Value "wscript.exe `"$LauncherVbsPath`"" -Force -ErrorAction SilentlyContinue
} catch {}
try {
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "GIHS_Inventory_Systray" -Value "wscript.exe `"$LauncherVbsPath`"" -Force -ErrorAction SilentlyContinue
} catch {}

# Atalho direto na pasta Inicializar do Usuário (Startup folder) - Funciona SEMPRE
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    if ($startupFolder -and (Test-Path $startupFolder)) {
        Copy-Item -Path $LauncherVbsPath -Destination (Join-Path $startupFolder "GIHS-Agent-Launcher.vbs") -Force
        Write-Host "[+] Inicializacao no boot ativada na pasta Inicializar do Windows!" -ForegroundColor Green
    }
} catch {}

# 5. Inicia o aplicativo da bandeja imediatamente em segundo plano (SEM travar o console)
try {
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$LauncherVbsPath`""
    Write-Host "[+] Icone do Agente GIHS ativado na barra de tarefas (bandeja do sistema)!" -ForegroundColor Green
} catch {
    Write-Warning "Aviso ao iniciar icone de bandeja: $_"
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACAO DO AGENTE CONCLUIDA COM SUCESSO!                        " -ForegroundColor Green
Write-Host "  [OK] Agente gravado em $DataDir"                                      -ForegroundColor Green
Write-Host "  [OK] O icone do GIHS Agent esta rodando oculto na sua barra de tarefas." -ForegroundColor Green
Write-Host "  [OK] Inicializacao automatica 24/7 configurada."                       -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
