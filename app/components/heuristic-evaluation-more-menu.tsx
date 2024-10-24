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
            height="24px"
            viewBox="0 -960 960 960"
            width="24px"
            fill="currentColor"
            className="h-6 w-6"
          >
            <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
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
