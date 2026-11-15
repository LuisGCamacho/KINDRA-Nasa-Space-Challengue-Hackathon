import Image from "next/image";
import Link from "next/link";
import { SectionTabs } from "./SectionTabs";
import { ReturnButton } from "./ReturnButton";

/** Encabezado: marca a la izquierda, secciones en una píldora y Return a la derecha. */
export function AppHeader({ alertCount }: { alertCount: number }) {
  return (
    <header className="sticky top-0 z-30 bg-[rgba(4,5,12,0.55)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <Link href="/explorar" className="flex shrink-0 items-center gap-2.5">
          <Image src="/brand/kindra-glyph.png" alt="" width={32} height={32} />
          <span className="text-[16px] font-medium tracking-[-0.02em]">KINDRA</span>
        </Link>

        <div className="ml-auto lg:order-3">
          <ReturnButton />
        </div>

        <div className="order-last w-full overflow-x-auto no-scrollbar lg:order-2 lg:mx-auto lg:w-auto">
          <SectionTabs alertCount={alertCount} />
        </div>
      </div>
    </header>
  );
}
