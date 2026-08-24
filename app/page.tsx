'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, FileText, Info, Plus, ShieldCheck, Users, WalletCards, X } from 'lucide-react'

const money = (value: string) => Number(value.replace(/[^0-9]/g, '')) || 0
const formatNaira = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)

const fields = [
  ['Agency fee', 'Commission charged by your agency', 'agency'],
  ['Agreement fee', 'One-time tenancy agreement preparation fee', 'agreement'],
  ['Caution fee', 'Refundable security deposit, where applicable', 'caution'],
  ['Inspection fee', 'Fee for property inspection and viewing', 'inspection'],
  ['Documentation fee', 'References, verification, and administration', 'documentation'],
] as const

type FeeKey = (typeof fields)[number][2]

export default function Page() {
  const [fees, setFees] = useState<Record<FeeKey, string>>({ agency: '0', agreement: '150000', caution: '200000', inspection: '0', documentation: '50000' })
  const [otherName, setOtherName] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalFees = useMemo(() => Object.values(fees).reduce((sum, value) => sum + money(value), 0) + money(otherAmount), [fees, otherAmount])
  const updateFee = (key: FeeKey, value: string) => { setSaved(false); setFees((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') })) }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-20 items-center justify-between border-b px-6 md:px-10">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 size={19} /></div><span className="font-serif text-xl font-semibold">rentora</span></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Agent workspace</p><p className="text-sm font-medium">Adaobi Okafor</p></div>
      </header>
      <div className="mx-auto max-w-6xl p-5 md:p-10">
        <section className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Fee transparency</p><h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Set every charge before you publish.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Tell applicants exactly what they will pay. Only fees with an amount will appear on your property listing.</p></section>
        <section className="grid gap-6 lg:grid-cols-[1fr_390px]">
          <div className="rounded-2xl border bg-card p-5 md:p-7">
            <div className="mb-6 flex items-start justify-between"><div><h2 className="font-serif text-2xl font-semibold">Property charges</h2><p className="mt-1 text-sm text-muted-foreground">Amounts are shown in Nigerian naira.</p></div><ShieldCheck className="text-primary" /></div>
            <div className="flex flex-col gap-5">
              {fields.map(([label, hint, key]) => <label key={key} className="flex flex-col gap-2"><span className="text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span><div className="flex h-11 items-center rounded-lg border bg-background px-3 focus-within:ring-4 focus-within:ring-primary/15"><span className="mr-2 text-sm text-muted-foreground">₦</span><input aria-label={label} inputMode="numeric" value={fees[key]} onChange={(event) => updateFee(key, event.target.value)} className="w-full bg-transparent text-sm font-medium outline-none" placeholder="0" /></div></label>)}
              <div className="border-t pt-5"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Other fee <span className="font-normal text-muted-foreground">(optional)</span></p><p className="mt-1 text-xs text-muted-foreground">Add a clearly named charge not listed above.</p></div><button type="button" onClick={() => setShowOther((value) => !value)} className="flex items-center gap-1 text-xs font-medium text-primary">{showOther ? <X size={14} /> : <Plus size={14} />}{showOther ? 'Remove' : 'Add fee'}</button></div>{showOther && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px]"><input aria-label="Other fee name" value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="e.g. Legal fee" className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-4 focus:ring-primary/15" /><div className="flex h-11 items-center rounded-lg border bg-background px-3"><span className="mr-2 text-sm text-muted-foreground">₦</span><input aria-label="Other fee amount" inputMode="numeric" value={otherAmount} onChange={(event) => setOtherAmount(event.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="w-full bg-transparent text-sm outline-none" /></div></div>}</div>
            </div>
            <div className="mt-7 flex flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center"><p className="max-w-md text-xs leading-5 text-muted-foreground"><Info size={13} className="mr-1 inline text-primary" /> Rentora's 3.5% platform fee is calculated on annual rent only, not on these charges.</p><button type="button" onClick={() => setSaved(true)} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">{saved ? <Check size={16} /> : null}{saved ? 'Charges saved' : 'Save charges'}</button></div>
          </div>
          <aside className="rounded-2xl bg-primary p-6 text-primary-foreground"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground/65">Student view</p><h2 className="mt-1 font-serif text-2xl font-semibold">Move-in summary</h2><div className="mt-7 rounded-xl bg-primary-foreground p-4 text-foreground"><div className="flex justify-between border-b pb-4"><div><p className="text-sm font-semibold">The Ivory Court</p><p className="mt-1 text-xs text-muted-foreground">Yaba, Lagos · 2 Bedroom Flat</p></div><span className="text-xs font-semibold text-primary">For rent</span></div><div className="flex flex-col gap-3 py-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Annual rent</span><span>{formatNaira(1800000)}</span></div>{fields.map(([label, , key]) => money(fees[key]) > 0 && <div key={key} className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{formatNaira(money(fees[key]))}</span></div>)}{showOther && otherName && money(otherAmount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{otherName}</span><span>{formatNaira(money(otherAmount))}</span></div>}</div><div className="flex justify-between border-t pt-4 text-sm font-semibold"><span>Total move-in cost</span><span>{formatNaira(1800000 + totalFees)}</span></div></div><div className="mt-5 flex gap-2 text-xs leading-5 text-primary-foreground/75"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> Applicants see this breakdown before they apply.</div></aside>
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={Building2} label="Active properties" value="12" /><Stat icon={Users} label="Applications" value="28" /><Stat icon={WalletCards} label="Total fees configured" value={formatNaira(totalFees)} /></section>
      </div>
    </main>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) { return <div className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon size={18} className="text-primary" /></div><p className="mt-3 font-serif text-2xl font-semibold">{value}</p></div> }
