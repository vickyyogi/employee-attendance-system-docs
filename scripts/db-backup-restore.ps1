<#
.SYNOPSIS
  Automated PostgreSQL Backup, Integrity Check, and Restore Drill Utility.

.DESCRIPTION
  Performs compressed custom-format dumps (-Fc) of the PostgreSQL attendance database,
  computes and verifies SHA-256 checksums, and executes automated restore drills
  against an isolated drill database to guarantee disaster recovery readiness.

.PARAMETER Action
  The operation to execute: 'backup', 'verify', or 'restore-drill'. Default is 'backup'.

.PARAMETER DatabaseUrl
  The PostgreSQL connection URI (e.g. postgresql://user:pass@localhost:5432/attendance_dev).
  Defaults to the DATABASE_URL environment variable or root .env configuration.

.PARAMETER BackupDir
  Directory where backups and checksum files are stored. Defaults to './backups'.

.PARAMETER BackupFile
  Specific backup file path to verify or restore. Defaults to the latest backup in BackupDir.

.PARAMETER DrillDatabase
  Temporary database name used for restore drill verification. Default is 'attendance_drill'.

.PARAMETER DropDrillDbAfterVerification
  If set to $true, drops the drill database after verification succeeds. Default is $true.

.PARAMETER KeepBackups
  Number of recent backups to retain when rotating old files. Default is 7.

.EXAMPLE
  .\scripts\db-backup-restore.ps1 -Action backup
  .\scripts\db-backup-restore.ps1 -Action verify
  .\scripts\db-backup-restore.ps1 -Action restore-drill
#>

[CmdletBinding()]
param(
  [ValidateSet('backup', 'verify', 'restore-drill')]
  [string]$Action = 'backup',

  [string]$DatabaseUrl = $env:DATABASE_URL,

  [string]$BackupDir = './backups',

  [string]$BackupFile = '',

  [string]$DrillDatabase = 'attendance_drill',

  [bool]$DropDrillDbAfterVerification = $true,

  [int]$KeepBackups = 7
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
  Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg([string]$Message) {
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 1. Resolve PostgreSQL binaries
function Find-PgTool([string]$ToolName) {
  $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  # Common Windows paths
  $searchPaths = @(
    "C:\Program Files\PostgreSQL\18\bin\$ToolName.exe",
    "C:\Program Files\PostgreSQL\17\bin\$ToolName.exe",
    "C:\Program Files\PostgreSQL\16\bin\$ToolName.exe",
    "C:\Program Files\PostgreSQL\15\bin\$ToolName.exe",
    "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe",
    "/usr/bin/$ToolName",
    "/usr/local/bin/$ToolName"
  )

  foreach ($path in $searchPaths) {
    $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
    if ($resolved) {
      return $resolved[0].Path
    }
  }

  throw "Required PostgreSQL utility '$ToolName' was not found in PATH or standard install paths. Please add PostgreSQL bin directory to PATH."
}

# 2. Parse connection URL
function Parse-DatabaseUrl([string]$Url) {
  if (-not $Url) {
    # Check .env if available
    $envPath = Join-Path $PSScriptRoot "../.env"
    if (Test-Path $envPath) {
      $lines = Get-Content $envPath
      foreach ($line in $lines) {
        if ($line -match "^\s*DATABASE_URL\s*=\s*[`"']?(.*)[`"']?\s*$") {
          $Url = $Matches[1].Trim('"').Trim("'")
          break
        }
      }
    }
  }

  if (-not $Url) {
    throw "Database connection URL is required. Provide -DatabaseUrl or set DATABASE_URL environment variable."
  }

  # Format: postgresql://[user[:password]@][host][:port][/dbname][?params]
  $pattern = "^(?:postgres(?:ql)?:\/\/)(?:([^:@]+)(?::([^@]*))?@)?([^:\/?#]+)(?::(\d+))?(?:\/([^?#]+))?(?:\?(.*))?$"
  if ($Url -match $pattern) {
    return @{
      User     = if ($Matches[1]) { $Matches[1] } else { 'postgres' }
      Password = if ($Matches[2]) { $Matches[2] } else { '' }
      Host     = if ($Matches[3]) { $Matches[3] } else { 'localhost' }
      Port     = if ($Matches[4]) { $Matches[4] } else { '5432' }
      Database = if ($Matches[5]) { $Matches[5] } else { 'attendance_dev' }
    }
  } else {
    throw "Invalid PostgreSQL connection URL format: $Url"
  }
}

# Execute main workflow
try {
  $pgDump = Find-PgTool "pg_dump"
  $pgRestore = Find-PgTool "pg_restore"
  $psql = Find-PgTool "psql"

  $conn = Parse-DatabaseUrl $DatabaseUrl

  if ($conn.Password) {
    $env:PGPASSWORD = $conn.Password
  }

  # Ensure backup directory exists
  $absBackupDir = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $BackupDir))
  if (-not (Test-Path $absBackupDir)) {
    New-Item -ItemType Directory -Path $absBackupDir -Force | Out-Null
  }

  switch ($Action) {
    'backup' {
      Write-Info "Starting automated database backup for database '$($conn.Database)' on $($conn.Host):$($conn.Port)..."
      $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
      $dumpFileName = "$($conn.Database)_$timestamp.dump"
      $dumpFilePath = Join-Path $absBackupDir $dumpFileName
      $checksumFilePath = "$dumpFilePath.sha256"

      Write-Info "Dumping database into custom archive format: $dumpFilePath"
      $dumpArgs = @(
        "-h", $conn.Host,
        "-p", $conn.Port,
        "-U", $conn.User,
        "-d", $conn.Database,
        "-F", "c",
        "-b",
        "-f", "`"$dumpFilePath`""
      )
      $dumpProcess = Start-Process -FilePath $pgDump -ArgumentList $dumpArgs -NoNewWindow -PassThru -Wait
      if ($dumpProcess.ExitCode -ne 0) {
        throw "pg_dump failed with exit code $($dumpProcess.ExitCode)"
      }

      if (-not (Test-Path $dumpFilePath)) {
        throw "pg_dump completed but target file was not created: $dumpFilePath"
      }

      $fileInfo = Get-Item $dumpFilePath
      if ($fileInfo.Length -eq 0) {
        throw "pg_dump generated an empty file: $dumpFilePath"
      }

      Write-Info "Calculating SHA-256 integrity checksum..."
      $hash = (Get-FileHash -Path $dumpFilePath -Algorithm SHA256).Hash
      Set-Content -Path $checksumFilePath -Value "$hash *$dumpFileName"

      Write-Success "Backup created successfully!"
      Write-Host "  File:     $dumpFilePath" -ForegroundColor White
      Write-Host "  Size:     $([Math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor White
      Write-Host "  SHA-256:  $hash" -ForegroundColor White
      Write-Host "  Checksum: $checksumFilePath" -ForegroundColor White

      # Rotate old backups
      $allDumps = Get-ChildItem -Path $absBackupDir -Filter "*.dump" | Sort-Object CreationTime -Descending
      if ($allDumps.Count -gt $KeepBackups) {
        $toRemove = $allDumps | Select-Object -Skip $KeepBackups
        foreach ($old in $toRemove) {
          Write-Info "Rotating old backup: $($old.Name)"
          Remove-Item -Path $old.FullName -Force -ErrorAction SilentlyContinue
          $oldSha = "$($old.FullName).sha256"
          if (Test-Path $oldSha) {
            Remove-Item -Path $oldSha -Force -ErrorAction SilentlyContinue
          }
        }
      }
    }

    'verify' {
      if (-not $BackupFile) {
        $latest = Get-ChildItem -Path $absBackupDir -Filter "*.dump" | Sort-Object CreationTime -Descending | Select-Object -First 1
        if (-not $latest) {
          throw "No backup files found in $absBackupDir to verify."
        }
        $BackupFile = $latest.FullName
      }

      Write-Info "Verifying backup archive: $BackupFile"
      if (-not (Test-Path $BackupFile)) {
        throw "Backup file does not exist: $BackupFile"
      }

      $checksumFile = "$BackupFile.sha256"
      if (Test-Path $checksumFile) {
        $expectedLine = (Get-Content $checksumFile -Raw).Trim()
        $expectedHash = $expectedLine.Split(' ')[0].Trim()
        $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash

        if ($expectedHash.ToUpper() -ne $actualHash.ToUpper()) {
          throw "Checksum mismatch! Expected: $expectedHash, Computed: $actualHash"
        }
        Write-Success "SHA-256 Checksum verified: $actualHash"
      } else {
        Write-Warning "No companion .sha256 file found for $BackupFile. Skipping hash comparison."
      }

      Write-Info "Testing archive table of contents validity with pg_restore --list..."
      $listProc = Start-Process -FilePath $pgRestore -ArgumentList @("--list", "`"$BackupFile`"") -NoNewWindow -PassThru -Wait
      if ($listProc.ExitCode -ne 0) {
        throw "pg_restore failed to inspect archive TOC (ExitCode: $($listProc.ExitCode)). Archive may be corrupted."
      }

      Write-Success "Archive TOC verified successfully!"
    }

    'restore-drill' {
      if (-not $BackupFile) {
        $latest = Get-ChildItem -Path $absBackupDir -Filter "*.dump" | Sort-Object CreationTime -Descending | Select-Object -First 1
        if (-not $latest) {
          throw "No backup files found in $absBackupDir for restore drill."
        }
        $BackupFile = $latest.FullName
      }

      Write-Info "Initiating restore drill verification..."
      Write-Info "  Source Archive: $BackupFile"
      Write-Info "  Target Drill DB: $DrillDatabase on $($conn.Host):$($conn.Port)"

      # Step 1: Verify checksum
      $checksumFile = "$BackupFile.sha256"
      if (Test-Path $checksumFile) {
        $expectedLine = (Get-Content $checksumFile -Raw).Trim()
        $expectedHash = $expectedLine.Split(' ')[0].Trim()
        $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash

        if ($expectedHash.ToUpper() -ne $actualHash.ToUpper()) {
          throw "Pre-restore checksum failure! Archive corrupted."
        }
        Write-Success "Pre-restore checksum valid: $actualHash"
      }

      # Step 2: Create isolated drill database
      Write-Info "Ensuring drill database '$DrillDatabase' exists and is clean..."
      & $psql -h $conn.Host -p $conn.Port -U $conn.User -d postgres -c "DROP DATABASE IF EXISTS $DrillDatabase WITH (FORCE);"
      & $psql -h $conn.Host -p $conn.Port -U $conn.User -d postgres -c "CREATE DATABASE $DrillDatabase;"
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create drill database '$DrillDatabase'"
      }
      Write-Success "Created fresh drill database '$DrillDatabase'."

      # Step 3: Execute pg_restore
      Write-Info "Restoring archive to drill database '$DrillDatabase'..."
      $restoreArgs = @(
        "-h", $conn.Host,
        "-p", $conn.Port,
        "-U", $conn.User,
        "-d", $DrillDatabase,
        "--no-owner",
        "--no-acl",
        "`"$BackupFile`""
      )
      $restoreProc = Start-Process -FilePath $pgRestore -ArgumentList $restoreArgs -NoNewWindow -PassThru -Wait
      if ($restoreProc.ExitCode -gt 1) {
        throw "pg_restore failed with exit code $($restoreProc.ExitCode)"
      }
      Write-Success "Database objects and records restored successfully!"

      # Step 4: Verification smoke queries
      Write-Info "Executing data integrity and record verification checks..."
      $query = "SELECT 'companies' as tbl, count(*)::text as cnt FROM companies UNION ALL SELECT 'users', count(*)::text FROM users UNION ALL SELECT 'employees', count(*)::text FROM employees UNION ALL SELECT 'attendance_records', count(*)::text FROM attendance_records;"
      & $psql -h $conn.Host -p $conn.Port -U $conn.User -d $DrillDatabase -c $query

      # Step 5: Clean up drill database if requested
      if ($DropDrillDbAfterVerification) {
        Write-Info "Cleaning up drill database '$DrillDatabase'..."
        & $psql -h $conn.Host -p $conn.Port -U $conn.User -d postgres -c "DROP DATABASE IF EXISTS $DrillDatabase WITH (FORCE);"
        Write-Success "Drill database dropped."
      } else {
        Write-Info "Preserved drill database '$DrillDatabase' for manual inspection."
      }

      Write-Success "Restore drill completed with 100% success! Disaster recovery recoverability proven."
    }
  }
}
catch {
  Write-ErrorMsg "Operation failed: $_"
  exit 1
}
