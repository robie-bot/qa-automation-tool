export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-[#FF7F11]">QA</span>{' '}
            <span className="text-t-primary">Automation</span>
          </h1>
          <p className="text-sm text-t-secondary mt-1">Website Review Tool</p>
        </div>
        {children}
      </div>
    </div>
  );
}
