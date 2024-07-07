import { SignOut } from "@/app/components/sign-out";

export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <div>
        <header>
          <div className="container mx-auto px-4 py-6 flex justify-between items-center">
            <div><span className="font-black">Seer </span>Heuristic Evaluation</div>
            <SignOut />
          </div>
        </header>
        {children}
      </div>
    );
  }