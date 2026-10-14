import Link from "next/link";
import { AddGarment } from "./add-garment";

export default function AddPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Add an item</h1>
        <Link href="/catalog" className="text-sm text-muted-foreground hover:underline">Catalog</Link>
      </header>
      <AddGarment />
    </main>
  );
}
