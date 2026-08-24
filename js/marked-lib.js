// Markdown rendering, bundled from the `marked` npm package (MIT licensed)
// so previews render entirely client-side -- nothing sent to any server.
import { marked } from 'marked';
window.marked = marked;
