'use client';

import { InviteMemberRequest } from '@agile-ish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MoreHorizontal, Plus, ShieldX, UserMinus, UserPlus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TopBar } from '../../../../../components/app-shell/top-bar.js';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../../../../../components/ui/avatar.js';
import { Button } from '../../../../../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../components/ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../../components/ui/dropdown-menu.js';
import { FormField } from '../../../../../components/ui/form-field.js';
import { Input } from '../../../../../components/ui/input.js';
import { Spinner } from '../../../../../components/ui/spinner.js';
import {
  useInvitations,
  useRevokeInvitation,
} from '../../../../../hooks/use-invitations.js';
import {
  useChangeMemberRole,
  useInviteMember,
  useMembers,
  useRemoveMember,
} from '../../../../../hooks/use-members.js';
import { useWorkspace } from '../../../../../hooks/use-workspaces.js';
import { ApiError } from '../../../../../lib/api-error.js';
import { useAuthStore } from '../../../../../stores/auth.store.js';

import type {
  InviteMemberRequest as InviteMemberRequestType,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole as WorkspaceRoleType,
} from '@agile-ish/contracts';

const ASSIGNABLE_ROLES: readonly Exclude<WorkspaceRoleType, 'OWNER'>[] = [
  'ADMIN',
  'MEMBER',
  'GUEST',
];

export default function MembersPage() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.workspaceSlug === workspaceSlug);
  const canManage = membership
    ? membership.role === 'OWNER' || membership.role === 'ADMIN'
    : false;

  const { data: workspace } = useWorkspace(workspaceSlug);
  const { data: members, isLoading: membersLoading } = useMembers(workspaceSlug);
  const { data: invitations, isLoading: invLoading } = useInvitations(workspaceSlug);

  return (
    <>
      <TopBar
        title="Members"
        description={workspace?.name ?? workspaceSlug}
        actions={
          canManage ? <InviteDialog workspaceSlug={workspaceSlug} /> : null
        }
      />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-4xl space-y-10">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Members
              </h3>
              {members?.length ? (
                <span className="text-xs text-muted-foreground">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              ) : null}
            </div>
            {membersLoading ? (
              <Spinner className="size-5 text-muted-foreground" />
            ) : !members || members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {members.map((m) => (
                  <li key={m.userId}>
                    <MemberRow
                      member={m}
                      workspaceSlug={workspaceSlug}
                      canManage={canManage}
                      isSelf={m.userId === user?.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage ? (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Pending invitations
                </h3>
                {invitations?.length ? (
                  <span className="text-xs text-muted-foreground">
                    {invitations.length} pending
                  </span>
                ) : null}
              </div>
              {invLoading ? (
                <Spinner className="size-5 text-muted-foreground" />
              ) : !invitations || invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending invitations. Click <span className="font-medium">Invite</span> to add someone.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {invitations.map((inv) => (
                    <li key={inv.id}>
                      <InvitationRow invitation={inv} workspaceSlug={workspaceSlug} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

function MemberRow({
  member,
  workspaceSlug,
  canManage,
  isSelf,
}: {
  member: WorkspaceMember;
  workspaceSlug: string;
  canManage: boolean;
  isSelf: boolean;
}) {
  const changeRole = useChangeMemberRole(workspaceSlug, member.userId);
  const removeMember = useRemoveMember(workspaceSlug, member.userId);
  // OWNER cannot be modified through this UI; ownership transfer is a future feature.
  const isOwner = member.role === 'OWNER';
  const canEditThisRow = canManage && !isOwner && !isSelf;

  const handleRoleChange = async (next: Exclude<WorkspaceRoleType, 'OWNER'>) => {
    try {
      await changeRole.mutateAsync({ role: next });
      toast.success(`Updated role to ${next.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update role.');
    }
  };

  const handleRemove = async () => {
    try {
      await removeMember.mutateAsync();
      toast.success(`Removed ${member.user.displayName}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove member.');
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar>
        {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}
        <AvatarFallback>{initialsOf(member.user.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.user.displayName}</span>
          {isSelf ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              You
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">{member.user.email}</div>
      </div>
      <RoleBadge role={member.role} />
      {canEditThisRow ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Member actions"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Change role</DropdownMenuLabel>
            {ASSIGNABLE_ROLES.map((r) => (
              <DropdownMenuItem
                key={r}
                onSelect={() => void handleRoleChange(r)}
                disabled={member.role === r}
              >
                {r}
                {member.role === r ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">current</span>
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleRemove()}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <UserMinus className="size-4" />
              <span>Remove from workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="size-7" aria-hidden />
      )}
    </div>
  );
}

function InvitationRow({
  invitation,
  workspaceSlug,
}: {
  invitation: WorkspaceInvitation;
  workspaceSlug: string;
}) {
  const revoke = useRevokeInvitation(workspaceSlug);
  const handleRevoke = async () => {
    try {
      await revoke.mutateAsync(invitation.id);
      toast.success(`Revoked invitation to ${invitation.email}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not revoke invitation.');
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Mail className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{invitation.email}</div>
        <div className="truncate text-xs text-muted-foreground">
          Expires {formatExpiry(invitation.expiresAt)}
          {invitation.invitedBy ? ` · invited by ${invitation.invitedBy.displayName}` : null}
        </div>
      </div>
      <RoleBadge role={invitation.role} />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void handleRevoke()}
        disabled={revoke.isPending}
        aria-label="Revoke invitation"
      >
        <ShieldX className="size-4" /> Revoke
      </Button>
    </div>
  );
}

function RoleBadge({ role }: { role: WorkspaceRoleType }) {
  const tone =
    role === 'OWNER'
      ? 'bg-primary/15 text-primary'
      : role === 'ADMIN'
        ? 'bg-amber-500/15 text-amber-400'
        : role === 'MEMBER'
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-muted text-muted-foreground';
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      {role.toLowerCase()}
    </span>
  );
}

function InviteDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const invite = useInviteMember(workspaceSlug);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberRequestType>({
    resolver: zodResolver(InviteMemberRequest),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await invite.mutateAsync(values);
      if (result.kind === 'member') {
        toast.success(`${result.member.user.displayName} added as ${result.member.role.toLowerCase()}`);
      } else {
        toast.success(`Invitation sent to ${result.invitation.email}`);
      }
      reset({ email: '', role: 'MEMBER' });
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldIssues?.length) {
          for (const issue of err.fieldIssues) {
            const path = issue.path.join('.');
            if (path === 'email' || path === 'role') {
              setError(path, { type: 'server', message: issue.message });
            }
          }
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Could not send invitation.');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a 14-day acceptance link. If they already
            have an account, they&apos;re added immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="teammate@company.com"
              {...register('email')}
            />
          </FormField>
          <FormField id="role" label="Role" error={errors.role?.message}>
            <select
              {...register('role')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || invite.isPending}>
              {isSubmitting || invite.isPending ? <Spinner /> : <Plus />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatExpiry(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.floor(ms / (3600 * 1000));
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return 'in under an hour';
}
