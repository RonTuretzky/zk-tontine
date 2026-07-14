import { parseAbi } from "viem"
import deployment from "./addresses.json"

export const ADDRESSES = deployment as {
  chainId: number
  dkimRegistry: `0x${string}`
  zkEmailVerifier: `0x${string}`
  groth16: `0x${string}`
  lifeOracle: `0x${string}`
  factory: `0x${string}`
  pool: `0x${string}`
  sdai: `0x${string}`
  wxdai: `0x${string}`
}

export const lifeOracleAbi = parseAbi([
  "struct EmailProof { bytes32 dkimPubkeyHash; bytes32 domainHash; bytes32 nullifier; bytes32 patternHash; uint64 emailTimestamp; uint256[8] proof; }",
  "function enroll(EmailProof p)",
  "function rebindWallet(EmailProof p)",
  "function proveLife(EmailProof p)",
  "function refuteDeath(EmailProof p)",
  "function claimDeath(bytes32 id, EmailProof p) payable",
  "function claimPresumedDeath(bytes32 id) payable",
  "function finalizeDeath(bytes32 id)",
  "function rollEpoch()",
  "function idOf(address wallet) view returns (bytes32)",
  "function walletOf(bytes32 id) view returns (address)",
  "function statusOf(bytes32 id) view returns (uint8)",
  "function isDead(bytes32 id) view returns (bool)",
  "function isInGoodStanding(bytes32 id) view returns (bool)",
  "function isLapsed(bytes32 id) view returns (bool)",
  "function claimantOf(bytes32 id) view returns (address)",
  "function records(bytes32 id) view returns (uint8 status, address wallet, uint64 enrolledAt, uint64 lastLifeProof, address claimant, uint96 bond, uint64 claimedAt, uint64 deathNoticeTime, uint64 challengeEnds)",
  "function currentEpochNonce() view returns (bytes32)",
  "function currentEpochNonceSetAt() view returns (uint64)",
  "function heartbeatPeriod() view returns (uint64)",
  "function gracePeriod() view returns (uint64)",
  "function challengeWindow() view returns (uint64)",
  "function presumedDeadAfter() view returns (uint64)",
  "function presumedChallengeWindow() view returns (uint64)",
  "function deathClaimBond() view returns (uint96)",
  "function presumedClaimBond() view returns (uint96)",
  "function domainRoles(bytes32 domainHash) view returns (uint8)",
])

export const tontinePoolAbi = parseAbi([
  "function join(uint256 assets, uint64 birthYear, uint16 bequestBps, address beneficiary)",
  "function joinWithSDai(uint256 shares, uint64 birthYear, uint16 bequestBps, address beneficiary)",
  "function exit()",
  "function setBeneficiary(address beneficiary)",
  "function settleDeath(bytes32 id)",
  "function refreshMortality(bytes32 id)",
  "function withdrawIncome(uint256 shares)",
  "function members(bytes32 id) view returns (bool exists, bool settled, uint16 bequestBps, uint16 qBps, uint32 monthsDrawn, uint64 birthYear, address beneficiary, uint256 principal, uint256 credits, uint256 weight, uint256 creditDebt)",
  "function memberCount() view returns (uint256)",
  "function livingMembers() view returns (uint32)",
  "function balanceOf(bytes32 id) view returns (uint256)",
  "function balanceInAssets(bytes32 id) view returns (uint256)",
  "function monthlyIncomeOf(bytes32 id) view returns (uint256)",
  "function poolTotalShares() view returns (uint256)",
  "function poolTotalAssets() view returns (uint256)",
  "function allMemberIds() view returns (bytes32[])",
  "function lockTime() view returns (uint64)",
  "function isLocked() view returns (bool)",
  "function name() view returns (string)",
  "function minJoinAssets() view returns (uint256)",
  "function maxJoinAssets() view returns (uint256)",
  "function maxMembers() view returns (uint32)",
  "function bountyBps() view returns (uint16)",
  "function totalWeight() view returns (uint256)",
  "function qBpsForAge(uint256 age) view returns (uint16)",
  "function payoutRateBpsForAge(uint256 age) view returns (uint16)",
])

export const factoryAbi = parseAbi([
  "function poolCount() view returns (uint256)",
  "function allPools() view returns (address[])",
])

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function deposit() payable",
])

export const sdaiAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
])
