import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "span",
  "mark",
  "ul",
  "ol",
  "li",
  "blockquote",
  "div",
  "a",
];

const ALLOWED_CSS_PROPERTIES = {
  "*": {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
    "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
    "font-size": [/^\d+(?:px|pt|em|rem|%)$/i],
    "text-align": [/^(left|center|right)$/i],
    "margin-left": [/^\d+(?:px|em|rem)$/i],
  },
};

export function sanitizeEmailHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["style"],
    },
    allowedStyles: ALLOWED_CSS_PROPERTIES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  }).trim();
}

export function plainTextToEmailHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />") || "<br />"}</p>`)
    .join("");
}

export function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function normalizeEmailBodyHtml(value: string) {
  return isLikelyHtml(value)
    ? sanitizeEmailHtml(value)
    : sanitizeEmailHtml(plainTextToEmailHtml(value));
}

export function emailHtmlToPlainText(html: string) {
  return sanitizeEmailHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
