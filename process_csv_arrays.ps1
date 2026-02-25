# CSV Array Field Format Conversion Script
# Purpose: Convert PostgreSQL array format {1,2,3} to JSON format [1,2,3]

Write-Host "`nProcessing CSV array fields..." -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Gray

# 需要处理的文件
$filesToProcess = @(
    @{File = "employees.csv"; Field = "skill_ids"}
    @{File = "tasks.csv"; Field = "required_skills"}
)

$processedCount = 0

foreach ($item in $filesToProcess) {
    $filePath = "csv_data\$($item.File)"
    
    if (Test-Path $filePath) {
        Write-Host "`nProcessing file: $($item.File)" -ForegroundColor Yellow
        Write-Host "  Field: $($item.Field)" -ForegroundColor Gray
        
        # Read file content
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # Check for PostgreSQL array format
        if ($content -match '\{[0-9,]+\}') {
            # Convert array format: {1,2,3} to [1,2,3]
            $newContent = $content -replace '\{', '[' -replace '\}', ']'
            
            # Backup original file
            $backupPath = "$filePath.bak"
            Copy-Item -Path $filePath -Destination $backupPath -Force
            Write-Host "  [OK] Backed up original file: $($item.File).bak" -ForegroundColor Green
            
            # Write converted content
            Set-Content -Path $filePath -Value $newContent -Encoding UTF8 -NoNewline
            Write-Host "  [OK] Converted array format: {x,y,z} to [x,y,z]" -ForegroundColor Green
            
            $processedCount++
        } else {
            Write-Host "  [INFO] No PostgreSQL array format found, skipping" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n[WARNING] File not found: $($item.File)" -ForegroundColor Red
    }
}

Write-Host "`n" -NoNewline
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host "[SUCCESS] Processing complete! Processed $processedCount files" -ForegroundColor Green
Write-Host "`n[TIP] Original files backed up as .bak files" -ForegroundColor Cyan
Write-Host "[TIP] To restore: Get-ChildItem csv_data\*.bak | ForEach-Object { Copy-Item `$_ `$_.FullName.Replace('.bak','') -Force }" -ForegroundColor Cyan
