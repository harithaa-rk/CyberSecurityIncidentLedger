# Root wrapper for testTransaction.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
& "$ScriptDir\blockchain\fabric\network\scripts\testTransaction.ps1" @args
