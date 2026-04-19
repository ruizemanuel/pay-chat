import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy · ${SITE.name}`,
  description: `Privacy Policy for ${SITE.name}.`,
};

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← Back to chat
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Effective {SITE.legalEffectiveDate}
        </p>

        <Section title="What we collect">
          <p>
            {SITE.name} is intentionally minimal in what it collects:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Wallet address</strong> — visible to us and to the public Celo blockchain
              when you sign a payment. This is unavoidable for an on-chain payment to work.
            </li>
            <li>
              <strong>Your prompt text</strong> — sent to the AI provider (Groq or Cerebras) to
              generate an answer. We do not store the text on our servers; the providers may
              process and log it according to their own terms.
            </li>
            <li>
              <strong>Standard request metadata</strong> — IP, user agent, timestamps. These are
              kept in Vercel’s default access logs and rotated automatically by Vercel; we do not
              correlate them with wallets.
            </li>
          </ul>
        </Section>

        <Section title="What ends up on-chain">
          <p>
            Each paid query produces two on-chain events on{" "}
            {linkText(SITE.network, SITE.contractExplorerUrl)}:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              An ERC-20 transfer of {SITE.pricePerQuery} {SITE.paymentToken} from your wallet to
              the operator wallet.
            </li>
            <li>
              A <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
                PromptPaid
              </code>{" "}
              event from {linkText(SITE.contractAddress, SITE.contractExplorerUrl)} containing
              your wallet address, the model identifier, a{" "}
              <strong>keccak256 hash</strong> of your prompt (not the raw text), and a timestamp.
            </li>
          </ul>
          <p className="mt-3">
            On-chain data is public and permanent. We hash the prompt before logging so the actual
            words of your question are never written to the blockchain.
          </p>
        </Section>

        <Section title="What we do not collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>No email address, phone number, or KYC information.</li>
            <li>No persistent cookies — we use only the session cookies set by the wallet provider.</li>
            <li>No third-party tracking or analytics.</li>
            <li>No conversation history — your messages live only in your browser’s local memory and disappear when you close the tab.</li>
          </ul>
        </Section>

        <Section title="Third parties involved in serving you">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Groq, Cerebras</strong> — generate AI responses. Your prompt text is sent to
              one of them per query.
            </li>
            <li>
              <strong>thirdweb</strong> — facilitates the x402 payment settlement and operates the
              non-custodial server wallet that receives your payment.
            </li>
            <li>
              <strong>Vercel</strong> — hosts the application and exposes default request logs.
            </li>
            <li>
              <strong>Celo + Mento + Tether</strong> — process the on-chain transfer of{" "}
              {SITE.paymentToken}.
            </li>
          </ul>
        </Section>

        <Section title="Your choices">
          <p>
            You can stop using {SITE.name} at any time. Because we hold no off-chain account or
            personal record of you, there is nothing for us to delete on request beyond what is
            already public on the blockchain (which we cannot rewrite by design).
          </p>
        </Section>

        <Section title="Children">
          <p>
            {SITE.name} is not directed at children under 13. If you believe a child has used the
            service, contact us and we will help where possible — but note that we have no direct
            control over on-chain transactions.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy by changing this page. Material changes will be reflected in
            the effective date above.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions or requests, reach us on Telegram at{" "}
            {linkText(SITE.supportLabel, SITE.supportUrl)}.
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function linkText(text: string, href?: string) {
  return (
    <a
      href={href ?? text}
      target="_blank"
      rel="noopener noreferrer"
      className="text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
    >
      {text}
    </a>
  );
}
