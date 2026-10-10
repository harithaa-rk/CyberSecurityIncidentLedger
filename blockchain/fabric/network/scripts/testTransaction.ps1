# -----------------------------------------------------------------------------
# testTransaction.ps1 - Submit & Query a test evidence transaction
# Phase 4 Module 4 & 5: CyberSecurity Incident Ledger
#
# Runs live transaction tests against Hyperledger Fabric via CLI container
# -----------------------------------------------------------------------------

$ScriptRoot = $PSScriptRoot
$shScript   = "/opt/gopath/src/github.com/hyperledger/fabric/peer/scripts/testTransaction.sh"

docker exec cli bash $shScript
