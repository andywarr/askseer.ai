"use client";

import { useRouter } from "next/navigation";
import { IconButton, Menu, MenuHandler, MenuItem, MenuList } from "@/MTailwind";
import { deleteHeuristicEvaluation } from "../lib/data";
import { deleteS3Objects } from "../lib/action";

export default function MoreMenu({
  heuristicEvaluation,
  sessionId,
}: {
  heuristicEvaluation: any;
  sessionId: string;
}) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      // Delete the heuristic evaluation from the database
      await deleteHeuristicEvaluation(heuristicEvaluation.id, sessionId);

      // Delete the images from S3
      await deleteS3Objects(
        heuristicEvaluation.files.map((file: { key: string }) => file.key),
      );

      // Redirect to the heuristic evaluations page
      router.push("/heuristic");
    } catch (error) {
      console.error(
        "Failed to delete heuristic evaluation or S3 objects:",
        error,
      );
    }
  };

  return (
    <Menu placement="bottom-end">
      <MenuHandler>
        <IconButton variant="text" ripple={false}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" />
            <path d="M14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20C10 18.8954 10.8954 18 12 18C13.1046 18 14 18.8954 14 20Z" />
            <path d="M14 4C14 5.10457 13.1046 6 12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4Z" />
          </svg>
        </IconButton>
      </MenuHandler>
      <MenuList className="flex flex-col gap-2">
        <MenuItem disabled>Share</MenuItem>
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </MenuList>
    </Menu>
  );
}
