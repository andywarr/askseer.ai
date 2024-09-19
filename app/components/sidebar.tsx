import Image from "next/image";
import Link from "next/link";
import { SignOut } from "@/app/components/sign-out";
import { Button, Card, ListItem, Typography } from "@/MTailwind";
import React, { useEffect, useState } from 'react';

export default function Sidebar(props: { isOpen: boolean, setIsOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  // const [isOpen, setIsOpen] = useState(false);

  // useEffect(() => {
  //   if (props.isOpen) {
  //     setIsOpen(true);
  //   }
  // }, [props.isOpen]);

  const toggleSidebar = () => {
    // setIsOpen(!isOpen);
    props.setIsOpen(!props.isOpen)
  };

  return (
    <aside className={`
        fixed top-0 left-0 h-full z-40
        transform md:translate-x-0
        transition-transform duration-150 ease-in-out
        ${props.isOpen ? '!translate-x-0' : '!-translate-x-full'}
        md:w-64 w-full
      `}>
      <Card className="h-screen w-full max-w-[20rem] rounded-l-none p-4 shadow-xl shadow-blue-gray-900/5">
        <div className="mb-2 flex items-center gap-4 p-4">
          <Image
            alt="logo"
            className="h-8 w-8"
            src="/logo.svg"
            width={32}
            height={32}
          />
          <Typography className="font-black text-black" variant="h4">
            Seer
          </Typography>
          <Button className="ml-auto" onClick={toggleSidebar} variant="text">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path d="M4 4L20 20M20 4L4 20" stroke="black" stroke-width="2" stroke-linecap="round" />
            </svg>
          </Button>
        </div>
        <Link href="/heuristic/new">
          <Button className="flex w-max items-center gap-3">
            New Study
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14M5 12h14"
              />
            </svg>
          </Button>
        </Link>
        <div className="mt-4">
          <Link href="/heuristic">
            <ListItem>
              Studies
            </ListItem>
          </Link>
        </div>
        <div className="mt-auto">
          <SignOut />
        </div>
      </Card>
    </aside>
  );
}
