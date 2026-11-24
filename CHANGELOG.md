# Changelog

## 1.1.0 (2026-11-24)

- `SuperModal.bind(selectors, options)`: opens the modal for elements you can't add markup to, such as the images of a
  CMS post. One selector or an array of them; all matches form one gallery, in page order, images added later included.
  An image linked to an image file opens that file; one linked to a page keeps its link. Captions come from
  `<figcaption>` (or `data-caption`), lazy loaders' `data-src`/`data-srcset` are understood, and bare images become
  keyboard-accessible. Returns a function that unbinds.
- Items take an `alt` text for the full-screen image (the image's own `alt` for bound images).

## 1.0.0 (2026-11-18)

First release. SuperModal.js started as the image modal of Simple Image Gallery Pro (a Joomla extension by JoomlaWorks)
and is now a project of its own.

- Galleries from plain links (`data-supermodal`, as a group name or JSON), single images, data-only items
  (`data-supermodal-item`), per-gallery options in the markup
- Attribute markup: `data-title`, `data-caption` (the link's `title` as a fallback), `data-srcset`, `data-thumb`,
  `data-download`
- Zoom and pan (double click or tap, pinch, Ctrl + wheel, Z), swipe navigation, swipe down to close
- Thumbnail strip, grid view (G), slideshow with progress (Space), fullscreen, download button
- Responsive images through `srcset`; neighbouring images preloaded
- `<dialog>` based: focus returns to the trigger, the Back button closes, scroll lock without layout shift, reduced
  motion, light and dark themes, CSS variables for styling
- Caption HTML cleaned against an allowlist
- JavaScript API (`open`, `close`, `next`, `prev`, `goTo`, `isOpen`, `frame`, `setDefaults`), `window.SuperModalDefaults`,
  events `supermodal:open|change|close`
- Frame mode: a page in an iframe with the modal's look
- Compat mode (`compat: true`, off by default): opens links written for FancyBox, Lightbox2, Fresco, Strip, Lightview,
  Nivo, prettyPhoto, Colorbox, Swipebox, Highslide and Magnific Popup
