# Root wrapper for testChaincodeP4M5.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
& "$ScriptDir\blockchain\fabric\network\scripts\testChaincodeP4M5.ps1" @args
