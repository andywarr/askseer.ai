'use client'

import {
  Button
} from "@/MTailwind";
import { useFormStatus } from 'react-dom'

export function Evaluate(props: { credits: number }) {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={props.credits > 0 && !pending ? false : true}
      loading={pending}
      variant="gradient"
      size="md"
      className="w-32"
      type="submit"
    >Evaluate</Button>
  )
}
