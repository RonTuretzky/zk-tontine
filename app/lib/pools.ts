"use client"

import { useEffect, useState } from "react"
import { useReadContract, useReadContracts } from "wagmi"
import { ADDRESSES, factoryAbi, tontinePoolAbi } from "./contracts"

/* Multi-circle support (the crowdstake "instance switcher" idea): the factory
   lists every circle; the active one is chosen in the app bar and persists
   locally. */

export type PoolInfo = {
  address: `0x${string}`
  name: string
  locked: boolean
  lockTime: number
}

const STORAGE_KEY = "long-bread-circle"

export function usePools(): { pools: PoolInfo[]; isLoading: boolean } {
  const { data: addrs } = useReadContract({
    address: ADDRESSES.factory,
    abi: factoryAbi,
    functionName: "allPools",
  })
  const list = (addrs ?? []) as readonly `0x${string}`[]
  const { data: rows, isLoading } = useReadContracts({
    contracts: list.flatMap((address) => [
      { address, abi: tontinePoolAbi, functionName: "name" } as const,
      { address, abi: tontinePoolAbi, functionName: "isLocked" } as const,
      { address, abi: tontinePoolAbi, functionName: "lockTime" } as const,
    ]),
    query: { enabled: list.length > 0 },
  })
  const pools = list.map((address, i) => ({
    address,
    name: (rows?.[i * 3]?.result as string) ?? "…",
    locked: (rows?.[i * 3 + 1]?.result as boolean) ?? false,
    lockTime: Number((rows?.[i * 3 + 2]?.result as bigint) ?? 0n),
  }))
  return { pools, isLoading }
}

export function useActivePool(): {
  pool: PoolInfo | undefined
  pools: PoolInfo[]
  setActive: (address: `0x${string}`) => void
} {
  const { pools } = usePools()
  const [selected, setSelected] = useState<`0x${string}` | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) setSelected(saved as `0x${string}`)
  }, [])

  const setActive = (address: `0x${string}`) => {
    window.localStorage.setItem(STORAGE_KEY, address)
    setSelected(address)
  }

  // Default: the first circle that's still open to join, else the first.
  const pool =
    pools.find((p) => p.address === selected) ??
    pools.find((p) => !p.locked) ??
    pools[0]

  return { pool, pools, setActive }
}
