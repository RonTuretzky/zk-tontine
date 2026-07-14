"use client"

import { useState } from "react"
import { Body, Button, Caption, Chip } from "@breadcoop/ui"
import { zeroAddress } from "viem"
import { useAccount, useReadContract } from "wagmi"
import { ADDRESSES, lifeOracleAbi } from "../../lib/contracts"
import { LIFE_DOMAINS, LIFE_PATTERN, mkDemoProof } from "../../lib/demo"
import { TxStatus, fmtCountdown, shortId, useTx } from "../util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const
const ZERO_ID = ("0x" + "0".repeat(64)) as `0x${string}`

export function CheckinPanel() {
  const { address, isConnected } = useAccount()
  const { data: myId } = useReadContract({
    ...oracle,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address, refetchInterval: 4000 },
  })
  const enrolled = !!myId && myId !== ZERO_ID

  if (!isConnected || !enrolled) {
    return (
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8 text-center">
        <Body className="text-surface-grey-2 mx-auto max-w-md">
          {isConnected
            ? "Link your email on the Join tab first — check-ins are how your seat stays active."
            : "Connect a wallet to see your seat and check in."}
        </Body>
      </div>
    )
  }

  return <CheckinCard id={myId as `0x${string}`} />
}

function CheckinCard({ id }: { id: `0x${string}` }) {
  const [domain, setDomain] = useState<string>(LIFE_DOMAINS[0])
  const { data: rec } = useReadContract({
    ...oracle,
    functionName: "records",
    args: [id],
    query: { refetchInterval: 4000 },
  })
  const { data: good } = useReadContract({
    ...oracle,
    functionName: "isInGoodStanding",
    args: [id],
    query: { refetchInterval: 4000 },
  })
  const { data: nonce } = useReadContract({
    ...oracle,
    functionName: "currentEpochNonce",
    query: { refetchInterval: 10000 },
  })
  const { data: period } = useReadContract({ ...oracle, functionName: "heartbeatPeriod" })
  const { data: grace } = useReadContract({ ...oracle, functionName: "gracePeriod" })
  const tx = useTx()

  const status = rec ? Number(rec[0]) : 0
  const lastSeen = rec ? Number(rec[3]) : undefined
  const due =
    lastSeen && period !== undefined && grace !== undefined
      ? lastSeen + Number(period) + Number(grace)
      : undefined
  const reported = status === 2
  const minutes = period !== undefined ? Math.round(Number(period) / 60) : null

  return (
    <div className="grid gap-6">
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
            Your seat
          </h2>
          <Chip>
            {reported
              ? "⚠ Someone reported your passing"
              : good
                ? "✓ Checked in"
                : "Away — income paused"}
          </Chip>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Info label="Member card" value={shortId(id)} mono />
          <Info
            label="Last check-in"
            value={lastSeen ? new Date(lastSeen * 1000).toLocaleString() : "—"}
          />
          <Info label={good ? "Next one due" : "Overdue since"} value={fmtCountdown(due)} />
        </div>
        {reported && (
          <Body className="text-system-red mt-4 text-sm font-bold">
            A report says you&apos;ve passed away. If you&apos;re reading this,
            that seems unlikely — check in below to cancel it. The reporter&apos;s
            good-faith deposit becomes yours.
          </Body>
        )}
      </div>

      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
        <h3 className="font-breadDisplay text-text-standard text-xl font-extrabold">
          Check in
        </h3>
        <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
          Once {minutes ? `every ${minutes} minutes (demo speed — a season in real life)` : "a season"},
          you send one short email containing the circle&apos;s current code
          word and confirm it here. The code word only exists once the season
          starts, so a check-in can&apos;t be prepared in advance — not even by
          someone with your passwords. Missing one never costs you money;
          your income just waits.
        </Body>
        <div className="border-paper-2 bg-paper-1 mt-4 rounded-2xl border px-4 py-3">
          <Caption className="text-surface-grey-2 uppercase">
            This season&apos;s code word — put it in your subject line
          </Caption>
          <div className="font-mono text-sm break-all">{(nonce as string) ?? "—"}</div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="field-label">The provider that sent your email</label>
            <select className="field" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {LIFE_DOMAINS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <Button
            app="fund"
            variant="primary"
            disabled={tx.isPending}
            onClick={() =>
              tx.writeContract({
                ...oracle,
                functionName: reported ? "refuteDeath" : "proveLife",
                args: [mkDemoProof({ domain, pattern: LIFE_PATTERN, nullifier: id })],
              })
            }
          >
            {reported ? "I'm alive — cancel the report" : "Check in"}
          </Button>
        </div>
        <TxStatus
          {...tx}
          successNote={
            reported
              ? "Report cancelled — the deposit is yours. Sorry about that."
              : "Checked in. See you next season."
          }
        />
      </div>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-paper-2 bg-paper-1 rounded-2xl border px-4 py-3">
      <Caption className="text-surface-grey-2 uppercase">{label}</Caption>
      <div className={`text-text-standard mt-0.5 text-sm font-bold ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  )
}
