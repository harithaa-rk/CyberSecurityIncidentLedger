# Root wrapper for startNetwork.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
& "$ScriptDir\blockchain\fabric\network\scripts\startNetwork.ps1" @args
