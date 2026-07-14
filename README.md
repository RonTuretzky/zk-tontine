# Long Bread 🍞⏳

**A lifetime income pool you run together — an onchain tontine with zkEmail life &
death oracles, on Gnosis Chain.**

Members pool savings into sDAI. While you live, you draw a monthly income sized to your
age. When a member passes — proven by a DKIM-verified email from a funeral home,
obituary platform, or insurer, and unchallenged through a dispute window — their balance
flows to the survivors by the Sabin–Fullmer fair-transfer rule, with a finder's share
for whoever brought the news and an optional bequest for their family. Nobody holds the
pot. Nobody can walk off with it. That's the part that killed tontines in 1905, and the
part a public ledger actually fixes.

## How it answers the classic objections

| objection | answer |
|---|---|
| *"The chain can't know who's alive"* | challenge-response zkEmail heartbeats: send one email containing the pool's epoch nonce; your provider's DKIM signature is the proof. Nonces derive from post-epoch blockhashes, so heirs can't replay stockpiled proofs. |
| *"People get falsely declared dead"* | death claims are bonded and challengeable; one fresh heartbeat refutes the claim and awards the bond to the victim. |
| *"Heirs will hide the death"* | every verified death pays a bounty from the estate — obituaries are public, so concealment is a race the heirs lose. |
| *"Lost keys = actuarial execution"* | never. Missed heartbeats only pause income; identities rebind to new wallets by re-proving the mailbox. Only verified death moves money. |
| *"Mixed pools are unfair"* | credits split ∝ stake × q/(1−q) × (1−bequest) — the verified fair-tontine-accounting weights; stake caps keep heterogeneity in the equitable range. |
| *"It's a murder incentive"* | members are mailbox fingerprints, not names; stake caps bound what any death moves; credits arrive as income, not jackpots. |

Full design + threat model: [docs/SPEC.md](docs/SPEC.md).

## Layout

- `contracts/` — Foundry. `LifeOracle` (identity, heartbeats, bonded death claims,
  presumed death), `TontinePool` (sDAI reserve, fair mortality credits, monthly income),
  `TontineFactory`, `DKIMRegistry` + `ZKEmailVerifier` (per-blueprint Groth16 routing).
  57 tests. `script/Deploy.s.sol` deploys everything; `DEMO_SETUP=true` registers demo
  proxy domains and minutes-scale windows.
- `app/` — Next.js static export styled with [@breadcoop/ui](https://github.com/BreadchainCoop/bread-ui-kit)
  (Bread Cooperative's kit). Walk the whole life of the pool: enrol a mailbox, heartbeat,
  join, report a passing, dispute it, settle, draw income.
- `.github/` — [etherform](https://github.com/BreadchainCoop/etherform) Foundry CI/CD
  (build, test, fmt, deploy-on-PR to Gnosis with a sticky PR comment listing deployed
  addresses) + Pages deploy for the app.

## Demo mode

The live deployment runs with a `MockGroth16Verifier` (any proof passes) so the flows
are walkable without compiling circuits — **every contract-level rule stays real**:
DKIM key registry + guardian revocation, domain roles, pattern routing, nullifier
uniqueness, timestamp monotonicity, bonds, challenge windows, credit math. Real
compiled verifiers drop in per blueprint via `setVerifier` without touching anything
else. Addresses: [DEPLOYMENT.md](DEPLOYMENT.md).

## Develop

```bash
cd contracts && forge test        # 57 tests
cd app && npm install && npm run dev
```

Deploy (Gnosis):

```bash
cd contracts
WXDAI=0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d \
SDAI=0xaf204776c7245bF4147c2612BF6e5972Ee483701 \
DEMO_SETUP=true \
forge script script/Deploy.s.sol --rpc-url https://rpc.gnosischain.com \
  --private-key $PRIVATE_KEY --broadcast
```
