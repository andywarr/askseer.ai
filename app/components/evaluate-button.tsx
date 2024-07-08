'use client'

import {
  Button
} from "@/MTailwind";
import { useFormStatus } from 'react-dom'
 
export function Evaluate() {
  const { pending } = useFormStatus();

  return (
    <Button
      loading={pending}
      variant="gradient"
      size="md"
      className={pending ? "text-[0px] inline-block mt-4 w-28" : "inline-block mt-4 w-28"}
      type="submit"
    >Evaluate</Button>
  )
}
