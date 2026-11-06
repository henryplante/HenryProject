export type CommentComposerProps = {
  materialId: string;
  versionId: string;
};

// Placeholder. FE-07 replaces this file wholesale with the comment form.
export function CommentComposer({ materialId, versionId }: CommentComposerProps) {
  return (
    <div
      data-slot="comment-composer"
      data-material-id={materialId}
      data-version-id={versionId}
      className="empty:hidden"
    />
  );
}
