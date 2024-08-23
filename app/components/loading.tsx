'use client'

import {
  Spinner
} from "@/MTailwind";

export function Loading() {
  return (
    <div className="fixed top-0 left-0 w-screen h-screen bg-black/80 flex items-center justify-center ">
      <Spinner color="blue-gray" className="h-16 w-16" />
    </div>
  )
}
