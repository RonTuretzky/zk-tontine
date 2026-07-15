import { encodeAbiParameters, keccak256, stringToBytes, toHex } from "viem"

// Demo proxy-domain allowlist + blueprint patterns.
// Mirrors contracts/script/Deploy.s.sol demoLifeDomains()/demoDeathDomains() and
// contracts/test/Base.t.sol — keep all three in sync.

export const LIFE_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "yahoo.com"] as const

export const DEATH_DOMAINS = [
  { domain: "legacy.com", label: "Legacy.com — obituary platform" },
  { domain: "dignitymemorial.com", label: "Dignity Memorial — funeral home network" },
  { domain: "neptunesociety.com", label: "Neptune Society — cremation provider" },
  { domain: "tributearchive.com", label: "Tribute Archive — obituary platform" },
  { domain: "metlife.com", label: "MetLife — life insurer bereavement desk" },
  { domain: "kaiserpermanente.org", label: "Kaiser Permanente — healthcare records" },
] as const

export const ENROLL_PATTERN = keccak256(stringToBytes("tontine/enroll-v1"))
export const LIFE_PATTERN = keccak256(stringToBytes("tontine/life-v1"))
export const DEATH_PATTERN = keccak256(stringToBytes("tontine/death-v1"))

export function domainHash(domain: string): `0x${string}` {
  return keccak256(stringToBytes(domain.toLowerCase()))
}

// keccak256(abi.encode("dkim-key", domainHash)) — the placeholder key the deploy
// script registers per demo domain.
export function dkimKeyOf(dHash: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], ["dkim-key", dHash]),
  )
}

// keccak256(abi.encodePacked("email:", email)) — the demo identity nullifier.
export function idFor(email: string): `0x${string}` {
  return keccak256(stringToBytes("email:" + email.trim().toLowerCase()))
}

export type EmailProof = {
  dkimPubkeyHash: `0x${string}`
  domainHash: `0x${string}`
  nullifier: `0x${string}`
  patternHash: `0x${string}`
  emailTimestamp: bigint
  proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
}

const ZERO8 = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const

// Fabricates the proof envelope the MockGroth16Verifier accepts. Every
// contract-level check (DKIM registry, domain roles, pattern routing, nullifier
// uniqueness, timestamps, bonds, windows) stays real — see docs/SPEC.md §4.
export function mkDemoProof(args: {
  domain: string
  pattern: `0x${string}`
  nullifier: `0x${string}`
  emailTimestamp?: bigint
}): EmailProof {
  const dHash = domainHash(args.domain)
  return {
    dkimPubkeyHash: dkimKeyOf(dHash),
    domainHash: dHash,
    nullifier: args.nullifier,
    patternHash: args.pattern,
    // Dated one minute ahead: when a proof's own transaction rolls the season,
    // the fresh nonce is stamped at the block's time, and an email dated before
    // it is (correctly) rejected as stale. "Sent just after the season began"
    // keeps the demo single-transaction; the one-day future-skew bound applies.
    emailTimestamp: args.emailTimestamp ?? BigInt(Math.floor(Date.now() / 1000) + 60),
    proof: ZERO8,
  }
}

export function randomDeathEmailNullifier(seed: string): `0x${string}` {
  return keccak256(stringToBytes(`death-email:${seed}:${Date.now()}:${Math.random()}`))
}

export const STATUS_LABELS = ["Not enrolled", "Alive", "Death claimed", "Deceased"] as const
