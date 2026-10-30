# export_all_balances.ps1
# يصدّر أرصدة الموردين والزبائن من الشامل بتنسيق JSON

$outputSupp = "C:\Users\NTC\.gemini\antigravity-ide\scratch\aboramez1\data\live_shamel_suppliers.json"
$outputCust = "C:\Users\NTC\.gemini\antigravity-ide\scratch\aboramez1\data\live_shamel_customers.json"

$suppQuery = @"
SELECT 
    coa.no AS code,
    coa.name AS name,
    ISNULL(bal.Balance, 0) AS balance
FROM ChartOfAccount coa WITH (NOLOCK)
LEFT JOIN (
    SELECT j.account_id, ROUND(SUM(CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END), 2) AS Balance
    FROM Journals j WITH (NOLOCK)
    INNER JOIN Vouchers_And_Bills v WITH (NOLOCK) ON j.voucher_id = v.id
    WHERE j.status = '0' AND v.status = '0'
    GROUP BY j.account_id
) bal ON coa.id = bal.account_id
WHERE coa.code = 'S'
ORDER BY coa.id ASC
"@

$custQuery = @"
SELECT 
    coa.no AS code,
    coa.name AS name,
    ISNULL(bal.Balance, 0) AS balance
FROM ChartOfAccount coa WITH (NOLOCK)
LEFT JOIN (
    SELECT j.account_id, ROUND(SUM(CASE j.debit_credit WHEN 'D' THEN j.base_curr_amount ELSE -j.base_curr_amount END), 2) AS Balance
    FROM Journals j WITH (NOLOCK)
    INNER JOIN Vouchers_And_Bills v WITH (NOLOCK) ON j.voucher_id = v.id
    WHERE j.status = '0' AND v.status = '0'
    GROUP BY j.account_id
) bal ON coa.id = bal.account_id
WHERE coa.code = 'C'
ORDER BY coa.id ASC
"@

Write-Host "جلب أرصدة الموردين..."
$suppRows = Invoke-Sqlcmd -ServerInstance ".\SQLEXPRESS_2" -Database "ShamelRealData" -Query $suppQuery
$suppList = $suppRows | ForEach-Object {
    @{
        code    = $_.code.Trim()
        name    = $_.name.Trim()
        balance = [math]::Round([double]$_.balance, 2)
    }
}
$suppJson = $suppList | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($outputSupp, $suppJson, [System.Text.Encoding]::UTF8)
Write-Host "تم تصدير $($suppList.Count) مورد -> $outputSupp"

Write-Host "جلب أرصدة الزبائن..."
$custRows = Invoke-Sqlcmd -ServerInstance ".\SQLEXPRESS_2" -Database "ShamelRealData" -Query $custQuery
$custList = $custRows | ForEach-Object {
    @{
        code    = $_.code.Trim()
        name    = $_.name.Trim()
        balance = [math]::Round([double]$_.balance, 2)
    }
}
$custJson = $custList | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($outputCust, $custJson, [System.Text.Encoding]::UTF8)
Write-Host "تم تصدير $($custList.Count) زبون -> $outputCust"
Write-Host "DONE"
