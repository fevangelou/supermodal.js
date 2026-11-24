# SuperModal.js

A dependency-free image modal (lightbox) for the web: galleries, zoom, swipe, a slideshow and a grid view for the
images on your page. 10 KB of JavaScript and 2.4 KB of CSS, gzipped. MIT licensed.

**Demo and documentation: https://fevangelou.github.io/supermodal.js/**

- Galleries from plain links, with a thumbnail strip and a grid view
- Galleries from images you can't add markup to (a CMS post's, say), with one line of JavaScript
- Zoom and pan with a mouse, the keyboard or a finger (double tap, pinch)
- Swipe between images, swipe down to close
- Slideshow, fullscreen and download buttons
- Responsive images through `srcset`
- A real `<dialog>`: the Back button closes it, focus returns to the link, keyboard control, reduced motion
- Captions with HTML, cleaned against an allowlist
- A small JavaScript API, events, and CSS variables for styling
- Optional drop-in replacement for FancyBox, Lightbox2, prettyPhoto, Colorbox and other lightboxes

It started as the image modal of Simple Image Gallery Pro,
a Joomla extension by [JoomlaWorks](https://www.joomlaworks.net).

## Install

Load the two files. Every release stays at its own address; `dist/latest/` always has the newest one.

```html
<link rel="stylesheet" href="https://fevangelou.github.io/supermodal.js/dist/1.1.0/supermodal.min.css">
<script src="https://fevangelou.github.io/supermodal.js/dist/1.1.0/supermodal.min.js" defer></script>
```

Or copy `supermodal.min.js` and `supermodal.min.css` from [`dist/`](dist/) to your site. The readable sources are in
[`src/`](src/).

## Use

Add `data-supermodal` to the links of your images. Links with the same name form a gallery:

```html
<a href="photos/beach.jpg" data-supermodal="holiday" data-title="The beach" data-caption="Day one, <b>early</b> morning">
  <img src="photos/beach-small.jpg" alt="The beach">
</a>
<a href="photos/harbour.jpg" data-supermodal="holiday">
  <img src="photos/harbour-small.jpg" alt="The harbour">
</a>
```

An empty `data-supermodal` opens a single image. Links added to the page later work too.

### Images without links

When you can't change the markup, as with the images of a WordPress post, point `SuperModal.bind()` at them. Everything it
matches becomes one gallery, in page order:

```html
<script>
document.addEventListener('DOMContentLoaded', () => {
  SuperModal.bind('body.single article .entry-content img');
  // or several selectors: SuperModal.bind(['.entry-content img', '.wp-block-gallery img'], { theme: 'light' });
});
</script>
```

An image in a link to an image file (WordPress's "Link to: Media file") opens that file. An image in a link to a page
keeps its link, and links with `data-supermodal` keep their own gallery. The caption comes from the image's
`<figcaption>` (or `data-caption`); `srcset` and lazy loaders' `data-src`/`data-srcset` are used. Images without a link
get keyboard access (Enter or Space), and images added later open too. `bind()` returns a function that unbinds.

### Loading the script later

When the script loads late (async, on scroll, or by a plugin that delays scripts), queue your code instead of waiting
for `DOMContentLoaded`. It runs as soon as SuperModal is there, or at once if it already is:

```html
<script>
(window.SuperModalReady = window.SuperModalReady || []).push(function (SM) {
  SM.bind('body.single article .entry-content img');
});
</script>
```

SuperModal also fires `supermodal:ready` on `document` when it has loaded.

### Markup

| Attribute | What it does |
|---|---|
| `data-supermodal` | A group name, empty for a single image, or JSON with any of `group`, `title`, `caption`, `srcset`, `thumb`, `download`, `html` and the gallery options `theme`, `thumbs`, `loop`, `autostart`, `interval` (the first link of a gallery that sets an option wins) |
| `data-title` | Title above the caption |
| `data-caption` | Caption (HTML allowed, cleaned); the link's `title` is used when it's missing |
| `data-srcset` | `srcset` for the full-screen image |
| `data-thumb` | Image for the thumbnail strip and grid view (default: the link's `<img>`, else the image) |
| `data-download` | Shows a download button for this file |
| `data-supermodal-item` | On any element: JSON with `src` and `group`, an image of a gallery that has no link on the page |
| `<template class="supermodal-html" data-supermodal-for="holiday">` | HTML shown under every image of a gallery (scripts removed) |
| `data-supermodal-gallery` | Compat mode: groups class-only links (`.swipebox`...) per container instead of per page |

### Options

Set them with `SuperModal.setDefaults({...})`, or before the script loads:

```html
<script>window.SuperModalDefaults = { theme: 'light', interval: 4 };</script>
```

| Option | Default | |
|---|---|---|
| `theme` | `'dark'` | `'dark'` or `'light'` |
| `thumbs` | `true` | Thumbnail strip under the image |
| `loop` | `true` | From the last image back to the first |
| `autostart` | `false` | Start the slideshow on open |
| `interval` | `5` | Seconds per image in the slideshow |
| `compat` | `false` | Also open links written for other lightboxes (`data-fancybox`, `data-lightbox`, `rel="prettyPhoto[…]"`, `rel="lightbox[…]"`, Fresco, Strip, Lightview, Nivo, Colorbox, Swipebox, Highslide, Magnific Popup); only links to image files |
| `strings` | English | `close`, `prev`, `next`, `play`, `pause`, `zoom`, `grid`, `download`, `fullscreen`, `more`, `counter` (`'Image {i} of {n}'`), `loading`, `error` |

### JavaScript

```js
SuperModal.open(items, index, options); // items: a selector, a list of links, or [{ src, srcset, thumb, title, caption, alt, download, html }]
SuperModal.bind(selectors, options);    // see "Images without links"; returns unbind()
SuperModal.close();
SuperModal.next(); SuperModal.prev(); SuperModal.goTo(2);
SuperModal.isOpen();
SuperModal.frame('picker.html', { title: 'Choose an image' }); // a page in an iframe; inside it: parent.SuperModal.close()
SuperModal.setDefaults({ theme: 'light' });

document.addEventListener('supermodal:change', (e) => console.log(e.detail.index, e.detail.item));
// also supermodal:open, supermodal:close, and supermodal:ready once the script has loaded
```

### Styling

Override the `--sm-*` variables on `.supermodal` (or `.supermodal--light` for the light theme), e.g.
`.supermodal {--sm-accent:#0a7cff;}`. The full list is at the top of [`src/supermodal.css`](src/supermodal.css).

Images enhanced by `SuperModal.bind()` carry a `data-supermodal-bound` attribute (and a zoom-in cursor), so you can
style just those, e.g. `.entry-content img[data-supermodal-bound]:hover {opacity:.9;}`. `unbind()` removes it; images
added later get it when you call `bind()` again. Style by its presence, not its value.

### Keyboard and gestures

Arrows or swipe: previous/next. Home/End: first/last. Space: slideshow. Z, double click/tap, pinch, Ctrl + wheel: zoom
(drag to pan). G: grid view. Esc: leaves the zoom or grid view, then closes. Swipe down or the Back button: close.

## Browser support

The current versions of Chrome, Edge, Firefox and Safari, on desktops and phones.

## Development

```sh
npm install
npm run build   # minifies src/ into dist/ and publishes docs/dist/<version>/ and docs/dist/latest/ (size budget enforced)
```

## Credits

Icons: [Bootstrap Icons](https://icons.getbootstrap.com/) (MIT). Demo photos: CC0, from the sample data of Joomla 3.x UTD
(see [`docs/images/CREDITS.md`](docs/images/CREDITS.md)).

## License

[MIT](LICENSE), © 2026 JoomlaWorks Ltd.
