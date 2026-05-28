# Relay

Relay is a standalone personal meeting follow-up app. Paste one block of meeting notes, generate once, and Relay turns the notes into a ClassLoop-style dashboard with recap, tasks, due dates, resources, questions, and progress.

## Features

- Single paste box for meeting notes.
- Google Docs template card with a copy-link button and source edit link.
- Loader transition before the generated dashboard.
- Personal dashboard inspired by the ClassLoop student dashboard.
- Editable task titles, statuses, and due-date text.
- Resources, questions, insights, history, local persistence, recap copy, and JSON export.

## Google Docs Template

Create a Google Doc with this structure, then publish/share it so visitors can copy it:

```text
Meeting title:
Date:

Context:

Resources:

Questions:

Due dates:

Meeting minutes:
```

Set the links in `.env.local`:

```bash
VITE_RELAY_TEMPLATE_COPY_URL=https://docs.google.com/document/d/1o6WZbshidrm99XdLXae_i7Ws5jsI4Nff8L-5OpH3uck/copy
VITE_RELAY_TEMPLATE_EDIT_URL=https://docs.google.com/document/d/1o6WZbshidrm99XdLXae_i7Ws5jsI4Nff8L-5OpH3uck/edit
```

## Commands

```bash
npm install
npm run dev
npm run test
npm run build
npm run test:browser
```

## Project Structure

```text
src/
  App.tsx       Relay UI and page state
  relay.ts      Meeting-note parsing and draft generation
  styles.css    ClassLoop-inspired visual system
tests/
  relay.test.ts parser tests
  browser/      Playwright flow tests
```
