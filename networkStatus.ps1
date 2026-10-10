# Root wrapper for networkStatus.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
& "$ScriptDir\blockchain\fabric\network\scripts\networkStatus.ps1" @args
