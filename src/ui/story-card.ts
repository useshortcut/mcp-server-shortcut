export const STORY_CARD_RESOURCE_URI = "ui://stories/story-card.html";
export const STORY_CARD_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
export const STORY_CARD_LEGACY_META_KEY = "ui/resourceUri";

export const STORY_CARD_CSP = {
	resourceDomains: ["https://unpkg.com"],
	connectDomains: [],
};

export const STORY_CARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shortcut Story Card</title>
  <style>
    :root {
      color-scheme: light dark;
      --card-bg: color-mix(in oklab, canvas 94%, transparent);
      --card-border: color-mix(in oklab, canvastext 20%, transparent);
      --muted: color-mix(in oklab, canvastext 65%, transparent);
      --pill-bg: color-mix(in oklab, canvastext 9%, transparent);
      --pill-border: color-mix(in oklab, canvastext 18%, transparent);
    }
    body {
      margin: 0;
      font: 13px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: transparent;
      color: canvastext;
    }
    .card {
      margin: 8px;
      padding: 14px;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      background: linear-gradient(160deg, var(--card-bg), transparent);
      box-shadow: 0 8px 24px color-mix(in oklab, black 10%, transparent);
    }
    .heading {
      margin: 0 0 10px;
      font-size: 16px;
      line-height: 1.25;
      font-weight: 650;
      letter-spacing: 0.01em;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--pill-border);
      background: var(--pill-bg);
      white-space: nowrap;
    }
    .label {
      color: var(--muted);
      font-weight: 500;
    }
    .value {
      font-weight: 600;
    }
    .owner {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 32px;
    }
    .avatar-container {
      width: 32px;
      height: 32px;
      position: relative;
    }
    .avatar {
      position: absolute;
      top: 0;
      left: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--pill-border);
      object-fit: cover;
      background: var(--pill-bg);
      flex: 0 0 auto;
    }
    .avatar-fallback {
      position: absolute;
      top: 0;
      left: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--pill-border);
      background: var(--pill-bg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      flex: 0 0 auto;
    }
    .owner-name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <article class="card" aria-live="polite">
    <h1 class="heading" id="story-title">Loading story...</h1>
    <section class="meta">
      <div class="pill"><span class="label">ID</span><span class="value" id="story-id">-</span></div>
      <div class="pill"><span class="label">Type</span><span class="value" id="story-type">-</span></div>
    </section>
    <section class="owner">
      <div class="avatar-container">
        <span class="avatar-fallback" id="owner-avatar-fallback"></span>
        <img class="avatar" id="owner-avatar" alt="Story owner avatar" hidden />
      </div>
      <span class="owner-name" id="owner-name"></span>
    </section>
  </article>

  <script type="module">
    import { App } from "https://unpkg.com/@modelcontextprotocol/ext-apps/app-with-deps";

    const idEl = document.getElementById("story-id");
    const titleEl = document.getElementById("story-title");
    const typeEl = document.getElementById("story-type");
    const ownerAvatarEl = document.getElementById("owner-avatar");
    const ownerAvatarFallbackEl = document.getElementById("owner-avatar-fallback");
    const ownerNameEl = document.getElementById("owner-name");

    const app = new App({ name: "Shortcut Story Card", version: "0.1.0" });

    const renderStory = (story) => {
      if (!story || typeof story !== "object") return;
      if (typeof story.id !== "number") return;
      if (typeof story.title !== "string") return;
      if (typeof story.type !== "string") return;
      idEl.textContent = String(story.id);
      titleEl.textContent = story.title;
      typeEl.textContent = story.type;

      const owner = story.owner;
      const ownerName =
        owner && typeof owner === "object" && typeof owner.name === "string"
          ? owner.name
          : "Unassigned";
      const avatarUrl =
        owner && typeof owner === "object" && typeof owner.avatarUrl === "string"
          ? owner.avatarUrl
          : null;
      const avatarDataUrl =
        owner && typeof owner === "object" && typeof owner.avatarDataUrl === "string"
          ? owner.avatarDataUrl
          : null;
      const avatarSrc = avatarDataUrl || avatarUrl;

      ownerNameEl.textContent = ownerName;
      ownerAvatarFallbackEl.textContent = ownerName
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((name) => name.charAt(0))
        .join("")
        .toUpperCase() || "?";

      if (avatarSrc) {
        ownerAvatarEl.src = avatarSrc;
        ownerAvatarEl.onload = () => {
          ownerAvatarEl.hidden = false;
          ownerAvatarFallbackEl.hidden = true;
        };
        ownerAvatarEl.onerror = () => {
          ownerAvatarEl.hidden = true;
          ownerAvatarFallbackEl.hidden = false;
        };
      } else {
        ownerAvatarEl.hidden = true;
        ownerAvatarFallbackEl.hidden = false;
      }
    };

    app.ontoolresult = (result) => {
      const story = result?.structuredContent?.story;
      renderStory(story);
    };

    app.connect();
  </script>
</body>
</html>`;
