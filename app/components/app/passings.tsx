"use client"

import { useState } from "react"
import { Body, Button, Caption } from "@breadcoop/ui"
import { formatEther } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { ADDRESSES, lifeOracleAbi, tontinePoolAbi } from "../../lib/contracts"
import {
  DEATH_DOMAINS,
  DEATH_PATTERN,
  mkDemoProof,
  randomDeathEmailNullifier,
} from "../../lib/demo"
import type { PoolInfo } from "../../lib/pools"
import { Pill, TxStatus, fmtCountdown, shortId, useTx } from "../util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const

export function PassingsPanel({ pool }: { pool: PoolInfo }) {
  return (
    <div className="grid gap-6">
      <Explainer />
      <OpenMatters pool={pool} />
      <ReportCard />
    </div>
  )
}

function Explainer() {
  const { data: bond } = useReadContract({ ...oracle, functionName: "deathClaimBond" })
  const { data: window_ } = useReadContract({ ...oracle, functionName: "challengeWindow" })
  const { data: pBond } = useReadContract({ ...oracle, functionName: "presumedClaimBond" })
  const mins = window_ !== undefined ? Math.round(Number(window_) / 60) : null

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
        How a passing is handled
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            n: "1",
            t: "Someone reports it",
            b: `Anyone — family, a friend, a stranger reading the obituaries — can report a passing with a verified email from a funeral home, obituary page, or insurer, plus a good-faith deposit of ${bond ? formatEther(bond as bigint) : "—"} xDAI.`,
          },
          {
            n: "2",
            t: "Everyone waits",
            b: `Nothing moves for ${mins ? `${mins} minutes (demo speed — a month in real life)` : "a while"}. If the member is alive, one check-in cancels the report and the deposit is theirs.`,
          },
          {
            n: "3",
            t: "Then it's shared",
            b: "If no one objects, it's final: the reporter gets their deposit back plus a small thank-you, the family share goes where the member chose, and the rest stays with the circle.",
          },
        ].map((s) => (
          <div key={s.n} className="border-paper-2 bg-paper-1 rounded-2xl border p-4">
            <span className="bg-core-orange inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white">
              {s.n}
            </span>
            <div className="text-text-standard mt-2 text-sm font-bold">{s.t}</div>
            <Caption className="text-surface-grey-2 mt-1 block">{s.b}</Caption>
          </div>
        ))}
      </div>
      <Caption className="text-surface-grey-2 mt-4 block">
        Members who go quiet for a very long time can be reported without any
        email at all — it costs a much larger deposit (
        {pBond ? formatEther(pBond as bigint) : "—"} xDAI) and the waiting period
        is longer, so guessing doesn&apos;t pay.
      </Caption>
    </div>
  )
}

function OpenMatters({ pool }: { pool: PoolInfo }) {
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { data: memberIds } = useReadContract({
    ...p,
    functionName: "allMemberIds",
    query: { refetchInterval: 5000 },
  })
  const ids = (memberIds ?? []) as readonly `0x${string}`[]
  const { data: rows } = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...oracle, functionName: "records", args: [id] } as const,
      { ...p, functionName: "members", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0, refetchInterval: 5000 },
  })
  const finalizeTx = useTx()
  const settleTx = useTx()

  const now = Math.floor(Date.now() / 1000)
  const matters = ids
    .map((id, i) => {
      const rec = rows?.[i * 2]?.result as
        | readonly [number, string, bigint, bigint, string, bigint, bigint, bigint, bigint]
        | undefined
      const m = rows?.[i * 2 + 1]?.result as readonly [boolean, boolean, ...unknown[]] | undefined
      if (!rec) return null
      const status = Number(rec[0])
      const settled = m?.[1] ?? false
      if (status !== 2 && !(status === 3 && !settled)) return null
      return { id, status, settled, claimant: rec[4] as string, ends: Number(rec[8]) }
    })
    .filter(Boolean) as { id: `0x${string}`; status: number; settled: boolean; claimant: string; ends: number }[]

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h3 className="font-breadDisplay text-text-standard text-xl font-extrabold">
        Open matters in this circle
      </h3>
      {matters.length === 0 ? (
        <Body className="text-surface-grey-2 mt-2 text-sm">
          None. The table is quiet.
        </Body>
      ) : (
        <div className="mt-4 grid gap-3">
          {matters.map((c) => (
            <div
              key={c.id}
              className="border-paper-2 bg-paper-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
              <div>
                <span className="font-mono text-xs">{shortId(c.id)}</span>
                <Caption className="text-surface-grey-2 block">
                  reported by <span className="font-mono">{shortId(c.claimant)}</span>
                </Caption>
              </div>
              <div className="flex items-center gap-3">
                <Pill>
                  {c.status === 2
                    ? now > c.ends
                      ? "waiting period over"
                      : `open to objection ${fmtCountdown(c.ends)}`
                    : "final — ready to share out"}
                </Pill>
                {c.status === 2 && now > c.ends && (
                  <Button
                    app="fund"
                    size="sm"
                    variant="secondary"
                    disabled={finalizeTx.isPending}
                    onClick={() =>
                      finalizeTx.writeContract({ ...oracle, functionName: "finalizeDeath", args: [c.id] })
                    }
                  >
                    Make it final
                  </Button>
                )}
                {c.status === 3 && !c.settled && (
                  <Button
                    app="fund"
                    size="sm"
                    variant="primary"
                    disabled={settleTx.isPending}
                    onClick={() =>
                      settleTx.writeContract({ ...p, functionName: "settleDeath", args: [c.id] })
                    }
                  >
                    Share out the estate
                  </Button>
                )}
              </div>
            </div>
          ))}
          <TxStatus {...finalizeTx} successNote="Final. The estate can now be shared out." />
          <TxStatus {...settleTx} successNote="Shared out — family, reporter, and circle each received their part." />
        </div>
      )}
    </div>
  )
}

function ReportCard() {
  const [target, setTarget] = useState("")
  const [domain, setDomain] = useState<string>(DEATH_DOMAINS[0].domain)
  const { data: bond } = useReadContract({ ...oracle, functionName: "deathClaimBond" })
  const { data: pBond } = useReadContract({ ...oracle, functionName: "presumedClaimBond" })
  const emailTx = useTx()
  const silenceTx = useTx()

  const id = target.trim() as `0x${string}`
  const valid = /^0x[0-9a-fA-F]{64}$/.test(target.trim())

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h3 className="font-breadDisplay text-text-standard text-xl font-extrabold">
        Report a passing
      </h3>
      <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
        Bringing true news is a service to the circle, and it&apos;s thanked
        from the estate. Bringing false news costs you your deposit. Paste the
        member&apos;s card from the Overview table.
      </Body>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Member card</label>
          <input
            className="field font-mono"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0x…"
          />
        </div>
        <div>
          <label className="field-label">Institution whose email you hold</label>
          <select className="field" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DEATH_DOMAINS.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          app="fund"
          variant="primary"
          disabled={!valid || emailTx.isPending || bond === undefined}
          onClick={() =>
            emailTx.writeContract({
              ...oracle,
              functionName: "claimDeath",
              args: [
                id,
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
          Report with an email ({bond ? formatEther(bond as bigint) : "—"} xDAI deposit)
        </Button>
        <Button
          app="fund"
          variant="secondary"
          disabled={!valid || silenceTx.isPending || pBond === undefined}
          onClick={() =>
            silenceTx.writeContract({
              ...oracle,
              functionName: "claimPresumedDeath",
              args: [id],
              value: pBond as bigint,
            })
          }
        >
          Report a long silence ({pBond ? formatEther(pBond as bigint) : "—"} xDAI deposit)
        </Button>
      </div>
      <TxStatus {...emailTx} successNote="Reported. The waiting period has begun." />
      <TxStatus {...silenceTx} successNote="Reported. The longer waiting period has begun." />
    </div>
  )
}
