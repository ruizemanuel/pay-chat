import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-4 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Home
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/tos" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href={SITE.supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Support
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={SITE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          GitHub
        </a>
      </nav>
    </footer>
  );
}
