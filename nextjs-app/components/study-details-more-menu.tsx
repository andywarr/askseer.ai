"use client";

// Next imports
import { useRouter } from "next/navigation";

// Lib function imports
import { deleteStudy } from "@/lib/data";
import { deleteS3Objects } from "@/lib/action";

// UI component imports
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MoreMenu({
  study,
  sessionId,
}: {
  study: any;
  sessionId: string;
}) {
  const router = useRouter();

  const handleDelete = async () => {
    try {
      // Delete the heuristic evaluation from the database
      await deleteStudy(study.id, sessionId);

      // Delete the images from S3
      await deleteS3Objects(
        study.files.map((file: { key: string }) => file.key),
      );

      // Redirect to the heuristic evaluations page
      router.push("/studies");
    } catch (error) {
      console.error("Failed to delete study or S3 objects:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="currentColor"
          >
            <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <span>Share</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete}>
            <span className="text-red-500">Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
