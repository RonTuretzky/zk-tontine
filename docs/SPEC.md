# Long Bread — an onchain tontine with zkEmail life & death oracles

*A survivor-pooled lifetime-income fund on Gnosis Chain. Members pool sDAI; verified
deaths release the deceased's balance to survivors as mortality credits; both
proof-of-life and proof-of-death arrive as zkEmail proofs (DKIM-verified emails with
regex field extraction inside zk circuits) from proxy institutions — funeral homes,
obituary platforms, insurers, healthcare providers — and from members' own mailboxes.*

This spec records the design and the reasoning. Findings marked **[verified]** survived
3-vote adversarial verification in the research pass (sources in §9); findings marked
*[directional]* were extracted from primary sources but not adversarially verified.

---

## 1. Why a tontine, and why onchain

Tontines are among the most capital-efficient retirement structures known: no insurer
guarantee to fund, no capital requirements, just survivors sharing forfeited balances
("mortality credits") on top of investment yield *[directional: Kitces, Cato]*. They
died commercially after New York's 1905 Armstrong investigation uncovered insurer
embezzlement of opaque pooled funds — the mechanism was never the problem; custody was
*[directional: Cato — by 1900 two-thirds of US life policies were tontine-style, ~7% of
national wealth]*.

That failure mode is precisely what a public smart contract removes: the pool is a
transparent contract holding sDAI, distributions are mechanical rules, and no promoter
can touch the corpus. What a chain *cannot* natively know is who is alive. This design
makes that oracle problem the centerpiece instead of an afterthought.

## 2. The mortality oracle (LifeOracle.sol)

### 2.1 Identity = mailbox

A member's identity is the Poseidon-style nullifier of their email address, proven by a
zkEmail **enroll-v1** proof over an email they sent (their provider's DKIM signature
covers the From address; the circuit reveals only the nullifier). One mailbox = one
identity = one wallet, rebindable by re-proving the same mailbox (lost keys must not be
fatal in a decades-long instrument; a pending death claim blocks rebinding).

- Sybil resistance is *mailbox-level*, gated by an allowlisted set of identity-anchor
  domains. A production deployment should anchor on domains that are hard to multiply
  per person (eID inboxes, verified-account providers) or layer zkPassport-style
  personhood; the demo uses major mail providers.
- The chain never stores names or emails — only nullifiers. Members are pseudonymous to
  each other, which also blunts the classic murder incentive (§6.5).

### 2.2 Proof-of-life: challenge-response heartbeats

Every heartbeat epoch (90 days production / 30 min demo), a member must prove they
*sent* an email whose Subject contains the oracle's **current epoch nonce**
(**life-v1** blueprint; the member's own provider signs it; extraData = nonce).

- The nonce mixes a blockhash observed *after* the epoch began (`rollEpoch()`), so life
  proofs cannot be stockpiled while alive and replayed by heirs after death — the
  failure mode that breaks passive "I received a newsletter" heartbeats.
- Email timestamps must be strictly monotonic per member and ≥ the nonce's set time.
- **Missing a heartbeat only lapses the member: income pauses; nothing is forfeited.**
  A fresh heartbeat restores everything. This deliberately kills the
  "key-management endurance lottery" of naive onchain tontines (ether-tontine treats a
  missed payment as death *[directional]*) — in this design, only a *verified death*
  moves money.

### 2.3 Proof-of-death: bonded claims from proxy institutions

Anyone may open a death claim with a **death-v1** zkEmail proof from an allowlisted
death-proxy domain (obituary platforms, funeral-home networks, crematoria, insurer
bereavement desks, healthcare records offices) plus a bond (50 xDAI production).
Funeral homes really do run automated obituary-notification email programs
*[directional: Legacy Funeral & Cremation Care]*, and account-closure/bereavement
correspondence references the account holder — the circuit regex-extracts the
deceased's identifier and binds it to the claimed member id (extraData).

- The death email's nullifier is single-use (no re-claiming with the same email).
- The notice must postdate the member's last life proof.
- A **challenge window** (30 days production) follows. The member refutes by producing
  a life proof *fresher than the claimed death*; the claimant's bond is forfeited to
  the victim. This matters because false death records are routine at scale — the SSA's
  Death Master File erroneously marks ~12,000 living Americans dead every year
  *[directional: DMF]*.
- Unchallenged claims finalize: bond returned, claimant recorded as bounty recipient.

This is deliberately the UMA optimistic-oracle shape — bonded assertion, challenge
window, escalation only on dispute; 99.8% of UMA assertions resolve unchallenged
*[directional: UMA docs]* — with the member themselves as the natural challenger.

### 2.4 Presumed death

Deaths that leave no institutional email trail are the DMF's other failure mode
(~16M deaths missing from it *[directional]*). After a deep lapse
(2 years production) anyone may open a **presumed-death claim** with a larger bond
(250 xDAI) and a longer challenge window (90 days), mirroring legal presumption of
death. A returning member refutes it the same way and pockets the larger bond.

### 2.5 DKIM key custody

`DKIMRegistry` archives per-domain key hashes with validity windows; additions go
through the owner, revocation is fast (owner OR guardian, no timelock) because a leaked
mail-server key is a death-forgery weapon. Revocation kills *all* proofs from that key,
including pre-compromise emails — a back-dated forgery is indistinguishable from a
genuine old email. This mirrors zkEmail's own on-chain DKIM registry architecture
**[verified: zkEmail docs]**. ESP caveat **[verified]**: institutions often send via
Mailgun/SendGrid; blueprints must pin the `d=` domain matching the institution's From
address, not the ESP's.

## 3. The money (TontinePool.sol)

### 3.1 Reserve asset

sDAI on Gnosis (`0xaf204776c7245bF4147c2612BF6e5972Ee483701`, ERC-4626 over WXDAI;
yield = bridged-DAI DSR passed through as share-price appreciation
*[directional: GnosisScan, Gnosis forum]*). The pool holds sDAI shares; yield accrues
with zero bookkeeping. Members join with WXDAI (auto-deposited) or sDAI directly.

### 3.2 Closed cohorts

A `TontineFactory` spawns cohort pools. Each pool enrolls until `lockTime`, then closes
forever (open-ended entry invites adverse selection; the actuarial literature treats
closed pools as the base case **[verified: Milevsky-Salisbury]**). Before lock, `exit()`
refunds in full. After lock, membership is irrevocable — surrender rights would let the
healthy adversely select out of the pool.

Join bounds (`minJoinAssets`, `maxJoinAssets`) are load-bearing, not cosmetic:
equitability provably breaks under extreme stake heterogeneity (a $1 member cannot be
fairly pooled with a $1,000,000 member) **[verified: Milevsky-Salisbury]**, and the cap
also bounds how much any single death moves the pool (§6.5).

### 3.3 Mortality credits — the fair transfer plan

When a death settles, the estate divides:

```
bounty  = estate × bountyBps                     → death claimant (2%)
bequest = (estate − bounty) × member.bequestBps  → named beneficiary
credits = remainder                              → survivors, ∝ weight_i
weight_i = principal_i × q_i/(1−q_i) × (1−bequest_i)
```

The `q/(1−q)` term is the member's **nominal tontine yield** from the Sabin–Fullmer
fair-tontine-accounting framework **[verified 3-0]**: distributing each forfeiture
proportional to `s·q/(1−q)` and normalizing so the forfeiture pool is exactly exhausted
(their group-gain factor **G**) makes each member's expected credit equal their expected
forfeiture — the fairness condition that lets **mixed-age, mixed-stake pools coexist
fairly** (a member's expected gain depends only on their own balance and mortality
**[verified 2-1]**). The contract implements G per death event via an O(1)
rewards-per-weight accumulator (`accCreditRay`), so settlement never loops over members.

- `q` comes from an age-banded annual mortality table (unisex period-table
  approximation, constants in `qBpsForAge`); `refreshMortality()` re-bands anyone as
  they age — callable by keepers/anyone, and run automatically on withdrawal.
- The `(1−bequest)` scaling follows Bernhardt–Donnelly's modern tontine with bequest
  **[verified 3-0]**: a member who diverts fraction β of their estate to a beneficiary
  participates in mortality credits only on the (1−β) they actually stake, keeping the
  fairness identity intact. Bequests are capped at 50% — and are not merely tolerated:
  strict fairness is *impossible* without a death benefit **[verified 2-1:
  Milevsky-Salisbury Lemma 3]**.
- Pre-lock deaths refund the whole estate (net of bounty) — the tontine hadn't started.
- Last-survivor / no-survivor residue follows the bequest, else the treasury.

### 3.4 Lifetime income

After lock, members draw monthly income capped by an age-banded annuitization rate
(`payoutRateBpsForAge`, ~1/remaining-life-expectancy), gated on **good standing** —
this gate is what makes heartbeats worth sending. A lapsed member's missed months
accrue (up to 12) and unlock on their next heartbeat. Draws consume credits before
principal, and principal reductions shrink the member's forfeiture weight symmetrically.

## 4. zkEmail integration

The proof envelope (`EmailProof`) carries the six public signals every blueprint
exposes: `dkimPubkeyHash, domainHash, nullifier, patternHash, emailTimestamp` +
caller-context `extraData`. `ZKEmailVerifier` routes each `patternHash` to the Groth16
verifier compiled for that blueprint — zkEmail's registry auto-compiles circuits and
auto-deploys verifiers from regex blueprints **[verified: zk.email SDK docs]** — after
checking the signing key against `DKIMRegistry`.

Three blueprints:

| blueprint | proves | nullifier | extraData |
|---|---|---|---|
| `tontine/enroll-v1` | control of mailbox | H(email addr) | wallet |
| `tontine/life-v1` | member SENT an email w/ epoch nonce in Subject | H(email addr) | epoch nonce |
| `tontine/death-v1` | death notice from proxy institution names the member | H(email bytes) | member id |

**Demo mode** (current deployment): `MockGroth16Verifier` accepts any proof;
*every contract-level check stays real* — DKIM key registration/revocation, domain
roles, pattern routing, nullifier uniqueness, timestamp monotonicity, bonds, windows.
Real compiled verifiers drop in per-blueprint via `setVerifier` without touching
anything else (the p2peace repo demonstrates the full mock→real path on this exact
envelope). Body-regex death circuits cannot use the skip-body-hash optimization
**[verified]**, so they carry full body-hash constraint cost — the p2peace finding that
large HTML bodies are expensive applies; prefer institutions with short plaintext
notification templates.

## 5. Parameters (production values)

| parameter | value | rationale |
|---|---|---|
| heartbeat period | 90 days | quarterly; matches institutional email cadence |
| grace | 30 days | travel/illness slack before lapse |
| death claim bond | 50 xDAI | must sting vs. 2% bounty on a real estate |
| challenge window | 30 days | DMF false-positive reality; UMA-style optimistic shape |
| presumed-dead after | 730 days | legal presumption analogue |
| presumed bond / window | 250 xDAI / 90 days | no email evidence → higher bar |
| bounty | 2% of estate | concealment race (§6.2) without inviting griefing |
| bequest cap | 50% | tontine must remain mortality-credit-dominant |
| join bounds | 500–50,000 WXDAI | equitability breaks at extreme heterogeneity |

## 6. Threat model

| # | attack | mitigation |
|---|---|---|
| 6.1 | **False death claim** (eject a live member) | bonded claim + challenge window; victim refutes with one fresh life proof and *takes the bond*; death emails only from allowlisted DKIM domains; one claim per unique email |
| 6.2 | **Concealed death** (heirs keep collecting) | 2% bounty makes every death a race — obituary platforms broadcast deaths publicly, so anyone can claim; challenge-response nonce blocks replaying stockpiled life proofs; heirs must *actively* forge sent-mail proofs from the deceased's mailbox, ongoing fraud with a per-epoch cost and a permanent bounty on discovery |
| 6.3 | **Inherited mailbox** (full email custody) | acknowledged residual risk: mailbox custody *is* identity custody here. Layered defenses: bounty race (6.2), income-only drips (no lump-sum to steal), production identity anchors should be eID-grade |
| 6.4 | **Sybil entry** | one identity per mailbox nullifier; identity-anchor domain allowlist; per-member stake caps limit what a Sybil could gain; production: personhood-grade anchors |
| 6.5 | **Murder incentive** | pseudonymity (members are nullifiers, not names); stake caps ⇒ any one death moves each survivor by ≤ maxJoin·w_i/Σw; credits flow as income, not jackpots. The bigger the cohort, the weaker the incentive (1/n) |
| 6.6 | **DKIM key compromise / spoofed institution** | DKIMRegistry validity windows + instant guardian revocation (kills even back-dated emails); ESP `d=`-domain pinning |
| 6.7 | **Oracle bribery / collusion** | there is no voting oracle to bribe — claims are cryptographic; the only human lever is the DKIM registry owner, which should be a timelocked multisig with a separate revocation guardian |
| 6.8 | **Adverse selection** | closed cohorts; no post-lock surrender; age-banded q set at entry and refreshed |
| 6.9 | **Griefing via claims** | bonds forfeit to the victim, making harassment self-funding for the harassed |

## 7. Legal posture (not legal advice)

The design copies the structural features TontineTrust argues keep tontine trusts
outside insurance regulation in the US/EU/UK *[directional: tontine.com/legal]*: **no
underwriting, no guarantees, no risk transfer to a provider** — longevity risk is
borne by members; distributions are mechanical rules with zero discretion; there is no
promoter take anywhere in the system. The 1905-era prohibitions are narrower than
reputed — New York's statute targeted deferred-distribution (less than annual) products
*[directional: Cato]*; this design pays **monthly**. Canada's Purpose Longevity Pension
Fund (2021) shows a live regulatory path for modern tontines *[directional: Brookings]*.
Member-run, fixed-cohort, disclosure-first deployment is the defensible shape; a US
401(k) wrapper is currently not *[directional: Brookings]*.

## 8. What's real vs. demo

| layer | status |
|---|---|
| LifeOracle/TontinePool/Factory/DKIMRegistry logic | real, 57 Foundry tests |
| Sabin–Fullmer credit math | real (verified formulas) |
| Groth16 proofs | **mock** (demo); real circuits drop in per blueprint |
| DKIM keys for demo domains | placeholder hashes registered at deploy |
| mortality/payout tables | period-table approximations; swap constants per cohort |
| identity anchors | demo = mail providers; production wants eID-grade anchors |

## 9. Verified sources

- Sabin & Fullmer, *Individual Tontine Accounts* (tontine.com PDF) — nominal-gain
  method, r=q/(1−q), group-gain factor G, individual-fairness independence.
- Fullmer, SSRN 3485774 — fair tontine principle.
- Milevsky & Salisbury, arXiv:1610.09384 — equitable tontines, Theorem 4 (mixed-pool
  equitability), Lemma 3 (fairness requires a death benefit), heterogeneity limits.
- Bernhardt & Donnelly, arXiv:1903.05990 — modern tontine with bequest, α-split.
- Milevsky & Salisbury, arXiv:2402.14555 — Riccati tontine (recovery schedules).
- docs.zk.email (architecture/on-chain, dkim-verification, SDK, create-blueprint),
  zk.email/blog, github.com/zkemail — DKIM registry, blueprint registry,
  auto-deployed verifiers, ESP multi-signature guidance.
- Directional (fetched, not adversarially verified): tontine.com/legal-regulatory,
  Cato *Where Are the Retirement Tontines?*, Brookings tontine report (Oct 2020),
  Kitces tontine review, UMA docs, SSA Death Master File (Wikipedia),
  Legacy Funeral & Cremation Care obituary notifications, GnosisScan sDAI page,
  Gnosis forum sDAI vault proposal, dmotz/ether-tontine, SJSU TontineCoin paper.
