import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-8xl mb-6">🧵</div>
      <h1 className="text-6xl font-display font-bold text-maroon-800 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-gray-700 mb-3">Page Not Found</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        Sorry, the page you&apos;re looking for doesn&apos;t exist. It may have been moved or deleted.
      </p>
      <Link href="/" className="btn-primary inline-flex items-center gap-2">
        Back to Home
      </Link>
    </div>
  );
}
