import { initials } from "../utils";

export default function Avatar({ author, small = false, onClick = null }) {
  const className = `avatar${small ? " avatar-small" : ""}${
    onClick ? " avatar-button" : ""
  }`;
  const content = initials(author.display_name);

  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {content}
    </span>
  );
}

export function AuthorBadge({ author }) {
  if (author.role === "admin") {
    return <span className="author-badge admin">管理员</span>;
  }
  if (author.is_legacy) {
    return <span className="author-badge legacy">历史留言</span>;
  }
  return <span className="author-badge">成员</span>;
}
