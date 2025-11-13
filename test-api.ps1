# 测试API的PowerShell脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试数据采集API" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. 测试健康检查
Write-Host "1. 测试健康检查..." -ForegroundColor Yellow
try {
$health = Invoke-RestMethod -Uri "http://localhost:3005/api/health" -Method GET
    Write-Host "✓ 健康检查通过" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "✗ 健康检查失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# 2. 获取小组列表
Write-Host "2. 获取小组列表..." -ForegroundColor Yellow
try {
$groups = Invoke-RestMethod -Uri "http://localhost:3005/api/groups" -Method GET
    Write-Host "✓ 小组列表获取成功，共 $($groups.Length) 个小组" -ForegroundColor Green
    $groups | ConvertTo-Json
} catch {
    Write-Host "✗ 获取小组列表失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# 3. 手动触发数据采集（指定日期）
Write-Host "3. 触发数据采集（2025-11-01）..." -ForegroundColor Yellow
try {
    $body = @{
        date = "2025-11-01"
    } | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:3005/api/collect" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✓ 数据采集触发成功" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "✗ 数据采集失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "错误详情: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# 4. 查询数据（如果有数据）
Write-Host "4. 查询数据看板..." -ForegroundColor Yellow
try {
$result = Invoke-RestMethod -Uri "http://localhost:3005/api/dashboard?startDate=2025-11-01&endDate=2025-11-01" -Method GET
    Write-Host "✓ 查询成功，共 $($result.Length) 条记录" -ForegroundColor Green
    if ($result.Length -gt 0) {
        $result | Format-Table -Property name, groupName, customerTurnCount, timelyReplyRate, overtimeReplyRate, avgReplyDuration
    } else {
        Write-Host "  (暂无数据)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ 查询失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
