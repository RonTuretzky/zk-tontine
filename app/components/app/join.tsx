"use client"

import { useMemo, useState } from "react"
import { Body, Button, Caption } from "@breadcoop/ui"
import { parseEther, zeroAddress } from "viem"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { ADDRESSES, erc20Abi, lifeOracleAbi, tontinePoolAbi } from "../../lib/contracts"
import { ENROLL_PATTERN, LIFE_DOMAINS, idFor, mkDemoProof } from "../../lib/demo"
import type { PoolInfo } from "../../lib/pools"
import { TxStatus, fmtXdai, useTx } from "../util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const
const ZERO_ID = ("0x" + "0".repeat(64)) as `0x${string}`

export function JoinPanel({ pool }: { pool: PoolInfo }) {
  const { address, isConnected } = useAccount()
  const { data: myId } = useReadContract({
    ...oracle,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address, refetchInterval: 4000 },
  })
  const enrolled = !!myId && myId !== ZERO_ID
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { data: m } = useReadContract({
    ...p,
    functionName: "members",
    args: [(myId ?? ZERO_ID) as `0x${string}`],
    query: { enabled: enrolled, refetchInterval: 4000 },
  })
  const seated = !!m?.[0] && !m?.[1]

  const stepState = [isConnected, enrolled, seated]
  return (
    <div className="grid gap-6">
      {/* Progress */}
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {["Connect a wallet", "Link your email", "Take a seat"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  stepState[i]
                    ? "bg-system-green text-white"
                    : i === stepState.findIndex((s) => !s)
                      ? "bg-core-orange text-white"
                      : "bg-paper-2 text-surface-grey-2"
                }`}
              >
                {stepState[i] ? "✓" : i + 1}
              </span>
              <span className="text-text-standard text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {!isConnected ? (
        <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8 text-center">
          <Body className="text-surface-grey-2 mx-auto max-w-md">
            Connect a wallet (top right) to begin. You&apos;ll need a little
            xDAI on Gnosis Chain — a few cents covers everything but your stake.
          </Body>
        </div>
      ) : !enrolled ? (
        <LinkEmailCard />
      ) : (
        <TakeSeatCard pool={pool} myId={myId as `0x${string}`} seated={seated} m={m} />
      )}
    </div>
  )
}

function LinkEmailCard() {
  const [email, setEmail] = useState("")
  const [domain, setDomain] = useState<string>(LIFE_DOMAINS[0])
  const tx = useTx()

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
        Link your email
      </h2>
      <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
        Your email address is your identity in the circle — it&apos;s how you
        check in each season, and how a mistaken report about you gets
        cancelled. The circle never sees or stores the address itself, only a
        private fingerprint of it. One address, one seat, for life.
      </Body>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Your email — never leaves this page</label>
          <input
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
          />
        </div>
        <div>
          <label className="field-label">Your email provider</label>
          <select className="field" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {LIFE_DOMAINS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <Button
          app="fund"
          variant="primary"
          disabled={!email.includes("@") || tx.isPending}
          onClick={() =>
            tx.writeContract({
              ...oracle,
              functionName: "enroll",
              args: [mkDemoProof({ domain, pattern: ENROLL_PATTERN, nullifier: idFor(email) })],
            })
          }
        >
          Link this email
        </Button>
        <TxStatus {...tx} successNote="Linked — your seat card is ready." />
      </div>
      <Caption className="text-surface-grey-2 mt-3 block">
        In the finished system you&apos;d prove the link by sending one real
        email. The demonstration accepts it directly — everything after this
        step is fully real.
      </Caption>
    </div>
  )
}

function TakeSeatCard({
  pool,
  myId,
  seated,
  m,
}: {
  pool: PoolInfo
  myId: `0x${string}`
  seated: boolean
  m?: readonly [boolean, boolean, number, number, number, bigint, string, bigint, bigint, bigint, bigint]
}) {
  const { address } = useAccount()
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const [amount, setAmount] = useState("10")
  const [birthYear, setBirthYear] = useState("1960")
  const [family, setFamily] = useState("20")
  const [beneficiary, setBeneficiary] = useState("")
  const { data: minJoin } = useReadContract({ ...p, functionName: "minJoinAssets" })
  const { data: maxJoin } = useReadContract({ ...p, functionName: "maxJoinAssets" })
  const { data: xdaiBal } = useReadContract({
    address: ADDRESSES.wxdai,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  })
  const exitTx = useTx()

  const wei = useMemo(() => {
    try {
      return parseEther(amount || "0")
    } catch {
      return 0n
    }
  }, [amount])

  if (seated && m) {
    return (
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
        <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
          You have a seat 🎉
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Your stake" value={`${fmtXdai(m[7])} shares`} />
          <Stat label="Shared with you so far" value={`${fmtXdai(m[8])} shares`} />
          <Stat
            label="Family share"
            value={`${(Number(m[2]) / 100).toFixed(0)}%${m[6] !== zeroAddress ? " → " + (m[6] as string).slice(0, 8) + "…" : ""}`}
          />
        </div>
        <Body className="text-surface-grey-2 mt-4 text-sm">
          {pool.locked
            ? "The doors have closed — your seat is lifelong now. Check in each season and draw your income on the Income tab."
            : "Doors are still open, so you can leave with a full refund any time before they close."}
        </Body>
        {!pool.locked && (
          <div className="mt-4 flex items-center gap-4">
            <Button
              app="fund"
              variant="secondary"
              disabled={exitTx.isPending}
              onClick={() => exitTx.writeContract({ ...p, functionName: "exit" })}
            >
              Leave with a full refund
            </Button>
            <TxStatus {...exitTx} successNote="Refunded in full — the chair is free." />
          </div>
        )}
      </div>
    )
  }

  if (pool.locked) {
    return (
      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8 text-center">
        <Body className="text-surface-grey-2 mx-auto max-w-md">
          This circle&apos;s doors have closed. Pick an open circle in the top
          bar — new circles start regularly.
        </Body>
      </div>
    )
  }

  return (
    <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
      <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
        Take a seat
      </h2>
      <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
        Choose your stake and, if you like, a family share: the part of your
        balance that goes straight to a person you name if you pass on. Your
        year of birth sets your fair share of what the circle divides — it&apos;s
        what lets the young and the old sit at one table without either carrying
        the other.
      </Body>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">
            Your stake (xDAI) — between {fmtXdai(minJoin as bigint)} and {fmtXdai(maxJoin as bigint, 0)}
          </label>
          <input className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Caption className="text-surface-grey-2 mt-1 block">
            In your wallet: {fmtXdai(xdaiBal)} wrapped xDAI
          </Caption>
        </div>
        <div>
          <label className="field-label">Year you were born</label>
          <input className="field" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Family share (0–50%)</label>
          <input className="field" value={family} onChange={(e) => setFamily(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Who should receive it (optional address)</label>
          <input
            className="field"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="0x…"
          />
        </div>
      </div>

      <JoinButtons
        pool={pool}
        wei={wei}
        birthYear={birthYear}
        familyPct={family}
        beneficiary={beneficiary}
      />
    </div>
  )
}

/* Join with plain xDAI (wrap → approve → join, three quick confirmations) or
   with wrapped xDAI you already hold (approve → join). */
function JoinButtons({
  pool,
  wei,
  birthYear,
  familyPct,
  beneficiary,
}: {
  pool: PoolInfo
  wei: bigint
  birthYear: string
  familyPct: string
  beneficiary: string
}) {
  const { address } = useAccount()
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.wxdai,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? zeroAddress, pool.address],
    query: { enabled: !!address, refetchInterval: 4000 },
  })
  const { data: wxdaiBal } = useReadContract({
    address: ADDRESSES.wxdai,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address, refetchInterval: 4000 },
  })

  const wrapTx = useTx()
  const approveTx = useTx()
  const joinTx = useTx()

  const haveWrapped = (wxdaiBal ?? 0n) >= wei && wei > 0n
  const approved = (allowance ?? 0n) >= wei && wei > 0n

  const joinArgs = [
    wei,
    BigInt(birthYear || "1960"),
    Math.min(5000, Math.max(0, Math.round(Number(familyPct || "0") * 100))),
    (beneficiary.trim() || zeroAddress) as `0x${string}`,
  ] as const

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {!haveWrapped && (
          <Button
            app="fund"
            variant="secondary"
            disabled={wei === 0n || wrapTx.isPending}
            onClick={() =>
              wrapTx.writeContract({
                address: ADDRESSES.wxdai,
                abi: erc20Abi,
                functionName: "deposit",
                value: wei,
              })
            }
          >
            1 · Set aside {fmtXdai(wei)} xDAI
          </Button>
        )}
        {!approved && (
          <Button
            app="fund"
            variant={haveWrapped ? "primary" : "secondary"}
            disabled={!haveWrapped || approveTx.isPending}
            onClick={() => {
              approveTx.writeContract({
                address: ADDRESSES.wxdai,
                abi: erc20Abi,
                functionName: "approve",
                args: [pool.address, wei],
              })
            }}
          >
            2 · Allow the circle to take it
          </Button>
        )}
        <Button
          app="fund"
          variant={approved ? "primary" : "secondary"}
          disabled={!approved || joinTx.isPending}
          onClick={() => joinTx.writeContract({ ...p, functionName: "join", args: joinArgs as never })}
        >
          3 · Take your seat
        </Button>
      </div>
      <div className="mt-2 space-y-1">
        <TxStatus {...wrapTx} successNote="Set aside — now allow the circle to take it." />
        <TxStatus
          {...approveTx}
          successNote="Allowed — one more confirmation and the seat is yours."
        />
        <TxStatus {...joinTx} successNote="Welcome to the circle." />
      </div>
      {approveTx.isSuccess && !approved && void refetchAllowance()}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-paper-2 bg-paper-1 rounded-2xl border px-4 py-3">
      <Caption className="text-surface-grey-2 uppercase">{label}</Caption>
      <div className="font-breadDisplay text-text-standard mt-0.5 text-lg font-extrabold">
        {value}
      </div>
    </div>
  )
}
