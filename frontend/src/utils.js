export function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function initials(name) {
  const characters = Array.from((name || "访客").trim());
  return characters.slice(0, 2).join("").toUpperCase();
}

export function parseTagsInput(value) {
  const seen = new Set();
  return value
    .split(/[\s,，#]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => {
      if (!tag || tag.length > 20 || seen.has(tag)) {
        return false;
      }
      seen.add(tag);
      return true;
    })
    .slice(0, 5);
}

export function getRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  const postMatch = hash.match(/^\/post\/(\d+)$/);
  if (postMatch) {
    return { name: "post", postId: Number(postMatch[1]) };
  }

  const userMatch = hash.match(/^\/user\/([^/]+)$/);
  if (userMatch) {
    return { name: "profile", username: decodeURIComponent(userMatch[1]) };
  }

  return { name: "home" };
}

export function postPath(postId) {
  return `#/post/${postId}`;
}

export function profilePath(username) {
  return `#/user/${encodeURIComponent(username)}`;
}
