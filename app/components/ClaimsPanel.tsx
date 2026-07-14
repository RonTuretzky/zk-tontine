"use client"

import { Body, Caption, Heading2, Heading3, Button, Chip } from "@breadcoop/ui"
import { useState } from "react"
import { formatEther, zeroAddress } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { ADDRESSES, lifeOracleAbi, tontinePoolAbi } from "../lib/contracts"
import {
  DEATH_DOMAINS,
  DEATH_PATTERN,
  mkDemoProof,
  randomDeathEmailNullifier,
} from "../lib/demo"
import { TxStatus, fmtCountdown, fmtXdai, shortId, useTx } from "./util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const
const pool = { address: ADDRESSES.pool, abi: tontinePoolAbi } as const

export function ClaimsPanel() {
  return (
    <div className="grid gap-6">
      <ExplainerCard />
      <OpenClaimCard />
      <PendingClaimsCard />
    </div>
  )
}

function ExplainerCard() {
  const { data: bond } = useReadContract({ ...oracle, functionName: "deathClaimBond" })
  const { data: pBond } = useReadContract({ ...oracle, functionName: "presumedClaimBond" })
  const { data: window_ } = useReadContract({ ...oracle, functionName: "challengeWindow" })
  const { data: bounty } = useReadContract({ ...pool, functionName: "bountyBps" })
  return (
    <div className="card">
      <Heading2>How a passing is proven</Heading2>
      <Body>
        Anyone — family, a friend, a stranger reading the obituaries — can report a
        member&apos;s passing by proving a notification email from a trusted institution:
        a funeral home, an obituary platform, an insurer&apos;s bereavement desk. The
        report costs a bond of {bond ? formatEther(bond as bigint) : "—"} xDAI. If the
        member is actually alive, one fresh heartbeat refutes it and the bond becomes
        theirs — being falsely declared dead happens to twelve thousand Americans a year,
        so the window matters. If nobody objects within{" "}
        {window_ ? fmtCountdown(Math.floor(Date.now() / 1000) + Number(window_)) : "—"},
        the passing is final: the reporter gets their bond back plus{" "}
        {bounty !== undefined ? Number(bounty) / 100 : "—"}% of the estate for bringing
        the news, and the rest is shared out. Members who vanish without any email trail
        can be reported after a long silence with a bigger bond (
        {pBond ? formatEther(pBond as bigint) : "—"} xDAI) and a longer window.
      </Body>
    </div>
  )
}

function OpenClaimCard() {
  const [target, setTarget] = useState("")
  const [domain, setDomain] = useState<string>(DEATH_DOMAINS[0].domain)
  const { data: bond } = useReadContract({ ...oracle, functionName: "deathClaimBond" })
  const { data: pBond } = useReadContract({ ...oracle, functionName: "presumedClaimBond" })
  const emailTx = useTx()
  const presumedTx = useTx()

  const id = target.trim() as `0x${string}`
  const valid = /^0x[0-9a-fA-F]{64}$/.test(target.trim())

  return (
    <div className="card">
      <Heading2>Report a passing</Heading2>
      <div className="grid gap-3 mt-3">
        <div>
          <label>Member seat (from the members table)</label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x…" />
        </div>
        <div>
          <label>Institution that sent the notification</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DEATH_DOMAINS.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-3 flex-wrap">
        <Button
          disabled={!valid || emailTx.isPending || bond === undefined}
          onClick={() =>
            emailTx.writeContract({
              ...oracle,
              functionName: "claimDeath",
              args: [
                id,
                // demo proof, unique per submission; the contract enforces one
                // claim per unique notification email
                mkDemoProof({
                  domain,
                  pattern: DEATH_PATTERN,
                  nullifier: randomDeathEmailNullifier(id),
                }),
              ],
              value: bond as bigint,
            })
          }
        >
          Report with a notification email ({bond ? formatEther(bond as bigint) : "—"} xDAI bond)
        </Button>
        <Button
          variant="secondary"
          disabled={!valid || presumedTx.isPending || pBond === undefined}
          onClick={() =>
            presumedTx.writeContract({
              ...oracle,
              functionName: "claimPresumedDeath",
              args: [id],
              value: pBond as bigint,
            })
          }
        >
          Report a long silence ({pBond ? formatEther(pBond as bigint) : "—"} xDAI bond)
        </Button>
      </div>
      <TxStatus {...emailTx} successNote="Claim opened — the challenge window is running." />
      <TxStatus
        {...presumedTx}
        successNote="Presumed-death claim opened — the longer window is running."
      />
    </div>
  )
}

function PendingClaimsCard() {
  const { data: memberIds } = useReadContract({
    ...pool,
    functionName: "allMemberIds",
    query: { refetchInterval: 5000 },
  })
  const ids = (memberIds ?? []) as readonly `0x${string}`[]
  const { data: rows } = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...oracle, functionName: "records", args: [id] } as const,
      { ...pool, functionName: "members", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0, refetchInterval: 5000 },
  })
  const finalizeTx = useTx()
  const settleTx = useTx()

  const now = Math.floor(Date.now() / 1000)
  const claims = ids
    .map((id, i) => {
      const rec = rows?.[i * 2]?.result as
        | readonly [number, string, bigint, bigint, string, bigint, bigint, bigint, bigint]
        | undefined
      const m = rows?.[i * 2 + 1]?.result as readonly [boolean, boolean, ...unknown[]] | undefined
      if (!rec) return null
      const status = Number(rec[0])
      const settled = m?.[1] ?? false
      if (status !== 2 && !(status === 3 && !settled)) return null
      return { id, status, settled, claimant: rec[4], challengeEnds: Number(rec[8]) }
    })
    .filter(Boolean) as {
    id: `0x${string}`
    status: number
    settled: boolean
    claimant: string
    challengeEnds: number
  }[]

  return (
    <div className="card">
      <Heading2>Open matters</Heading2>
      {claims.length === 0 ? (
        <Body>No claims in flight. The table is quiet.</Body>
      ) : (
        <div className="grid gap-4 mt-3">
          {claims.map((c) => (
            <div key={c.id} className="border-[1.5px] border-[#171414] rounded-[7px] p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="mono">{shortId(c.id)}</span>
                <Chip size="small">
                  {c.status === 2
                    ? now > c.challengeEnds
                      ? "window closed — finalize"
                      : `challengeable ${fmtCountdown(c.challengeEnds)}`
                    : "final — settle the estate"}
                </Chip>
              </div>
              <Caption>
                reported by <span className="mono">{shortId(c.claimant)}</span>
              </Caption>
              <div className="mt-2 flex gap-2 flex-wrap">
                {c.status === 2 && now > c.challengeEnds && (
                  <Button
                    size="small"
                    disabled={finalizeTx.isPending}
                    onClick={() =>
                      finalizeTx.writeContract({
                        ...oracle,
                        functionName: "finalizeDeath",
                        args: [c.id],
                      })
                    }
                  >
                    Finalize
                  </Button>
                )}
                {c.status === 3 && !c.settled && (
                  <Button
                    size="small"
                    disabled={settleTx.isPending}
                    onClick={() =>
                      settleTx.writeContract({
                        ...pool,
                        functionName: "settleDeath",
                        args: [c.id],
                      })
                    }
                  >
                    Share out the estate
                  </Button>
                )}
              </div>
            </div>
          ))}
          <TxStatus {...finalizeTx} successNote="Finalized — the claimant may settle." />
          <TxStatus {...settleTx} successNote="Estate shared out to the survivors." />
        </div>
      )}
    </div>
  )
}
