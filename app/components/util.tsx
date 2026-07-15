"use client"

import { Caption } from "@breadcoop/ui"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatUnits } from "viem"

export function useTx() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  return {
    writeContract,
    hash,
    isPending: isPending || (hash != null && receipt.isLoading),
    isSuccess: receipt.isSuccess,
    error,
    reset,
  }
}

export function TxStatus({
  isPending,
  isSuccess,
  error,
  successNote,
}: {
  isPending: boolean
  isSuccess: boolean
  error: Error | null
  successNote: string
}) {
  if (isPending) return <Caption>Waiting for the chain…</Caption>
  if (error) {
    const msg = (error as { shortMessage?: string }).shortMessage ?? error.message
    return <Caption className="text-system-red">{msg}</Caption>
  }
  if (isSuccess) return <Caption className="text-system-green">{successNote}</Caption>
  return null
}

export function fmtXdai(shares: bigint | undefined, decimals = 2): string {
  if (shares === undefined) return "—"
  const n = Number(formatUnits(shares, 18))
  // Small demo amounts must not round to a misleading "0".
  const digits = n > 0 && n < 1 ? 4 : decimals
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function fmtCountdown(target: number | undefined): string {
  if (!target) return "—"
  const s = target - Math.floor(Date.now() / 1000)
  if (s <= 0) return "now"
  if (s < 3600) return `${Math.ceil(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.ceil((s % 3600) / 60)} min`
  return `${Math.floor(s / 86400)} days`
}

export function shortId(id: string): string {
  return `${id.slice(0, 10)}…${id.slice(-6)}`
}

/* Reliable status pill (the kit Chip inherits the theme's dark-scheme text
   color in some contexts). */
export function Pill({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "green" | "red" }) {
  const tones = {
    paper: "border-paper-2 bg-paper-0 text-text-standard",
    green: "border-system-green/40 bg-system-green/10 text-text-standard",
    red: "border-system-red/40 bg-system-red/10 text-text-standard",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
