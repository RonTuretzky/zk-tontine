# Deployment — Gnosis Chain (chainId 100)

Deployed 2026-07-14 by `0x6636A1CCBdf54485067304C1a590DE016DeaD9F0` with
`DEMO_SETUP=true` (mock Groth16 verifier for all three blueprints; minutes-scale
windows; demo proxy domains registered). All contract-level rules are live and real.

| contract | address |
|---|---|
| DKIMRegistry | `0xA40C38E3B7C8FC30bE98f0DE17371497CcA70e35` |
| ZKEmailVerifier | `0xb6132c8376802657C18049a8Ac6c65fC8A85AA29` |
| MockGroth16Verifier | `0x01234d1F1Ed3554c17a10941288195d90FD005C8` |
| LifeOracle | `0x22D645A97A056e673B290C1e537D18423FFa4D20` |
| TontineFactory | `0xB525B70B256f355331d687bEF70f9b97104B2784` |
| TontinePool "Demo Cohort" | `0x9F3BEa11734570A8260CB560f0CdeF11Ac8258f5` |
| sDAI (existing) | `0xaf204776c7245bF4147c2612BF6e5972Ee483701` |
| WXDAI (existing) | `0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d` |

Demo oracle config: heartbeat 30 min + 15 min grace · death-claim bond 0.01 xDAI,
challenge window 10 min · presumed death after 2 h silence, bond 0.05 xDAI, window
20 min. Demo pool: lock 45 min after deploy, stakes 1–10,000 xDAI, 2% finder's share.

Live smoke (verified on-chain, tx `0x1ba24d…37be2` +3 more): enrolled
`baker@longbread.demo` (nullifier `0xc69248…aa67c7`), wrapped 2 xDAI, joined with a
20% bequest, heartbeat accepted, `isInGoodStanding=true`, monthly income quoting
correctly against the real sDAI share price.

Owner/guardian/treasury of this demo deploy: the deployer EOA. A production cohort
should hand DKIMRegistry/LifeOracle ownership to a timelocked multisig with a separate
revocation guardian (SPEC §6.7).

Blueprint pattern hashes:

- enroll: `keccak256("tontine/enroll-v1")`
- life: `keccak256("tontine/life-v1")`
- death: `keccak256("tontine/death-v1")`
