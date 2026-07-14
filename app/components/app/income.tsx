"use client"

import { Body, Button, Caption } from "@breadcoop/ui"
import { zeroAddress } from "viem"
import { useAccount, useReadContract } from "wagmi"
import { ADDRESSES, lifeOracleAbi, tontinePoolAbi } from "../../lib/contracts"
import type { PoolInfo } from "../../lib/pools"
import { TxStatus, fmtCountdown, fmtXdai, useTx } from "../util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const
const ZERO_ID = ("0x" + "0".repeat(64)) as `0x${string}`

export function IncomePanel({ pool }: { pool: PoolInfo }) {
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { address, isConnected } = useAccount()
  const { data: myId } = useReadContract({
    ...oracle,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  })
  const enrolled = !!myId && myId !== ZERO_ID
  const id = (myId ?? ZERO_ID) as `0x${string}`
  const { data: m } = useReadContract({
    ...p,
    functionName: "members",
    args: [id],
    query: { enabled: enrolled, refetchInterval: 5000 },
  })
  const seated = !!m?.[0] && !m?.[1]
  const { data: good } = useReadContract({
    ...oracle,
    functionName: "isInGoodStanding",
    args: [id],
    query: { enabled: enrolled, refetchInterval: 5000 },
  })
  const { data: monthly } = useReadContract({
    ...p,
    functionName: "monthlyIncomeOf",
    args: [id],
    query: { enabled: seated, refetchInterval: 5000 },
  })
  const { data: balance } = useReadContract({
    ...p,
    functionName: "balanceInAssets",
    args: [id],
    query: { enabled: seated, refetchInterval: 5000 },
  })
  const tx = useTx()

  if (!isConnected || !enrolled || !seated) {
    return (
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8 text-center">
        <Body className="text-surface-grey-2 mx-auto max-w-md">
          {!isConnected
            ? "Connect a wallet to see your income."
            : "You don't have a seat in this circle yet — the Join tab takes two minutes."}
        </Body>
      </div>
    )
  }

  if (!pool.locked) {
    return (
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8">
        <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
          Income starts when the doors close
        </h2>
        <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
          This circle is still gathering members. Doors close in{" "}
          <b>{fmtCountdown(pool.lockTime)}</b> — from then on, every member draws
          a monthly income sized to their age, for as long as they live and keep
          checking in.
        </Body>
      </div>
    )
  }

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
        Your monthly bread
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <BigStat label="Your balance" value={`${fmtXdai(balance)} xDAI`} />
        <BigStat label="This month you can draw" value={`${fmtXdai(monthly)}`} accent />
        <BigStat label="Standing" value={good ? "✓ Checked in" : "Paused — check in first"} />
      </div>
      <Body className="text-surface-grey-2 mt-4 max-w-2xl text-sm">
        What the circle shares with you is spent before your own stake, and
        months you miss stay claimable for up to a year. The one condition is a
        current check-in — that&apos;s the whole reason check-ins exist.
      </Body>
      <div className="mt-5 flex items-center gap-4">
        <Button
          app="fund"
          variant="primary"
          disabled={tx.isPending || !good || !monthly || monthly === 0n}
          onClick={() =>
            tx.writeContract({ ...p, functionName: "withdrawIncome", args: [monthly as bigint] })
          }
        >
          Draw this month&apos;s income
        </Button>
        <TxStatus {...tx} successNote="Drawn. See you next month." />
      </div>
      {!good && (
        <Caption className="text-surface-grey-2 mt-2 block">
          Your last check-in has expired — visit the Check in tab first.
        </Caption>
      )}
    </div>
  )
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        accent ? "border-core-orange bg-core-orange/5" : "border-paper-2 bg-paper-1"
      }`}
    >
      <Caption className="text-surface-grey-2 uppercase">{label}</Caption>
      <div className="font-breadDisplay text-text-standard mt-0.5 text-xl font-extrabold">
        {value}
      </div>
    </div>
  )
}
