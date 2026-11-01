import { BottomNav } from "@/components/bottom-nav";
import { CropImagePicker } from "@/components/crop-image-picker";
import { ModelStatusNotice } from "@/components/model-status";

export default function ScanPage() { return <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-28 pt-8 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Scan</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-950">Check a tomato leaf</h1><p className="mt-4 leading-7 text-stone-600">Take a clear photo of a tomato leaf or choose one from your phone.</p><ModelStatusNotice /><CropImagePicker /><BottomNav /></main>; }
