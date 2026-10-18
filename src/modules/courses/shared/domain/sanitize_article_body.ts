import sanitizeHtml from 'sanitize-html';

export const sanitizeArticleBody = (body: string): string => sanitizeHtml(body, {
  allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'iframe', 'object', 'embed', 'svg'],
  transformTags: {
    a: (_tag, attrs) => ({ tagName: 'a', attribs: {
      ...(attrs['href'] === undefined ? {} : { href: attrs['href'] }),
      rel: 'nofollow noopener', target: '_blank',
    } }),
  },
}).trim();
