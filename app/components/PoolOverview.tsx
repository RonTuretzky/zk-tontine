"use client"

import { Body, Caption, Heading2, Heading3, Chip } from "@breadcoop/ui"
import { useReadContract, useReadContracts } from "wagmi"
import { ADDRESSES, lifeOracleAbi, tontinePoolAbi } from "../lib/contracts"
import { STATUS_LABELS } from "../lib/demo"
import { fmtCountdown, fmtXdai, shortId } from "./util"

const pool = { address: ADDRESSES.pool, abi: tontinePoolAbi } as const
const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const

export function PoolOverview() {
  const { data: name } = useReadContract({ ...pool, functionName: "name" })
  const { data: totalAssets } = useReadContract({ ...pool, functionName: "poolTotalAssets" })
  const { data: living } = useReadContract({ ...pool, functionName: "livingMembers" })
  const { data: memberIds } = useReadContract({ ...pool, functionName: "allMemberIds" })
  const { data: lockTime } = useReadContract({ ...pool, functionName: "lockTime" })
  const { data: locked } = useReadContract({ ...pool, functionName: "isLocked" })
  const { data: bountyBps } = useReadContract({ ...pool, functionName: "bountyBps" })
  const { data: minJoin } = useReadContract({ ...pool, functionName: "minJoinAssets" })
  const { data: maxJoin } = useReadContract({ ...pool, functionName: "maxJoinAssets" })

  const ids = (memberIds ?? []) as readonly `0x${string}`[]
  const { data: memberRows } = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...pool, functionName: "members", args: [id] } as const,
      { ...pool, functionName: "balanceInAssets", args: [id] } as const,
      { ...oracle, functionName: "statusOf", args: [id] } as const,
      { ...oracle, functionName: "isLapsed", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0 },
  })

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <Caption>Pooled savings</Caption>
          <Heading3>{fmtXdai(totalAssets as bigint)} xDAI</Heading3>
          <Caption>held as sDAI — yield flows to the pool automatically</Caption>
        </div>
        <div className="card">
          <Caption>At the table</Caption>
          <Heading3>{living?.toString() ?? "—"} members</Heading3>
          <Caption>
            {locked
              ? "cohort closed — income phase"
              : `doors close in ${fmtCountdown(Number(lockTime ?? 0))}`}
          </Caption>
        </div>
        <div className="card">
          <Caption>House rules</Caption>
          <Body bold>{name ?? "—"}</Body>
          <Caption>
            stake {fmtXdai(minJoin as bigint, 0)}–{fmtXdai(maxJoin as bigint, 0)} xDAI ·{" "}
            {bountyBps !== undefined ? Number(bountyBps) / 100 : "—"}% finder&apos;s share on
            a verified passing
          </Caption>
        </div>
      </div>

      <div className="card">
        <Heading2>Members</Heading2>
        <Body>
          Everyone here is a pseudonym — a fingerprint of a mailbox, never a name. That is
          on purpose: nobody should be able to point at a neighbour and know what their
          passing would pay.
        </Body>
        {ids.length === 0 ? (
          <Body bold className="mt-4">
            No one has pulled up a chair yet. Be the first — head to “Your place in it”.
          </Body>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-[1.5px] border-[#171414]">
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">Standing</th>
                  <th className="py-2 pr-4">Balance (xDAI)</th>
                  <th className="py-2 pr-4">Bequest</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id, i) => {
                  const m = memberRows?.[i * 4]?.result as
                    | readonly [boolean, boolean, number, number, number, bigint, string, bigint, bigint, bigint, bigint]
                    | undefined
                  const bal = memberRows?.[i * 4 + 1]?.result as bigint | undefined
                  const status = memberRows?.[i * 4 + 2]?.result as number | undefined
                  const lapsed = memberRows?.[i * 4 + 3]?.result as boolean | undefined
                  const settled = m?.[1]
                  const label =
                    settled || status === 3
                      ? "Passed on"
                      : status === 2
                        ? "Death claimed"
                        : lapsed
                          ? "Lapsed"
                          : (STATUS_LABELS[status ?? 0] ?? "—")
                  return (
                    <tr key={id} className="border-b border-[#17141422]">
                      <td className="py-2 pr-4 mono">{shortId(id)}</td>
                      <td className="py-2 pr-4">
                        <Chip size="small">{label}</Chip>
                      </td>
                      <td className="py-2 pr-4">{fmtXdai(bal)}</td>
                      <td className="py-2 pr-4">
                        {m ? `${(Number(m[2]) / 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <Heading2>How the money moves</Heading2>
        <Body>
          Your stake buys sDAI, the savings token of Gnosis Chain — it quietly earns while
          it sits. While you&apos;re alive you draw a monthly income sized to your age.
          When a member passes — and the passing is proven and survives its challenge
          window — their balance is shared out: a small finder&apos;s share to whoever
          brought the proof, their chosen bequest to their family, and the rest to the
          surviving members. Older members and larger stakes receive proportionally more,
          by the same fair-transfer arithmetic actuaries use, so nobody subsidises anybody.
        </Body>
      </div>
    </div>
  )
}
