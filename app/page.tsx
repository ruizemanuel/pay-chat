import { ChatApp } from "@/components/ChatApp";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex flex-1 flex-col">
        <ChatApp />
      </div>
      <Footer />
    </div>
  );
}
