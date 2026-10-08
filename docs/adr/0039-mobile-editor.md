# ADR-0039: The phone edits rich text with Tiptap in an Expo DOM component

- Status: Accepted
- Date: 2026-10-09
- Deciders: Mobile agent; owner
- Spec sections: §4.1, §13 (native app, not a web wrapper)

## Context

Cards hold Tiptap/ProseMirror JSON (`@lvn/contracts/validation`). The phone must edit it without breaking what the web
writes. Options: `@10play/tentap-editor` (Tiptap in a WebView with native toolbars, its own Tiptap build), writing a
native rich-text editor, or Expo DOM components (`'use dom'`, SDK 57: built in through `@expo/dom-webview`, no extra
native module), which run the same Tiptap 3 the web uses.

## Decision

1. **Reading is native.** Every card type renders from its JSON with native views (lvn-mobile `features/notes/render`);
   no web view is involved in reading.
2. **Rich text is edited in a DOM component** (`features/notes/editor/RichTextEditor.tsx`): Tiptap 3.31 with the
   StarterKit marks and lists the contracts allow, a small toolbar, the document in as JSON and out through a debounced
   async callback. Only the card being edited has a web view, so a note never holds more than one.
3. **Simple cards are native fields**: heading (with level), code (with language), checklist items, callout title,
   quote attribution.
4. **Structured cards** (table, question, quiz, flashcard, diagram, markdown, media) are read on the phone and edited
   on the web for now; the phone says so on the card.

## Consequences

- One editor engine for web and phone, the same schema and versions: what one writes, the other reads and edits.
- The first rich-text edit loads the web view (slower than native text); measured on a mid-range phone before release.
- Native forms for structured cards can follow without changing this decision.
