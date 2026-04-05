import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-4xl font-bold text-zinc-900">Игра на точность тайминга</h1>
        <p className="text-lg text-zinc-600 text-center max-w-md">
          Проверьте свою реакцию: угадайте момент события в видео
        </p>
        <Link
          href="/game"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Начать игру
        </Link>
      </main>
    </div>
  );
}
