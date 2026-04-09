<#
.SYNOPSIS
    Provisions SharePoint lists for the Project Management solution.

.DESCRIPTION
    Creates ProjectRegistry, TaskTemplate, and ResourceCapacity lists
    with all columns, indexes, and views using PnP PowerShell.

.PARAMETER SiteUrl
    The SharePoint site URL to provision lists on.

.EXAMPLE
    .\create-lists.ps1 -SiteUrl "https://basf.sharepoint.com/sites/ngba-gb-planner-projects"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl
)

# --- Connect ---
Write-Host "Connecting to $SiteUrl ..." -ForegroundColor Cyan
Connect-PnPOnline -Url $SiteUrl -Interactive

# ============================================================================
# Helper: Add field from JSON column definition
# ============================================================================
function Add-ColumnFromDef {
    param(
        [string]$ListName,
        [PSCustomObject]$Col
    )

    if ($Col.builtIn -eq $true) {
        Write-Host "  [skip] $($Col.internalName) (built-in)" -ForegroundColor DarkGray
        return
    }

    $fieldXml = ""
    $name = $Col.internalName
    $display = $Col.displayName
    $required = if ($Col.required) { "TRUE" } else { "FALSE" }

    switch ($Col.type) {
        "Text" {
            $maxLen = if ($Col.maxLength) { $Col.maxLength } else { 255 }
            $fieldXml = "<Field Type='Text' DisplayName='$display' Name='$name' Required='$required' MaxLength='$maxLen' />"
        }
        "Number" {
            $decimals = if ($null -ne $Col.decimals) { $Col.decimals } else { 0 }
            $fieldXml = "<Field Type='Number' DisplayName='$display' Name='$name' Required='$required' Decimals='$decimals' />"
        }
        "DateTime" {
            $format = if ($Col.dateOnly) { "DateOnly" } else { "DateTime" }
            $fieldXml = "<Field Type='DateTime' DisplayName='$display' Name='$name' Required='$required' Format='$format' />"
        }
        "Choice" {
            $choicesXml = ($Col.choices | ForEach-Object { "<CHOICE>$_</CHOICE>" }) -join ""
            $default = if ($Col.defaultValue) { "<Default>$($Col.defaultValue)</Default>" } else { "" }
            $fieldXml = "<Field Type='Choice' DisplayName='$display' Name='$name' Required='$required'>$default<CHOICES>$choicesXml</CHOICES></Field>"
        }
        "Note" {
            $richText = if ($Col.richText) { "TRUE" } else { "FALSE" }
            $fieldXml = "<Field Type='Note' DisplayName='$display' Name='$name' Required='$required' RichText='$richText' AppendOnly='FALSE' />"
        }
        "User" {
            $fieldXml = "<Field Type='User' DisplayName='$display' Name='$name' Required='$required' UserSelectionMode='PeopleOnly' />"
        }
        "UserMulti" {
            $fieldXml = "<Field Type='UserMulti' DisplayName='$display' Name='$name' Required='$required' UserSelectionMode='PeopleOnly' Mult='TRUE' />"
        }
        default {
            Write-Warning "  Unknown type '$($Col.type)' for column '$name' — skipping"
            return
        }
    }

    Write-Host "  [add] $name ($($Col.type))" -ForegroundColor Green
    Add-PnPFieldFromXml -List $ListName -FieldXml $fieldXml -ErrorAction SilentlyContinue

    # Set index if required
    if ($Col.indexed -eq $true) {
        Write-Host "  [idx] $name" -ForegroundColor Yellow
        Set-PnPField -List $ListName -Identity $name -Values @{ Indexed = $true } -ErrorAction SilentlyContinue
    }
}

# ============================================================================
# 1. ProjectRegistry
# ============================================================================
$listName = "ProjectRegistry"
Write-Host "`n=== Creating list: $listName ===" -ForegroundColor Magenta

$existingList = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($existingList) {
    Write-Warning "List '$listName' already exists — skipping creation"
} else {
    New-PnPList -Title $listName -Template GenericList -EnableVersioning
    Write-Host "  List created" -ForegroundColor Green
}

$columns = Get-Content -Path "$PSScriptRoot\ProjectRegistry-columns.json" -Raw | ConvertFrom-Json
foreach ($col in $columns) {
    Add-ColumnFromDef -ListName $listName -Col $col
}

# Views
Write-Host "  [view] Active Projects (default)" -ForegroundColor Cyan
Add-PnPView -List $listName -Title "Active Projects" -Fields "Title","ProjectListName","Owner","ProjectStatus","StartDate","EndDate","TaskCount" -Query "<Where><Eq><FieldRef Name='ProjectStatus'/><Value Type='Choice'>Active</Value></Eq></Where>" -SetAsDefault -ErrorAction SilentlyContinue

Write-Host "  [view] All Projects" -ForegroundColor Cyan
Add-PnPView -List $listName -Title "All Projects" -Fields "Title","ProjectListName","Owner","ProjectStatus","StartDate","EndDate","TaskCount" -ErrorAction SilentlyContinue

Write-Host "  [view] My Projects" -ForegroundColor Cyan
Add-PnPView -List $listName -Title "My Projects" -Fields "Title","ProjectListName","Owner","ProjectStatus","StartDate","EndDate","TaskCount" -Query "<Where><Eq><FieldRef Name='Owner'/><Value Type='Integer'><UserID/></Value></Eq></Where>" -ErrorAction SilentlyContinue

# ============================================================================
# 2. TaskTemplate
# ============================================================================
$listName = "TaskTemplate"
Write-Host "`n=== Creating list: $listName ===" -ForegroundColor Magenta

$existingList = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($existingList) {
    Write-Warning "List '$listName' already exists — skipping creation"
} else {
    New-PnPList -Title $listName -Template GenericList -EnableVersioning
    Write-Host "  List created" -ForegroundColor Green
}

$columns = Get-Content -Path "$PSScriptRoot\TaskTemplate-columns.json" -Raw | ConvertFrom-Json
foreach ($col in $columns) {
    Add-ColumnFromDef -ListName $listName -Col $col
}

# ============================================================================
# 3. ResourceCapacity
# ============================================================================
$listName = "ResourceCapacity"
Write-Host "`n=== Creating list: $listName ===" -ForegroundColor Magenta

$existingList = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($existingList) {
    Write-Warning "List '$listName' already exists — skipping creation"
} else {
    New-PnPList -Title $listName -Template GenericList -EnableVersioning
    Write-Host "  List created" -ForegroundColor Green
}

$columns = Get-Content -Path "$PSScriptRoot\ResourceCapacity-columns.json" -Raw | ConvertFrom-Json
foreach ($col in $columns) {
    Add-ColumnFromDef -ListName $listName -Col $col
}

# ============================================================================
# Done
# ============================================================================
Write-Host "`n=== Provisioning complete ===" -ForegroundColor Green
Write-Host "Created lists: ProjectRegistry, TaskTemplate, ResourceCapacity"
Write-Host "Site: $SiteUrl"

Disconnect-PnPOnline
