Param(
    [switch]$Force = $false
)

Function reportGood($value){
    Write-Host -Object $value -ForegroundColor Green
}

Function reportWarn($value){
    Write-Host -Object $value -ForegroundColor Yellow -BackgroundColor Red
}

$npmRoot = "$PSScriptRoot\node_modules"

cd $PSScriptRoot

if($Force){
    Write-Host "Purging $npmRoot"
    Remove-Item -Recurse -Force $npmRoot
}

$PackageList = @("googleapis@39", "discordie", "request")

$PackageList | foreach {
    npm install $_ >>$null 2>$Null
    $item = $_
    
    #NPM package paths ignore @ suffix
    if($_.contains("@")){
        $item = $item.Substring(0,$item.indexOf("@"))
    }


    if(Test-Path $npmRoot\$item){
        reportGood("Initialized $item package")
    }else{
        reportWarn("Failed to find package: $npmRoot\$item")
        reportWarn("Please run 'npm install $_'")
    }
}
