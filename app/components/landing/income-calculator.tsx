"use client"

import { useState } from "react"
import { Body, Caption } from "@breadcoop/ui"

/* Consumer calculator (crowdstake's Funding Calculator, tontine edition):
   age + stake → the monthly income the age-banded payout rule would allow,
   and how it grows purely with age. Mirrors TontinePool.payoutRateBpsForAge. */

function payoutRateBps(age: number): number {
  if (age < 60) return 400
  if (age < 65) return 500
  if (age < 70) return 560
  if (age < 75) return 650
  if (age < 80) return 800
  if (age < 85) return 1000
  if (age < 90) return 1300
  return 1800
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })

export function IncomeCalculator() {
  const [age, setAge] = useState(65)
  const [stake, setStake] = useState(5000)

  const monthlyAt = (a: number, balance: number) =>
    (balance * payoutRateBps(a)) / 10000 / 12

  // Balance growth here shows ONLY the age-based rule on a flat balance —
  // no interest, no shared balances — so the numbers under-promise.
  const rows = [age, 70, 75, 80, 85, 90]
    .filter((a, i, arr) => a >= age && arr.indexOf(a) === i)
    .slice(0, 4)

  return (
    <section id="calculator" className="section-container py-20">
      <div className="border-paper-2 bg-paper-0 grid gap-10 rounded-3xl border p-8 sm:p-12 lg:grid-cols-2">
        <div>
          <span className="border-paper-2 bg-paper-1 text-surface-grey-2 inline-block rounded-lg border px-4 py-1.5 text-sm font-semibold">
            What could a circle pay you?
          </span>
          <h2 className="font-breadDisplay text-text-standard mt-4 text-3xl font-extrabold tracking-tight">
            Income that grows as you age
          </h2>
          <Body className="text-surface-grey-2 mt-3">
            Your monthly draw is sized to your age — the older you are, the larger
            the share of your balance you may take each month. And this is before
            interest and before anything the circle shares with you; the real
            numbers only go up from here.
          </Body>

          <div className="mt-8 space-y-6">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label">Your age</label>
                <span className="font-breadDisplay text-core-orange text-2xl font-extrabold">
                  {age}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={90}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="accent-core-orange w-full"
                aria-label="Your age"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label">What you put in (xDAI)</label>
                <span className="font-breadDisplay text-core-orange text-2xl font-extrabold">
                  {fmt(stake)}
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="accent-core-orange w-full"
                aria-label="What you put in"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="border-paper-2 divide-paper-2 divide-y overflow-hidden rounded-2xl border">
            {rows.map((a, i) => (
              <div
                key={a}
                className={`flex items-center justify-between px-5 py-4 ${
                  i === 0 ? "bg-core-orange/5" : "bg-paper-0"
                }`}
              >
                <div>
                  <div className="text-text-standard text-sm font-bold">
                    {i === 0 ? "Today" : `At ${a}`}
                  </div>
                  <Caption className="text-surface-grey-2">
                    {(payoutRateBps(a) / 100).toFixed(1)}% of your balance per year
                  </Caption>
                </div>
                <div className="text-right">
                  <div className="font-breadDisplay text-text-standard text-2xl font-extrabold">
                    {fmt(monthlyAt(a, stake))}
                  </div>
                  <Caption className="text-surface-grey-2">xDAI / month</Caption>
                </div>
              </div>
            ))}
          </div>
          <Caption className="text-surface-grey-2 mt-3">
            Shown on your stake alone, with a flat balance. Interest and the
            circle&apos;s shared balances come on top.
          </Caption>
        </div>
      </div>
    </section>
  )
}
