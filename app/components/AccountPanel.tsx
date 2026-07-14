"use client"

import { Body, Caption, Heading2, Heading3, Button, Chip } from "@breadcoop/ui"
import { useMemo, useState } from "react"
import { parseEther, zeroAddress } from "viem"
import { useAccount, useReadContract } from "wagmi"
import { ADDRESSES, erc20Abi, lifeOracleAbi, tontinePoolAbi } from "../lib/contracts"
import {
  ENROLL_PATTERN,
  LIFE_DOMAINS,
  LIFE_PATTERN,
  idFor,
  mkDemoProof,
} from "../lib/demo"
import { TxStatus, fmtCountdown, fmtXdai, shortId, useTx } from "./util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const
const pool = { address: ADDRESSES.pool, abi: tontinePoolAbi } as const

export function AccountPanel() {
  const { address, isConnected } = useAccount()
  const { data: myId } = useReadContract({
    ...oracle,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
  const enrolled = myId && myId !== "0x" + "0".repeat(64)

  if (!isConnected)
    return (
      <div className="card">
        <Heading2>Pull up a chair</Heading2>
        <Body>Connect a wallet (top right) to enrol, join the pool, and draw income.</Body>
      </div>
    )

  return (
    <div className="grid gap-6">
      {!enrolled ? <EnrollCard /> : <StandingCard id={myId as `0x${string}`} />}
      {enrolled && <HeartbeatCard id={myId as `0x${string}`} />}
      {enrolled && <JoinCard id={myId as `0x${string}`} />}
      {enrolled && <IncomeCard id={myId as `0x${string}`} />}
    </div>
  )
}

function EnrollCard() {
  const [email, setEmail] = useState("")
  const [domain, setDomain] = useState<string>(LIFE_DOMAINS[0])
  const tx = useTx()

  return (
    <div className="card">
      <Heading2>1 · Enrol your mailbox</Heading2>
      <Body>
        Your mailbox is your identity here. In production you would send one email and
        prove your provider&apos;s DKIM signature over it; the pool only ever learns a
        fingerprint — never your address. One mailbox, one seat, forever.
      </Body>
      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        <div>
          <label>Your email (stays in your browser)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
          />
        </div>
        <div>
          <label>Mail provider (signs your emails)</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {LIFE_DOMAINS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      {email && (
        <Caption className="mt-2 block">
          Your seat fingerprint: <span className="mono">{shortId(idFor(email))}</span>
        </Caption>
      )}
      <div className="mt-4">
        <Button
          disabled={!email.includes("@") || tx.isPending}
          onClick={() =>
            tx.writeContract({
              ...oracle,
              functionName: "enroll",
              args: [mkDemoProof({ domain, pattern: ENROLL_PATTERN, nullifier: idFor(email) })],
            })
          }
        >
          Enrol
        </Button>
        <TxStatus {...tx} successNote="Welcome — your seat is registered." />
      </div>
    </div>
  )
}

function StandingCard({ id }: { id: `0x${string}` }) {
  const { data: rec } = useReadContract({
    ...oracle,
    functionName: "records",
    args: [id],
    query: { refetchInterval: 5000 },
  })
  const { data: good } = useReadContract({
    ...oracle,
    functionName: "isInGoodStanding",
    args: [id],
    query: { refetchInterval: 5000 },
  })
  const { data: period } = useReadContract({ ...oracle, functionName: "heartbeatPeriod" })
  const { data: grace } = useReadContract({ ...oracle, functionName: "gracePeriod" })

  const lastLife = rec ? Number(rec[3]) : undefined
  const due =
    lastLife && period !== undefined && grace !== undefined
      ? lastLife + Number(period) + Number(grace)
      : undefined
  const status = rec ? Number(rec[0]) : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading2>Your seat</Heading2>
        <Chip>
          {status === 2
            ? "⚠ someone claims you have died"
            : good
              ? "In good standing"
              : "Lapsed — send a heartbeat"}
        </Chip>
      </div>
      <Caption>
        Seat <span className="mono">{shortId(id)}</span> · last sign of life{" "}
        {lastLife ? new Date(lastLife * 1000).toLocaleString() : "—"} · standing lapses{" "}
        {fmtCountdown(due)}
      </Caption>
      {status === 2 && (
        <Body bold className="mt-2 text-system-red">
          A bonded death claim is open against your seat. Refute it below with a fresh
          heartbeat — the claimant&apos;s bond becomes yours.
        </Body>
      )}
    </div>
  )
}

function HeartbeatCard({ id }: { id: `0x${string}` }) {
  const [domain, setDomain] = useState<string>(LIFE_DOMAINS[0])
  const { data: nonce } = useReadContract({
    ...oracle,
    functionName: "currentEpochNonce",
    query: { refetchInterval: 10000 },
  })
  const { data: rec } = useReadContract({ ...oracle, functionName: "records", args: [id] })
  const status = rec ? Number(rec[0]) : 0
  const tx = useTx()
  const fn = status === 2 ? "refuteDeath" : "proveLife"

  return (
    <div className="card">
      <Heading2>2 · Heartbeats</Heading2>
      <Body>
        Each period, send one email with the pool&apos;s current nonce in the subject and
        prove it here. The nonce only exists once the period starts, so proofs can&apos;t
        be stockpiled — an heir with your keys still can&apos;t impersonate a heartbeat
        that hasn&apos;t happened yet. Miss one and your income simply pauses; nothing is
        ever forfeited for silence.
      </Body>
      <Caption className="mt-2 block">
        Current nonce to put in your subject line:{" "}
        <span className="mono">{nonce ? shortId(nonce as string) : "—"}</span>
      </Caption>
      <div className="grid gap-3 mt-3 sm:grid-cols-2">
        <div>
          <label>Provider that signed it</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {LIFE_DOMAINS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <Button
            disabled={tx.isPending}
            onClick={() =>
              tx.writeContract({
                ...oracle,
                functionName: fn,
                args: [mkDemoProof({ domain, pattern: LIFE_PATTERN, nullifier: id })],
              })
            }
          >
            {status === 2 ? "I am alive — refute the claim" : "Prove I'm alive"}
          </Button>
        </div>
      </div>
      <TxStatus
        {...tx}
        successNote={
          status === 2 ? "Claim refuted — the bond is yours." : "Heartbeat recorded."
        }
      />
    </div>
  )
}

function JoinCard({ id }: { id: `0x${string}` }) {
  const { address } = useAccount()
  const [amount, setAmount] = useState("10")
  const [birthYear, setBirthYear] = useState("1955")
  const [bequest, setBequest] = useState("20")
  const [beneficiary, setBeneficiary] = useState("")
  const { data: m } = useReadContract({
    ...pool,
    functionName: "members",
    args: [id],
    query: { refetchInterval: 5000 },
  })
  const { data: locked } = useReadContract({ ...pool, functionName: "isLocked" })
  const { data: allowance } = useReadContract({
    address: ADDRESSES.wxdai,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? zeroAddress, ADDRESSES.pool],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
  const { data: q } = useReadContract({
    ...pool,
    functionName: "qBpsForAge",
    args: [BigInt(Math.max(0, new Date().getFullYear() - Number(birthYear || "1955")))],
  })
  const approveTx = useTx()
  const joinTx = useTx()
  const exitTx = useTx()

  const wei = useMemo(() => {
    try {
      return parseEther(amount || "0")
    } catch {
      return 0n
    }
  }, [amount])
  const needsApproval = (allowance ?? 0n) < wei

  if (m?.[0] && !m?.[1]) {
    return (
      <div className="card">
        <Heading2>3 · Your stake</Heading2>
        <Body>
          You&apos;re in. Principal {fmtXdai(m[7])} sDAI-shares, mortality credits{" "}
          {fmtXdai(m[8])}, bequest {(Number(m[2]) / 100).toFixed(0)}% to{" "}
          <span className="mono">{m[6] === zeroAddress ? "no one (pool)" : shortId(m[6])}</span>.
        </Body>
        {!locked && (
          <div className="mt-3">
            <Button variant="secondary" disabled={exitTx.isPending} onClick={() => exitTx.writeContract({ ...pool, functionName: "exit" })}>
              Leave with a full refund (doors still open)
            </Button>
            <TxStatus {...exitTx} successNote="Refunded in full." />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <Heading2>3 · Take a stake</Heading2>
      <Body>
        Put in xDAI while the doors are open. Your birth year sets your mortality band —
        the fair-transfer rule uses it so young and old can share one table without either
        subsidising the other. The bequest is the share of your balance that goes to your
        family instead of the pool when you pass (it fairly reduces your credits too).
      </Body>
      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        <div>
          <label>Stake (xDAI)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label>Birth year {q !== undefined ? `(mortality band ${Number(q) / 100}%/yr)` : ""}</label>
          <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
        </div>
        <div>
          <label>Bequest % (0–50)</label>
          <input value={bequest} onChange={(e) => setBequest(e.target.value)} />
        </div>
        <div>
          <label>Beneficiary (optional address)</label>
          <input
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="0x…"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3 flex-wrap">
        {needsApproval ? (
          <Button
            disabled={approveTx.isPending || wei === 0n}
            onClick={() =>
              approveTx.writeContract({
                address: ADDRESSES.wxdai,
                abi: erc20Abi,
                functionName: "approve",
                args: [ADDRESSES.pool, wei],
              })
            }
          >
            Approve WXDAI
          </Button>
        ) : (
          <Button
            disabled={joinTx.isPending || wei === 0n}
            onClick={() =>
              joinTx.writeContract({
                ...pool,
                functionName: "join",
                args: [
                  wei,
                  BigInt(birthYear),
                  Math.round(Number(bequest || "0") * 100),
                  (beneficiary || zeroAddress) as `0x${string}`,
                ],
              })
            }
          >
            Join the pool
          </Button>
        )}
      </div>
      <Caption className="mt-1 block">
        You need WXDAI (wrapped xDAI) on Gnosis. {needsApproval ? "Approve first, then join." : ""}
      </Caption>
      <TxStatus {...approveTx} successNote="Approved — now join." />
      <TxStatus {...joinTx} successNote="You have a seat at the table." />
    </div>
  )
}

function IncomeCard({ id }: { id: `0x${string}` }) {
  const { data: locked } = useReadContract({
    ...pool,
    functionName: "isLocked",
    query: { refetchInterval: 5000 },
  })
  const { data: lockTime } = useReadContract({ ...pool, functionName: "lockTime" })
  const { data: monthly } = useReadContract({
    ...pool,
    functionName: "monthlyIncomeOf",
    args: [id],
    query: { refetchInterval: 5000 },
  })
  const { data: balance } = useReadContract({
    ...pool,
    functionName: "balanceInAssets",
    args: [id],
    query: { refetchInterval: 5000 },
  })
  const tx = useTx()

  return (
    <div className="card">
      <Heading2>4 · Monthly bread</Heading2>
      {!locked ? (
        <Body>
          Income starts when the doors close ({fmtCountdown(Number(lockTime ?? 0))}). From
          then on you draw up to an age-sized monthly amount — as long as your heartbeat is
          current.
        </Body>
      ) : (
        <>
          <Body>
            Balance {fmtXdai(balance)} xDAI · this month you can draw up to{" "}
            <b>{fmtXdai(monthly)} sDAI-shares</b>. Credits are spent before principal, so
            mortality credits become income first.
          </Body>
          <div className="mt-3">
            <Button
              disabled={tx.isPending || !monthly || monthly === 0n}
              onClick={() =>
                tx.writeContract({
                  ...pool,
                  functionName: "withdrawIncome",
                  args: [monthly as bigint],
                })
              }
            >
              Draw this month&apos;s income
            </Button>
            <TxStatus {...tx} successNote="Income drawn — see you next month." />
          </div>
        </>
      )}
    </div>
  )
}
