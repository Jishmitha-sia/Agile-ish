'use client';

import { type IssueComment } from '@agile-ish/contracts';
import { cn } from '@agile-ish/ui';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '../ui/avatar.js';
import { Button } from '../ui/button.js';
import { useAuthStore } from '../../stores/auth.store.js';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '../../hooks/use-comments.js';
import { Spinner } from '../ui/spinner.js';

interface Props {
  workspaceSlug: string;
  issueId: string;
}

export function CommentsSection({ workspaceSlug, issueId }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: comments = [], isLoading } = useComments(workspaceSlug, issueId);
  const createComment = useCreateComment(workspaceSlug, issueId);
  const updateComment = useUpdateComment(workspaceSlug, issueId);
  const deleteComment = useDeleteComment(workspaceSlug, issueId);

  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    await toast.promise(createComment.mutateAsync({ body: trimmed }), {
      loading: 'Posting…',
      success: 'Comment posted',
      error: 'Failed to post',
    });
    setBody('');
  };

  const handleEditSave = async (commentId: string) => {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    await toast.promise(updateComment.mutateAsync({ commentId, patch: { body: trimmed } }), {
      loading: 'Saving…',
      success: 'Updated',
      error: 'Failed',
    });
    setEditingId(null);
  };

  const handleDelete = async (commentId: string) => {
    await toast.promise(deleteComment.mutateAsync(commentId), {
      loading: 'Deleting…',
      success: 'Deleted',
      error: 'Failed',
    });
  };

  return (
    <section className="border-border mt-8 border-t pt-6">
      <h3 className="text-foreground mb-4 text-sm font-semibold">
        Comments{' '}
        {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
      </h3>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner className="size-4" /> Loading comments…
        </div>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAuthor={comment.author.id === currentUser?.id}
              editingId={editingId}
              editBody={editBody}
              onStartEdit={() => {
                setEditingId(comment.id);
                setEditBody(comment.body);
              }}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={() => void handleEditSave(comment.id)}
              onEditBodyChange={setEditBody}
              onDelete={() => void handleDelete(comment.id)}
            />
          ))}
        </ul>
      )}

      {/* New comment composer */}
      <div className="mt-4 flex gap-3">
        {currentUser && (
          <Avatar className="mt-0.5 size-7 shrink-0">
            <AvatarImage src={currentUser.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {initialsOf(currentUser.displayName)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="border-border bg-muted/30 focus-within:border-primary/50 flex-1 rounded-lg border transition-colors">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void handleSubmit();
              }
            }}
            placeholder="Write a comment… (Ctrl+Enter to submit)"
            className="min-h-[72px] w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <div className="flex justify-end px-3 pb-2.5">
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!body.trim() || createComment.isPending}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Comment
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Single comment row ───────────────────────────────────────────────────────

function CommentItem({
  comment,
  isAuthor,
  editingId,
  editBody,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditBodyChange,
  onDelete,
}: {
  comment: IssueComment;
  isAuthor: boolean;
  editingId: string | null;
  editBody: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditBodyChange: (v: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isEditing = editingId === comment.id;

  return (
    <li className="group flex gap-3">
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarImage src={comment.author.avatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {initialsOf(comment.author.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{comment.author.displayName}</span>
          <span className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
          {comment.updatedAt !== comment.createdAt && (
            <span className="text-muted-foreground text-xs italic">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="border-border bg-muted/30 focus-within:border-primary/50 mt-1.5 rounded-lg border transition-colors">
            <textarea
              autoFocus
              value={editBody}
              onChange={(e) => onEditBodyChange(e.target.value)}
              className="min-h-[60px] w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
            />
            <div className="flex justify-end gap-2 px-3 pb-2.5">
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveEdit} disabled={!editBody.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-foreground/90 mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
        )}
      </div>

      {isAuthor && !isEditing && (
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="border-border bg-popover absolute right-0 z-20 mt-1 w-32 rounded-md border shadow-md">
                <button
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                  onClick={() => {
                    onStartEdit();
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </button>
                <button
                  className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
