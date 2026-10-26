$connStr = "Server=.\SQLEXPRESS_2;Database=ShamelRealData;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
    SELECT 
        c.no,
        c.name,
        ROUND(SUM(CASE WHEN j.status = '0' THEN (CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END) ELSE 0 END), 2) as BalStatus0Only,
        ROUND(SUM(CASE WHEN j.status IN ('0', '1') THEN (CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END) ELSE 0 END), 2) as BalStatus0And1
    FROM ChartOfAccount c
    JOIN Journals j ON c.id = j.account_id
    WHERE c.code = 'S'
    GROUP BY c.no, c.name
    HAVING ROUND(SUM(CASE WHEN j.status = '0' THEN (CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END) ELSE 0 END), 2) <>
           ROUND(SUM(CASE WHEN j.status IN ('0', '1') THEN (CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END) ELSE 0 END), 2)
"@
    $r = $cmd.ExecuteReader()
    $dt = New-Object System.Data.DataTable
    $dt.Load($r)
    Write-Host "Suppliers where status 0 vs status 0+1 differs: " $dt.Rows.Count
    $dt | Select-Object -First 15 | Format-Table -AutoSize
    $r.Close()
    $conn.Close()
} catch {
    Write-Host "Error: " $_.Exception.Message
}
