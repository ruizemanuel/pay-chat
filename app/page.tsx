import { ChatApp } from "@/components/ChatApp";

export default function Home() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ChatApp />
    </div>
  );
}
