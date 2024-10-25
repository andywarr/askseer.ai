"use client";

import Sidebar from "@/app/components/sidebar";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isOpen, setIsOpen] = useState(false);

  const handleButtonClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex">
      <Sidebar isOpen={isOpen} setIsOpen={setIsOpen} />
      <main className="flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="!absolute ml-8 mt-8"
          onClick={handleButtonClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="currentColor"
          >
            <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
          </svg>
        </Button>
        <div
          className={`transition-all duration-150 ease-in-out ${isOpen ? "md:ml-64" : "ml-16"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
