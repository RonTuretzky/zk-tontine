"use client"

import { Body, Button, Caption } from "@breadcoop/ui"
import { zeroAddress } from "viem"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { ADDRESSES, lifeOracleAbi, tontinePoolAbi } from "../../lib/contracts"
import type { PoolInfo } from "../../lib/pools"
import { Pill, fmtXdai, shortId } from "../util"

const oracle = { address: ADDRESSES.lifeOracle, abi: lifeOracleAbi } as const

export function OverviewPanel({ pool, goJoin }: { pool: PoolInfo; goJoin: () => void }) {
  const p = { address: pool.address, abi: tontinePoolAbi } as const
  const { address, isConnected } = useAccount()
  const { data: myId } = useReadContract({
    ...oracle,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  })
  const { data: memberIds } = useReadContract({
    ...p,
    functionName: "allMemberIds",
    query: { refetchInterval: 10000 },
  })
  const ids = (memberIds ?? []) as readonly `0x${string}`[]
  const { data: rows } = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...p, functionName: "members", args: [id] } as const,
      { ...p, functionName: "balanceInAssets", args: [id] } as const,
      { ...oracle, functionName: "statusOf", args: [id] } as const,
      { ...oracle, functionName: "isLapsed", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0, refetchInterval: 10000 },
  })

  return (
    <div className="grid gap-6">
      {!isConnected && (
        <div className="border-paper-2 bg-paper-0 rounded-3xl border p-8 text-center">
          <Body className="text-surface-grey-2 mx-auto max-w-md">
            Everything here is browsable without connecting. When you&apos;re
            ready to take a seat, connect a wallet in the top corner.
          </Body>
        </div>
      )}

      <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-breadDisplay text-text-standard text-2xl font-extrabold">
            Who&apos;s at the table
          </h2>
          {!pool.locked && (
            <Button app="fund" variant="primary" size="sm" onClick={goJoin}>
              Take a seat
            </Button>
          )}
        </div>
        <Body className="text-surface-grey-2 mt-2 max-w-2xl text-sm">
          Members appear as private member cards, never names — no one can look
          at a neighbour and know what their passing would pay.
        </Body>

        {ids.length === 0 ? (
          <Body className="text-text-standard mt-6 font-bold">
            No one has pulled up a chair yet. Be the first.
          </Body>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-paper-2 text-surface-grey-2 border-b text-left text-xs uppercase">
                  <th className="py-2.5 pr-4 font-semibold">Member card</th>
                  <th className="py-2.5 pr-4 font-semibold">Standing</th>
                  <th className="py-2.5 pr-4 font-semibold">Balance</th>
                  <th className="py-2.5 pr-4 font-semibold">Family share</th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id, i) => {
                  const m = rows?.[i * 4]?.result as
                    | readonly [boolean, boolean, number, number, number, bigint, string, bigint, bigint, bigint, bigint]
                    | undefined
                  const bal = rows?.[i * 4 + 1]?.result as bigint | undefined
                  const status = rows?.[i * 4 + 2]?.result as number | undefined
                  const lapsed = rows?.[i * 4 + 3]?.result as boolean | undefined
                  const settled = m?.[1]
                  const mine = myId === id
                  const label =
                    settled || status === 3
                      ? "Passed on"
                      : status === 2
                        ? "Report pending"
                        : lapsed
                          ? "Away — income paused"
                          : "Here"
                  return (
                    <tr key={id} className="border-paper-2/50 border-b">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs">{shortId(id)}</span>
                        {mine && (
                          <span className="bg-core-orange/10 text-core-orange ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold">
                            you
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Pill>{label}</Pill>
                      </td>
                      <td className="py-3 pr-4">{fmtXdai(bal)} xDAI</td>
                      <td className="py-3 pr-4">
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6">
          <h3 className="font-breadDisplay text-text-standard text-xl font-extrabold">
            Where the money sits
          </h3>
          <Body className="text-surface-grey-2 mt-2 text-sm">
            The pot lives in Gnosis Chain&apos;s public savings vault and earns
            interest on its own. There is no manager, no fees, and no way for
            anyone — including the people who built this — to reach into it.
            The only thing that ever moves money is the circle&apos;s own rules.
          </Body>
          <Caption className="mt-3 block">
            <a
              className="text-core-orange underline"
              target="_blank"
              rel="noreferrer"
              href={`https://gnosis.blockscout.com/address/${pool.address}`}
            >
              Read this circle&apos;s books →
            </a>
          </Caption>
        </div>
        <div className="border-paper-2 bg-paper-0 rounded-3xl border p-6">
          <h3 className="font-breadDisplay text-text-standard text-xl font-extrabold">
            When someone passes
          </h3>
          <Body className="text-surface-grey-2 mt-2 text-sm">
            Their balance is shared out three ways: the family share they chose
            goes to the person they named, a small thank-you goes to whoever
            truthfully reported the passing, and the rest goes to the surviving
            members — split by the same fair arithmetic pension actuaries use,
            so older members and larger stakes receive proportionally more.
          </Body>
        </div>
      </div>
    </div>
  )
}
