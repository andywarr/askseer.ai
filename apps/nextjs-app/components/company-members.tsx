"use client";

import { useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/apps/nextjs-app/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/apps/nextjs-app/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { getInitials } from "@/apps/nextjs-app/lib/utils";
import { toast } from "sonner";
import { updateCompanyMemberRole } from "@/apps/nextjs-app/lib/data";

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

interface Props {
  companyId: string;
  members: Member[];
  canEdit: boolean;
  currentUserId: string;
}

const roles = ["OWNER", "ADMIN", "BILLING", "MEMBER", "VIEWER"];

export default function CompanyMembers({
  companyId,
  members,
  canEdit,
  currentUserId,
}: Props) {
  const [pending, startTransition] = useTransition();

  const handleChange = (userId: string, role: string) => {
    startTransition(async () => {
      try {
        await updateCompanyMemberRole(companyId, userId, role);
        toast.success("Membership updated");
      } catch (e: any) {
        toast.error(e?.message || "Failed to update membership");
      }
    });
  };

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Members
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last Access</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.userId}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {m.user.image ? (
                      <AvatarImage src={m.user.image} />
                    ) : (
                      <AvatarFallback>
                        {getInitials(m.user.name || m.user.email)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span>{m.user.name || m.user.email}</span>
                </div>
              </TableCell>
              <TableCell>{m.user.email}</TableCell>
              <TableCell>
                {canEdit && m.userId !== currentUserId ? (
                  <Select
                    defaultValue={m.role}
                    onValueChange={(value) => handleChange(m.userId, value)}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="capitalize">{m.role.toLowerCase()}</span>
                )}
              </TableCell>
              <TableCell>
                {new Date(m.joinedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {m.user.lastAccessedAt
                  ? new Date(m.user.lastAccessedAt).toLocaleDateString()
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

