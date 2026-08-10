/**
 * Renders an inline <script> that runs once during server-sent HTML parsing
 * (before first paint) without tripping React's "script tag while rendering"
 * warning on the client: on the server it's a real `text/javascript` script,
 * on the client it renders as inert `text/plain`. See the Next.js guide
 * "preventing-flash-before-hydration".
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
