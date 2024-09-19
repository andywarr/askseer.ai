"use client";

import Sidebar from "@/app/components/sidebar";
import {
  Button,
} from "@/MTailwind";
import { useState } from 'react';

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
        <Button className="!absolute mt-8" onClick={handleButtonClick} variant="text">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </Button>
        <div className={`transition-all duration-150 ease-in-out ${isOpen ? "md:ml-64" : "ml-16"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
