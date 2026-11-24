/*!
 * SuperModal.js v1.1.0 - a dependency-free image modal (lightbox)
 * https://github.com/fevangelou/supermodal.js
 * Copyright (c) 2026 JoomlaWorks Ltd. Released under the MIT License.
 * Icons: Bootstrap Icons (https://icons.getbootstrap.com/), MIT License.
 */
(function (window, document) {
    'use strict';

    if (window.SuperModal && window.SuperModal.open) {
        return; // loaded twice
    }

    /* ------------------------------------------------------------------ *
     * Data layer: parsing link markup into gallery items
     * ------------------------------------------------------------------ */

    var IMAGE_RE = /\.(jpe?g|png|gif|webp|avif)$/i;
    var GALLERY_OPTIONS = ['autostart', 'interval', 'loop', 'thumbs', 'theme'];
    // compat: true - other lightboxes' triggers: [selector, attribute holding the group (or null)]
    var COMPAT = [
        ['[data-fancybox]', 'data-fancybox'],
        ['[data-lightbox]', 'data-lightbox'],
        ['[data-fresco-group],.fresco', 'data-fresco-group'],
        ['[data-strip-group],.strip', 'data-strip-group'],
        ['[data-lightview-group],.lightview', 'data-lightview-group'],
        ['[data-lightbox-gallery]', 'data-lightbox-gallery']
    ];
    var COMPAT_REL = /^(prettyPhoto|lightbox|colorbox|swipebox|highslide|magnificpopup|nivoLightbox)/;
    var COMPAT_CLASSES = ['swipebox', 'highslide', 'magnificpopup', 'fancybox-gallery', 'colorbox'];
    var OWN_CAPTION_ATTRS = ['data-caption', 'title'];
    var COMPAT_CAPTION_ATTRS = ['data-caption', 'title', 'data-title', 'data-fresco-caption', 'data-strip-caption', 'data-lightview-caption'];
    var ALLOWED_TAGS = /^(B|STRONG|I|EM|U|S|SMALL|BR|P|SPAN|A|UL|OL|LI)$/;
    var DROPPED_TAGS = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH|NOSCRIPT|TEXTAREA|SELECT)$/;
    var ALLOWED_ATTRS = /^(href|target|rel|download|class|title)$/;

    function parseData(value) {
        if (!value) {
            return {};
        }
        if (value.charAt(0) === '{') {
            try {
                var data = JSON.parse(value);
                return data && typeof data === 'object' ? data : {};
            } catch (e) {
                return {};
            }
        }
        return { g: value };
    }

    function isImageUrl(url) {
        if (!url) {
            return false;
        }
        try {
            return IMAGE_RE.test(new URL(url, document.baseURI).pathname);
        } catch (e) {
            return false;
        }
    }

    // Returns the URL unchanged when it is http(s) or relative, '' otherwise
    function safeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        try {
            return /^https?:$/.test(new URL(url, document.baseURI).protocol) ? url : '';
        } catch (e) {
            return '';
        }
    }

    function absUrl(url) {
        return safeUrl(url) ? new URL(url, document.baseURI).href : '';
    }

    // Allowlist sanitizer for HTML coming from attributes (never trusted)
    function sanitizeHtml(html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = String(html || '');
        cleanNode(tpl.content);
        return tpl.content;
    }

    function cleanNode(parent) {
        var nodes = Array.prototype.slice.call(parent.childNodes);
        nodes.forEach(function (node) {
            if (node.nodeType === 3) {
                return;
            }
            if (node.nodeType !== 1) {
                node.remove();
                return;
            }
            var tag = node.tagName.toUpperCase();
            if (DROPPED_TAGS.test(tag)) {
                node.remove();
                return;
            }
            cleanNode(node);
            if (!ALLOWED_TAGS.test(tag)) {
                node.replaceWith.apply(node, Array.prototype.slice.call(node.childNodes));
                return;
            }
            Array.prototype.slice.call(node.attributes).forEach(function (attr) {
                var name = attr.name.toLowerCase();
                if (!ALLOWED_ATTRS.test(name) || (name === 'href' && !safeUrl(attr.value))) {
                    node.removeAttribute(attr.name);
                }
            });
            if (node.tagName === 'A' && node.hasAttribute('target')) {
                node.setAttribute('rel', 'noopener noreferrer'); // no access to this window from the new tab
            }
        });
    }

    function linkOf(el) {
        return el && el.closest ? el.closest('a') : null;
    }

    function ownData(a) {
        return parseData(a.getAttribute('data-supermodal') || a.getAttribute('data-supermodal-item'));
    }

    function groupOf(data) {
        var g = data.group !== undefined ? data.group : data.g;
        return g === undefined || g === null || g === '' ? null : String(g);
    }

    function triggerInfo(el) {
        var a = linkOf(el);
        if (!a) {
            return null;
        }
        if (a.hasAttribute('data-supermodal')) {
            return { group: groupOf(ownData(a)), kind: 'own' };
        }
        if (!defaults.compat || !isImageUrl(a.getAttribute('href'))) {
            return null;
        }
        for (var i = 0; i < COMPAT.length; i++) {
            if (a.matches(COMPAT[i][0])) {
                return { group: a.getAttribute(COMPAT[i][1]) || null, kind: 'compat' };
            }
        }
        var rel = a.getAttribute('rel') || '';
        if (COMPAT_REL.test(rel)) {
            return { group: rel, kind: 'compat' };
        }
        for (var j = 0; j < COMPAT_CLASSES.length; j++) {
            if (a.classList.contains(COMPAT_CLASSES[j])) {
                // One gallery per class and [data-supermodal-gallery] container, else per class for the whole page
                var box = a.closest('[data-supermodal-gallery]');
                var index = box ? Array.prototype.indexOf.call(document.querySelectorAll('[data-supermodal-gallery]'), box) : -1;
                return { group: 'compat:' + COMPAT_CLASSES[j] + ':' + index, kind: 'compat' };
            }
        }
        return null;
    }

    function thumbOf(a, data, src) {
        if (data.thumb && safeUrl(data.thumb)) {
            return absUrl(data.thumb);
        }
        if (a.getAttribute('data-thumb') && safeUrl(a.getAttribute('data-thumb'))) {
            return absUrl(a.getAttribute('data-thumb'));
        }
        var img = a.querySelector('img');
        if (img) {
            var s = img.getAttribute('src') || '';
            if (s && !/transparent\.gif$/.test(s) && safeUrl(s)) {
                return absUrl(s);
            }
            var bg = /url\(["']?([^"')]+)["']?\)/.exec(img.style.backgroundImage || '');
            if (bg && safeUrl(bg[1])) {
                return absUrl(bg[1]);
            }
        }
        return src;
    }

    function itemFromElement(a) {
        var data = ownData(a);
        var own = a.hasAttribute('data-supermodal') || a.hasAttribute('data-supermodal-item');
        var attr = function (name) {
            return a.getAttribute(name) || '';
        };
        var src = absUrl(attr('href') || data.src);
        var caption = typeof data.caption === 'string' ? data.caption : '';
        var attrs = own ? OWN_CAPTION_ATTRS : COMPAT_CAPTION_ATTRS;
        for (var i = 0; i < attrs.length && !caption; i++) {
            caption = attr(attrs[i]);
        }
        var title = typeof data.title === 'string' ? data.title : attr(own ? 'data-title' : 'data-lightview-title');
        return {
            src: src,
            srcset: typeof data.srcset === 'string' ? data.srcset : attr('data-srcset'),
            thumb: thumbOf(a, data, src),
            title: title,
            caption: caption,
            download: absUrl(typeof data.download === 'string' ? data.download : attr('data-download')),
            html: typeof data.html === 'string' ? data.html : '',
            el: a,
            data: data
        };
    }

    function collectGroup(el) {
        var a = linkOf(el);
        var info = triggerInfo(a);
        var members = [a];
        if (info && info.group) {
            members = Array.prototype.filter.call(document.querySelectorAll('a[href]'), function (link) {
                var t = triggerInfo(link);
                return t && t.group === info.group;
            });
            // Data-only items ([data-supermodal-item], e.g. images without a visible link) come first
            var dataItems = Array.prototype.filter.call(document.querySelectorAll('[data-supermodal-item]'), function (node) {
                return groupOf(ownData(node)) === info.group;
            });
            if (dataItems.length) {
                members = dataItems.concat(members);
            }
        }
        var items = [];
        var seen = {};
        var options = {};
        members.forEach(function (link) {
            var item = itemFromElement(link);
            if (!item.src || seen[item.src]) {
                return;
            }
            seen[item.src] = true;
            items.push(item);
            GALLERY_OPTIONS.forEach(function (key) {
                if (!(key in options) && item.data[key] !== undefined && item.data[key] !== '') {
                    options[key] = item.data[key];
                }
            });
        });
        var current = absUrl(a.getAttribute('href'));
        var index = 0;
        items.forEach(function (item, i) {
            if (item.src === current && !index) {
                index = i;
            }
        });
        items.forEach(function (item) {
            delete item.data;
        });
        return { items: items, index: index, options: options };
    }

    // SuperModal.bind(): images the page author can't add markup to (e.g. a CMS's post content)
    var BINDINGS = []; // { sel, options }

    // Lazy loaders keep the real address in data-src / data-lazy-src (and -srcset) until the image is in view
    function imgAttr(img, name) {
        var v = img.getAttribute(name) || '';
        if (!v || /^data:|transparent\.gif$/.test(v)) {
            v = img.getAttribute('data-' + name) || img.getAttribute('data-lazy-' + name) || '';
        }
        return v;
    }

    // The item a bound element opens, or null when it shouldn't open one: a link to a page stays a link, and links
    // SuperModal opens anyway (data-supermodal, compat) keep their own gallery. A link to an image file opens that file.
    function boundItem(el) {
        var isImg = el.tagName === 'IMG';
        var img = isImg ? el : el.querySelector('img');
        var a = el.closest('a[href]') || (isImg ? null : el.querySelector('a[href]'));
        if (!img && !a) {
            return null;
        }
        if (a && (triggerInfo(a) || !isImageUrl(a.getAttribute('href')))) {
            return null;
        }
        var thumb = img ? absUrl(imgAttr(img, 'src')) : '';
        var src = a ? absUrl(a.getAttribute('href')) : thumb;
        if (!src) {
            return null;
        }
        var attr = function (name) {
            return el.getAttribute(name) || (img && img.getAttribute(name)) || (a && a.getAttribute(name)) || '';
        };
        var fig = (img || el).closest('figure');
        var cap = fig && fig.querySelector(':scope > figcaption');
        return {
            src: src,
            srcset: attr('data-srcset') || (a || !img ? '' : imgAttr(img, 'srcset')),
            thumb: thumb || src,
            title: attr('data-title'),
            caption: attr('data-caption') || (cap ? cap.innerHTML : ''),
            alt: img ? img.alt : '',
            download: absUrl(attr('data-download')),
            html: '',
            el: a || el
        };
    }

    // The binding and element a click or key on `target` belongs to
    function boundHit(target) {
        for (var i = 0; i < BINDINGS.length; i++) {
            var el = target.closest(BINDINGS[i].sel);
            if (el && boundItem(el)) {
                return { b: BINDINGS[i], el: el };
            }
        }
        return null;
    }

    // Every element the binding matches now (images added later included), in page order, as one gallery
    function openBound(hit) {
        var current = boundItem(hit.el).src;
        var items = [];
        var seen = {};
        var index = 0;
        Array.prototype.forEach.call(document.querySelectorAll(hit.b.sel), function (el) {
            var item = boundItem(el);
            if (!item || seen[item.src]) {
                return;
            }
            seen[item.src] = true;
            if (item.src === current) {
                index = items.length;
            }
            items.push(item);
        });
        var options = {};
        Object.keys(hit.b.options).forEach(function (k) {
            options[k] = hit.b.options[k];
        });
        options.trigger = hit.el;
        open(items, index, options);
    }

    // Cursor for all bound elements; bare ones (no link) are also made reachable by keyboard
    function mark(b) {
        Array.prototype.forEach.call(document.querySelectorAll(b.sel), function (el) {
            var item = boundItem(el);
            if (!item || el.hasAttribute('data-supermodal-bound')) {
                return;
            }
            var kb = item.el === el && el.tagName !== 'A' && !el.hasAttribute('tabindex');
            el.setAttribute('data-supermodal-bound', kb ? 'kb' : '');
            if (kb) {
                el.tabIndex = 0;
                el.setAttribute('role', 'button');
            }
        });
    }

    function unmarkAll() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-supermodal-bound]'), function (el) {
            if (el.getAttribute('data-supermodal-bound') === 'kb') {
                el.removeAttribute('tabindex');
                el.removeAttribute('role');
            }
            el.removeAttribute('data-supermodal-bound');
        });
    }

    /* ------------------------------------------------------------------ *
     * UI
     * ------------------------------------------------------------------ */

    var ICONS = {
        close: 'M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z',
        prev: '!M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0',
        next: '!M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708',
        play: 'm11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393',
        pause: 'M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5',
        zoom: '!M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0|M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z|!M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5',
        zoomOut: '!M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0|M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z|!M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5',
        grid: 'M4 2v2H2V2zm1 12v-2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1m0-5V7a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1m0-5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1m5 10v-2a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1m0-5V7a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1m0-5V2a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1M9 2v2H7V2zm5 0v2h-2V2zM4 7v2H2V7zm5 0v2H7V7zm5 0h-2v2h2zM4 12v2H2v-2zm5 0v2H7v-2zm5 0v2h-2v-2zM12 1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm-1 6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zm1 4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z',
        download: 'M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5|M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z',
        fullscreen: 'M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5',
        fullscreenExit: 'M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5m5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5M0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5m10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0z',
        more: 'M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3'
    };

    var ui = null;
    var state = { items: [], index: 0, opts: null, group: null, trigger: null, token: 0, open: false };
    var savedScroll = null;

    function icon(name) {
        return '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true">' +
            ICONS[name].split('|').map(function (d) {
                return d.charAt(0) === '!' ? '<path fill-rule="evenodd" d="' + d.slice(1) + '"/>' : '<path d="' + d + '"/>';
            }).join('') + '</svg>';
    }

    function $(selector) {
        return ui.dialog.querySelector(selector);
    }

    function button(action, iconName, extraClass) {
        var tag = action === 'download' ? 'a' : 'button';
        var b = document.createElement(tag);
        b.className = 'supermodal__btn' + (extraClass ? ' ' + extraClass : '');
        b.setAttribute('data-action', action);
        if (tag === 'button') {
            b.type = 'button';
        } else {
            b.setAttribute('download', '');
        }
        b.innerHTML = icon(iconName || action);
        return b;
    }

    function build() {
        var d = document.createElement('dialog');
        d.className = 'supermodal';
        d.tabIndex = -1;
        d.innerHTML =
            '<div class="supermodal__progress"></div>' +
            '<div class="supermodal__bar"><span class="supermodal__counter" aria-live="polite"></span><div class="supermodal__tools"></div></div>' +
            '<div class="supermodal__stage"><img class="supermodal__img" alt="" draggable="false">' +
            '<div class="supermodal__spinner" aria-hidden="true"></div><div class="supermodal__error" role="alert"></div></div>' +
            '<div class="supermodal__caption"><div class="supermodal__title"></div><div class="supermodal__desc"></div><div class="supermodal__html"></div></div>' +
            '<div class="supermodal__thumbs"></div><div class="supermodal__grid"></div>';
        ui = { dialog: d };
        var tools = d.querySelector('.supermodal__tools');
        TOOLS.forEach(function (action) {
            var b = button(action);
            var extra = EXTRA_TOOLS.indexOf(action);
            if (extra > -1) {
                b.classList.add('supermodal__btn--extra');
                b.style.setProperty('--sm-i', extra);
            }
            tools.appendChild(b);
        });
        var stage = d.querySelector('.supermodal__stage');
        stage.appendChild(button('prev', 'prev', 'supermodal__nav supermodal__nav--prev'));
        stage.appendChild(button('next', 'next', 'supermodal__nav supermodal__nav--next'));
        ui.stage = stage;
        ui.img = d.querySelector('.supermodal__img');
        ui.thumbs = d.querySelector('.supermodal__thumbs');
        ui.grid = d.querySelector('.supermodal__grid');
        BUILDERS.forEach(function (fn) {
            fn(d);
        });
        d.addEventListener('click', onDialogClick);
        d.addEventListener('keydown', onKey);
        d.addEventListener('cancel', function (e) {
            e.preventDefault();
            escape();
        });
        // Browsers may close a modal dialog themselves (e.g. a second Esc without user activation can't be
        // cancelled): run the normal cleanup then (scroll lock, history, slideshow, fullscreen)
        d.addEventListener('close', function () {
            // (the event is async: ignore it when the modal was reopened in the meantime)
            if (state.open && !d.open) {
                close();
            }
        });
        document.body.appendChild(d);
    }

    // Later sections register extra toolbar buttons / build steps / handlers here
    var TOOLS = ['play', 'zoom', 'grid', 'download', 'fullscreen', 'more', 'close'];
    var EXTRA_TOOLS = ['play', 'download', 'fullscreen']; // behind the "more" button on phones
    var BUILDERS = [];
    var ACTIONS = {
        close: function () {
            close();
        },
        prev: function () {
            prev();
        },
        next: function () {
            next();
        }
    };
    var KEYS = {
        ArrowLeft: function () {
            prev();
        },
        ArrowRight: function () {
            next();
        },
        Home: function () {
            goTo(0);
        },
        End: function () {
            goTo(state.items.length - 1);
        }
    };
    var ESCAPES = []; // functions returning true when they handled Esc (leave zoom, grid...)
    var RENDERERS = []; // called after every render(index)

    function onDialogClick(e) {
        var b = e.target.closest('[data-action]');
        if (b && ACTIONS[b.getAttribute('data-action')] && !b.disabled) {
            if (b.tagName !== 'A') {
                e.preventDefault();
            }
            ACTIONS[b.getAttribute('data-action')](e);
            return;
        }
        if (e.target === ui.stage && !ui.dialog.classList.contains('is-zoomed')) {
            close();
        }
    }

    function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || !KEYS[e.key]) {
            return;
        }
        e.preventDefault();
        KEYS[e.key](e);
    }

    function escape() {
        for (var i = 0; i < ESCAPES.length; i++) {
            if (ESCAPES[i]()) {
                return;
            }
        }
        close();
    }

    function emit(name, detail) {
        document.dispatchEvent(new CustomEvent('supermodal:' + name, { detail: detail }));
    }

    function label(el, text) {
        if (el) {
            el.setAttribute('aria-label', text);
            el.setAttribute('title', text);
        }
    }

    function applyLabels() {
        var s = state.opts.strings;
        Array.prototype.forEach.call(ui.dialog.querySelectorAll('[data-action]'), function (b) {
            var key = b.getAttribute('data-action');
            if (s[key]) {
                label(b, s[key]);
            }
        });
    }

    function lockScroll() {
        var root = document.documentElement;
        var gap = window.innerWidth - root.clientWidth;
        savedScroll = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter, padding: document.body.style.paddingRight };
        root.style.overflow = 'hidden';
        // A reserved scrollbar gutter (scrollbar-gutter: stable, e.g. set by templates) would stay empty at the
        // window's edge, outside the modal; the body padding below keeps the page from shifting instead
        root.style.scrollbarGutter = 'auto';
        if (gap > 0) {
            document.body.style.paddingRight = gap + 'px';
        }
    }

    // Pages wider than a phone screen widen the layout viewport past the visible area:
    // keep the dialog on the visual viewport so nothing ends up off-screen
    function fitViewport() {
        var v = window.visualViewport;
        if (!ui || !v) {
            return;
        }
        var st = ui.dialog.style;
        if (state.open && (v.width < window.innerWidth - 1 || v.height < window.innerHeight - 1)) {
            st.left = v.offsetLeft + 'px';
            st.top = v.offsetTop + 'px';
            st.width = v.width + 'px';
            st.height = v.height + 'px';
        } else {
            st.left = st.top = st.width = st.height = '';
        }
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', fitViewport);
        window.visualViewport.addEventListener('scroll', fitViewport);
    }

    function unlockScroll() {
        if (savedScroll) {
            document.documentElement.style.overflow = savedScroll.overflow;
            document.documentElement.style.scrollbarGutter = savedScroll.gutter;
            document.body.style.paddingRight = savedScroll.padding;
            savedScroll = null;
        }
    }

    function toItem(entry) {
        if (entry && entry.nodeType === 1) {
            return itemFromElement(linkOf(entry) || entry);
        }
        if (entry && typeof entry === 'object' && absUrl(entry.src)) {
            var src = absUrl(entry.src);
            return {
                src: src,
                srcset: typeof entry.srcset === 'string' ? entry.srcset : '',
                thumb: absUrl(entry.thumb) || src,
                title: String(entry.title || ''),
                caption: String(entry.caption || ''),
                alt: String(entry.alt || ''),
                download: absUrl(entry.download),
                html: String(entry.html || ''),
                el: null
            };
        }
        return null;
    }

    function normalize(items) {
        if (typeof items === 'string') {
            try {
                items = document.querySelectorAll(items);
            } catch (e) {
                return [];
            }
        }
        if (!items || typeof items.length !== 'number') {
            return [];
        }
        var list = [];
        Array.prototype.forEach.call(items, function (entry) {
            var item = toItem(entry);
            if (item && item.src) {
                delete item.data;
                list.push(item);
            }
        });
        return list;
    }

    function merge(options) {
        var o = {};
        Object.keys(defaults).forEach(function (k) {
            o[k] = defaults[k];
        });
        o.strings = {};
        Object.keys(defaults.strings).forEach(function (k) {
            o.strings[k] = defaults.strings[k];
        });
        Object.keys(options || {}).forEach(function (k) {
            if (k === 'strings') {
                Object.keys(options.strings || {}).forEach(function (s) {
                    if (typeof options.strings[s] === 'string') {
                        o.strings[s] = options.strings[s];
                    }
                });
            } else if (options[k] !== undefined) {
                o[k] = options[k];
            }
        });
        return o;
    }

    function open(items, startIndex, options) {
        var list = normalize(items);
        if (!list.length) {
            return false;
        }
        if (!ui) {
            build();
        }
        options = options || {};
        state.items = list;
        state.opts = merge(options);
        state.group = options.group || null;
        state.trigger = options.trigger || document.activeElement;
        var d = ui.dialog;
        d.className = 'supermodal supermodal--' + (state.opts.theme === 'light' ? 'light' : 'dark') +
            (list.length < 2 ? ' is-single' : '') + (state.opts.thumbs ? '' : ' no-thumbs');
        ui.thumbs.replaceChildren.apply(ui.thumbs, list.map(function (item, i) {
            return tile('thumb', item, i);
        }));
        ui.grid.replaceChildren();
        applyLabels();
        d.querySelector('[data-action="play"]').hidden = list.length < 2;
        if (pendingClose) {
            pendingClose(); // finish a close that is still animating
        }
        var wasOpen = state.open;
        // The dialog (and its <img>) is reused: never show the previous gallery's image while the new one loads
        ui.img.removeAttribute('src');
        ui.img.alt = '';
        if (!wasOpen) {
            if (!savedScroll) {
                lockScroll();
            }
            d.showModal();
            d.classList.add('is-open');
            state.open = true;
            fitViewport();
            try {
                history.pushState({ supermodal: true }, '');
            } catch (e) {
                // sandboxed iframes etc.
            }
        }
        render(Number(startIndex) || 0, true);
        setPlaying(!wasOpen ? !!state.opts.autostart : playing());
        return true;
    }

    function wrap(i) {
        var n = state.items.length;
        i = Math.floor(Number(i));
        if (!isFinite(i)) {
            i = 0;
        }
        return state.opts.loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    }

    function render(i, opening) {
        i = wrap(i);
        if (!opening && i === state.index) {
            return;
        }
        var dir = i > state.index ? 1 : -1;
        state.index = i;
        var item = state.items[i];
        var n = state.items.length;
        var s = state.opts.strings;
        var d = ui.dialog;

        $('.supermodal__counter').textContent = s.counter.replace('{i}', i + 1).replace('{n}', n);
        $('.supermodal__title').textContent = item.title;
        $('.supermodal__desc').replaceChildren(sanitizeHtml(item.caption));
        var html = $('.supermodal__html');
        html.replaceChildren(sanitizeHtml(item.html));
        var tpl = state.group && document.querySelector('template.supermodal-html[data-supermodal-for="' + CSS.escape(state.group) + '"]');
        if (tpl) {
            var banner = tpl.content.cloneNode(true);
            Array.prototype.forEach.call(banner.querySelectorAll('script'), function (sc) {
                sc.remove();
            });
            html.appendChild(banner);
        }
        d.classList.toggle('no-caption', !item.title && !item.caption && !html.childNodes.length);

        var dl = $('[data-action="download"]');
        dl.hidden = !item.download;
        dl.setAttribute('href', item.download || '#');
        var crossOrigin = !!item.download && new URL(item.download).origin !== location.origin;
        if (crossOrigin) {
            dl.target = '_blank'; // the download attribute is ignored cross-origin: don't navigate away
            dl.rel = 'noopener';
        } else {
            dl.removeAttribute('target');
            dl.removeAttribute('rel');
        }
        stackExtras();
        $('[data-action="prev"]').disabled = !state.opts.loop && i === 0;
        $('[data-action="next"]').disabled = !state.opts.loop && i === n - 1;

        load(item, opening ? 0 : dir);
        [i - 1, i + 1].forEach(function (j) {
            if (n > 1) {
                setSource(new Image(), state.items[wrap(j)]);
            }
        });
        RENDERERS.forEach(function (fn) {
            fn(item, i);
        });
        emit(opening ? 'open' : 'change', { index: i, item: item, items: state.items });
    }

    // Responsive images: srcset lets the browser pick the copy for the screen; src is the fallback
    function setSource(img, item) {
        if (item.srcset) {
            img.sizes = '100vw';
            img.srcset = item.srcset;
        } else {
            img.removeAttribute('srcset');
            img.removeAttribute('sizes');
        }
        img.src = item.src;
    }

    function load(item, dir) {
        var d = ui.dialog;
        var token = ++state.token;
        var pre = new Image();
        d.classList.add('is-loading');
        d.classList.remove('is-error');
        pre.onload = function () {
            if (token !== state.token) {
                return;
            }
            var img = ui.img;
            setSource(img, item);
            img.alt = item.alt || item.title || '';
            d.classList.remove('is-loading');
            img.classList.remove('is-next', 'is-prev');
            if (dir) {
                void img.offsetWidth; // restart the CSS animation
                img.classList.add(dir > 0 ? 'is-next' : 'is-prev');
            }
        };
        pre.onerror = function () {
            if (token !== state.token) {
                return;
            }
            d.classList.remove('is-loading');
            d.classList.add('is-error');
            var err = $('.supermodal__error');
            err.textContent = state.opts.strings.error + ' ';
            var a = document.createElement('a');
            a.href = item.src;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = item.src.split('/').pop();
            err.appendChild(a);
        };
        setSource(pre, item);
    }

    // Phone "more" menu: stack the visible extra tools under the bar without gaps
    function stackExtras() {
        var n = 0;
        Array.prototype.forEach.call(ui.dialog.querySelectorAll('.supermodal__btn--extra'), function (b) {
            if (!b.hidden) {
                b.style.setProperty('--sm-i', n++);
            }
        });
    }

    function goTo(i) {
        if (state.open) {
            render(Number(i) || 0, false);
        }
    }

    function next() {
        goTo(state.index + 1);
    }

    function prev() {
        goTo(state.index - 1);
    }

    function close(fromHistory) {
        if (!state.open) {
            return;
        }
        state.open = false;
        state.token++;
        CLOSERS.forEach(function (fn) {
            fn();
        });
        var d = ui.dialog;
        var done = false;
        var finish = function (e) {
            if (done || (e && e.target !== d)) {
                return; // already done, or an animation of a child element
            }
            done = true;
            pendingClose = null;
            d.removeEventListener('animationend', finish);
            d.classList.remove('is-closing', 'is-open');
            d.close();
            fitViewport();
            unlockScroll();
            if (state.trigger && state.trigger.focus && document.contains(state.trigger)) {
                state.trigger.focus({ preventScroll: true });
            }
            emit('close', { index: state.index, item: state.items[state.index] });
        };
        pendingClose = finish;
        d.classList.add('is-closing');
        d.addEventListener('animationend', finish);
        setTimeout(finish, 400);
        if (!d.open) {
            finish(); // already closed by the browser: nothing to animate
        }
        if (!fromHistory && history.state && history.state.supermodal) {
            ignorePops++; // the popstate this causes is ours, not the visitor's Back button
            history.back();
        }
    }
    var pendingClose = null;
    var ignorePops = 0;
    var CLOSERS = []; // cleanup when the modal closes (slideshow, zoom...)

    window.addEventListener('popstate', function () {
        if (ignorePops > 0) {
            ignorePops--;
            return;
        }
        if (state.open) {
            close(true);
        }
    });

    // One delegated listener for the whole page: links added later (AJAX) just work.
    // On window, bubble phase: runs after other scripts' document-level handlers,
    // so a click another lightbox already claimed (defaultPrevented) is left alone.
    window.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
            return;
        }
        var info = triggerInfo(e.target);
        var a = linkOf(e.target);
        if (!info) {
            var hit = e.target.closest && !e.target.closest('.supermodal') && boundHit(e.target);
            if (hit) {
                e.preventDefault();
                openBound(hit);
            }
            return;
        }
        if (a.closest('.supermodal')) {
            return;
        }
        var g = collectGroup(a);
        if (!g.items.length) {
            return;
        }
        e.preventDefault();
        g.options.group = info.group;
        g.options.trigger = a;
        open(g.items, g.index, g.options);
    });

    // Enter or Space on a bare bound image (links get their click from the browser)
    window.addEventListener('keydown', function (e) {
        var t = e.target;
        if ((e.key === 'Enter' || e.key === ' ') && !e.defaultPrevented && t.getAttribute && t.getAttribute('data-supermodal-bound') === 'kb') {
            var hit = boundHit(t);
            if (hit) {
                e.preventDefault();
                openBound(hit);
            }
        }
    });

    /* ------------------------------------------------------------------ *
     * Thumbnail strip and grid view
     * ------------------------------------------------------------------ */

    var GRID = { gap: 8, minTile: 72, maxTile: 200, minCols: 1 };

    // Best column count for `count` square tiles in width x height: largest tile wins; ties go to
    // the fewest empty cells, then to the block whose shape is closest to the area's.
    // Below minTile the grid scrolls vertically.
    function fitGrid(count, width, height, o) {
        var best = null;
        var area = width / Math.max(1, height);
        for (var cols = Math.max(1, o.minCols); cols <= Math.max(count, o.minCols); cols++) {
            var rows = Math.ceil(count / cols);
            var tile = Math.floor(Math.min(o.maxTile, (width - o.gap * (cols - 1)) / cols, (height - o.gap * (rows - 1)) / rows));
            var empty = cols * rows - count;
            var shape = Math.abs(Math.log((cols * (tile + o.gap) - o.gap) / Math.max(1, rows * (tile + o.gap) - o.gap) / area));
            if (!best || tile > best.tile || (tile === best.tile && (empty < best.empty || (empty === best.empty && shape < best.shape)))) {
                best = { cols: cols, rows: rows, tile: tile, empty: empty, shape: shape };
            }
        }
        if (best.tile < o.minTile) {
            var c = Math.max(o.minCols, Math.floor((width + o.gap) / (o.minTile + o.gap)));
            return { cols: c, rows: Math.ceil(count / c), tile: Math.floor((width - o.gap * (c - 1)) / c), scroll: true };
        }
        return { cols: best.cols, rows: best.rows, tile: best.tile, scroll: false };
    }

    function tile(kind, item, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'supermodal__' + kind;
        b.setAttribute('data-action', kind);
        b.setAttribute('data-index', i);
        b.setAttribute('aria-label', item.title || state.opts.strings.counter.replace('{i}', i + 1).replace('{n}', state.items.length));
        var im = document.createElement('img');
        im.loading = 'lazy';
        im.alt = '';
        im.src = item.thumb;
        b.appendChild(im);
        return b;
    }

    function markCurrent(container) {
        Array.prototype.forEach.call(container.children, function (b, i) {
            if (i === state.index) {
                b.setAttribute('aria-current', 'true');
            } else {
                b.removeAttribute('aria-current');
            }
        });
    }

    function layoutGrid() {
        if (!ui || !ui.dialog.classList.contains('is-grid')) {
            return;
        }
        var g = ui.grid;
        var n = state.items.length;
        var phone = window.matchMedia('(max-width: 600px)').matches;
        var base = Math.max(16, Math.min(96, Math.min(window.innerWidth, window.innerHeight) * 0.08));
        var pad = Math.round(Math.max(16, base * (1 - Math.min(n, 60) / 60)));
        g.style.padding = pad + 'px';
        var fit = fitGrid(n, g.clientWidth - 2 * pad, g.clientHeight - 2 * pad, {
            gap: GRID.gap,
            minTile: GRID.minTile,
            maxTile: GRID.maxTile,
            minCols: phone ? 3 : 1
        });
        g.style.setProperty('--sm-grid-cols', fit.cols);
        g.style.setProperty('--sm-grid-tile', fit.tile + 'px');
        g.classList.toggle('is-scroll', fit.scroll);
        sharpenTiles(fit.tile * (window.devicePixelRatio || 1));
    }

    // Grid tiles can be bigger than the site's thumbnail files: when a thumbnail's shorter side (the tile is
    // square and filled) has clearly fewer pixels than the tile needs, show the full image instead
    function sharpenTiles(need) {
        Array.prototype.forEach.call(ui.grid.querySelectorAll('img'), function (im, i) {
            var item = state.items[i];
            var check = function () {
                if (item && im.naturalWidth && Math.min(im.naturalWidth, im.naturalHeight) * 1.1 < need && im.getAttribute('src') !== item.src) {
                    im.src = item.src;
                }
            };
            if (im.complete) {
                check();
            } else {
                im.addEventListener('load', check, { once: true });
            }
        });
    }

    function toggleGrid(force) {
        var d = ui.dialog;
        var on = typeof force === 'boolean' ? force : !d.classList.contains('is-grid');
        if (state.items.length < 2) {
            on = false;
        }
        if (on && !ui.grid.children.length) {
            ui.grid.replaceChildren.apply(ui.grid, state.items.map(function (item, i) {
                return tile('tile', item, i);
            }));
        }
        d.classList.toggle('is-grid', on);
        schedule();
        var b = d.querySelector('[data-action="grid"]');
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (!on && d.contains(document.activeElement) && document.activeElement.closest('.supermodal__grid')) {
            d.focus({ preventScroll: true }); // the focused tile is being hidden: keep the keys working
        }
        if (on) {
            markCurrent(ui.grid);
            layoutGrid();
            var cur = ui.grid.children[state.index];
            if (cur) {
                cur.scrollIntoView({ block: 'nearest' });
                cur.focus({ preventScroll: true });
            }
        }
        return on;
    }

    ACTIONS.grid = function () {
        toggleGrid();
    };
    ACTIONS.thumb = function (e) {
        goTo(Number(e.target.closest('[data-index]').getAttribute('data-index')));
    };
    ACTIONS.tile = function (e) {
        toggleGrid(false);
        goTo(Number(e.target.closest('[data-index]').getAttribute('data-index')));
    };
    KEYS.g = KEYS.G = function () {
        toggleGrid();
    };
    ESCAPES.push(function () {
        return ui.dialog.classList.contains('is-grid') && !toggleGrid(false);
    });
    RENDERERS.push(function () {
        markCurrent(ui.thumbs);
        var cur = ui.thumbs.children[state.index];
        if (cur && state.opts.thumbs) {
            cur.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
    });
    CLOSERS.push(function () {
        toggleGrid(false); // also resets the grid button
    });
    BUILDERS.push(function (d) {
        if (window.ResizeObserver) {
            new ResizeObserver(layoutGrid).observe(d);
        }
    });

    /* ------------------------------------------------------------------ *
     * Zoom and touch gestures (Pointer Events)
     * ------------------------------------------------------------------ */

    var ZOOM = 2.5;
    var MAX_ZOOM = 4;
    var view = { s: 1, x: 0, y: 0 };
    var pointers = {};
    var gesture = null;
    var lastTap = { t: 0, x: 0, y: 0 };
    var suppressClick = false;
    var lastTouch = 0;

    function applyView(animate) {
        var img = ui.img;
        img.style.transition = animate ? '' : 'none';
        img.style.transform = view.s === 1 && !view.x && !view.y ? '' : 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.s + ')';
        ui.dialog.classList.toggle('is-zoomed', view.s > 1.01);
        var b = ui.dialog.querySelector('[data-action="zoom"]');
        b.classList.toggle('is-active', view.s > 1.01);
        b.innerHTML = icon(view.s > 1.01 ? 'zoomOut' : 'zoom');
    }

    // Keep the scaled image covering the stage where it is larger than it
    function clampView() {
        var mx = Math.max(0, (ui.img.offsetWidth * view.s - ui.stage.clientWidth) / 2);
        var my = Math.max(0, (ui.img.offsetHeight * view.s - ui.stage.clientHeight) / 2);
        view.x = Math.max(-mx, Math.min(mx, view.x));
        view.y = Math.max(-my, Math.min(my, view.y));
    }

    // Zoom to `scale`, keeping the viewport point (px, py) where it is
    function zoomTo(scale, px, py, animate) {
        var r = ui.stage.getBoundingClientRect();
        var cx = (px === undefined ? r.left + r.width / 2 : px) - (r.left + r.width / 2);
        var cy = (py === undefined ? r.top + r.height / 2 : py) - (r.top + r.height / 2);
        scale = Math.max(1, Math.min(MAX_ZOOM, scale));
        view.x = cx - (cx - view.x) * scale / view.s;
        view.y = cy - (cy - view.y) * scale / view.s;
        view.s = scale;
        if (scale === 1) {
            view.x = view.y = 0;
        }
        clampView();
        applyView(animate);
        schedule();
    }

    function toggleZoom(px, py) {
        zoomTo(view.s > 1.01 ? 1 : ZOOM, px, py, true);
    }

    function resetZoom() {
        view = { s: 1, x: 0, y: 0 };
        if (ui) {
            applyView(false);
        }
    }

    function points() {
        return Object.keys(pointers).map(function (id) {
            return pointers[id];
        });
    }

    function onPointerDown(e) {
        if (e.target.closest('[data-action]') || ui.dialog.classList.contains('is-grid')) {
            return;
        }
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (e.pointerType !== 'mouse') {
            lastTouch = Date.now();
        }
        var p = points();
        if (p.length === 2) {
            gesture = { type: 'pinch', d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: view.s };
        } else if (p.length === 1) {
            gesture = { type: 'pending', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, t: Date.now(), touch: e.pointerType !== 'mouse' };
        }
    }

    function onPointerMove(e) {
        if (!pointers[e.pointerId] || !gesture) {
            return;
        }
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var p = points();
        if (gesture.type === 'pinch' && p.length === 2) {
            var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
            zoomTo(gesture.s * d / gesture.d, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, false);
            return;
        }
        var dx = e.clientX - gesture.x;
        var dy = e.clientY - gesture.y;
        if (gesture.type === 'pending' && Math.hypot(dx, dy) > 8) {
            if (view.s > 1.01) {
                gesture.type = 'pan';
            } else if (gesture.touch) {
                gesture.type = Math.abs(dx) > Math.abs(dy) ? (state.items.length > 1 ? 'swipe' : 'none') : (dy > 0 ? 'down' : 'none');
            } else {
                gesture.type = 'none';
            }
            // Capture only once a drag really starts: capturing on pointerdown would retarget the
            // following click to the stage, which counts as a backdrop click and closes the modal
            try {
                ui.stage.setPointerCapture(e.pointerId);
            } catch (err) {
                // pointer already gone
            }
        }
        if (gesture.type === 'pan') {
            view.x = gesture.vx + dx;
            view.y = gesture.vy + dy;
            clampView();
            applyView(false);
        } else if (gesture.type === 'swipe') {
            ui.img.style.transition = 'none';
            ui.img.style.transform = 'translateX(' + dx + 'px)';
        } else if (gesture.type === 'down') {
            ui.img.style.transition = 'none';
            ui.img.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
            ui.dialog.style.setProperty('--sm-drag', Math.min(1, Math.max(0, dy) / ui.stage.clientHeight));
        }
    }

    function onPointerUp(e) {
        if (!pointers[e.pointerId]) {
            return;
        }
        delete pointers[e.pointerId];
        var g = gesture;
        if (!g || points().length) {
            if (g && g.type === 'pinch') {
                gesture = null; // remaining finger does nothing until lifted
            }
            return;
        }
        gesture = null;
        var dx = e.clientX - g.x;
        var dy = e.clientY - g.y;
        var dt = Math.max(1, Date.now() - g.t);
        ui.dialog.style.removeProperty('--sm-drag');
        if (g.type !== 'pending') {
            suppressClick = true;
            setTimeout(function () {
                suppressClick = false;
            }, 50);
        }
        if (g.type === 'swipe') {
            var go = Math.abs(dx) > ui.stage.clientWidth * 0.2 || Math.abs(dx) / dt > 0.5;
            ui.img.style.transition = '';
            ui.img.style.transform = '';
            if (go) {
                if (dx < 0) {
                    next();
                } else {
                    prev();
                }
            }
        } else if (g.type === 'down') {
            ui.img.style.transition = '';
            ui.img.style.transform = '';
            if (dy > ui.stage.clientHeight * 0.25) {
                close();
            }
        } else if (g.type === 'pending' && g.touch && dt < 300) {
            // Double tap toggles zoom around the tapped point
            var now = Date.now();
            if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
                lastTap.t = 0;
                suppressClick = true;
                setTimeout(function () {
                    suppressClick = false;
                }, 350);
                toggleZoom(e.clientX, e.clientY);
            } else {
                lastTap = { t: now, x: e.clientX, y: e.clientY };
            }
        }
    }

    BUILDERS.push(function (d) {
        var st = d.querySelector('.supermodal__stage');
        st.addEventListener('pointerdown', onPointerDown);
        st.addEventListener('pointermove', onPointerMove);
        st.addEventListener('pointerup', onPointerUp);
        st.addEventListener('pointercancel', onPointerUp);
        st.addEventListener('dblclick', function (e) {
            // touch double taps are handled in onPointerUp (browsers also send dblclick for them)
            if (e.target === ui.img && Date.now() - lastTouch > 800) {
                toggleZoom(e.clientX, e.clientY);
            }
        });
        st.addEventListener('wheel', function (e) {
            if (e.ctrlKey || view.s > 1.01) {
                e.preventDefault();
                zoomTo(view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY, false);
            }
        }, { passive: false });
        d.addEventListener('click', function (e) {
            if (suppressClick) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
        if (window.ResizeObserver) {
            new ResizeObserver(function () {
                if (view.s > 1.01) {
                    resetZoom();
                }
            }).observe(st);
        }
    });
    ACTIONS.zoom = function () {
        toggleZoom();
    };
    KEYS.z = KEYS.Z = function () {
        toggleZoom();
    };
    ESCAPES.unshift(function () {
        if (view.s > 1.01) {
            zoomTo(1, undefined, undefined, true);
            return true;
        }
        return false;
    });
    RENDERERS.unshift(resetZoom);
    CLOSERS.push(function () {
        resetZoom();
        pointers = {};
        gesture = null;
    });

    /* ------------------------------------------------------------------ *
     * Slideshow, "more" menu, fullscreen
     * ------------------------------------------------------------------ */

    var timer = null;

    function playing() {
        return ui && ui.dialog.classList.contains('is-playing');
    }

    // (Re)starts the countdown to the next image, or pauses it when it shouldn't run
    function schedule() {
        clearTimeout(timer);
        if (!ui) {
            return;
        }
        var d = ui.dialog;
        var bar = d.querySelector('.supermodal__progress');
        bar.classList.remove('is-running');
        if (!playing() || !state.open || view.s > 1.01 || d.classList.contains('is-grid') || document.hidden) {
            return;
        }
        var ms = Math.max(1, Number(state.opts.interval) || 5) * 1000;
        d.style.setProperty('--sm-interval', ms + 'ms');
        void bar.offsetWidth; // restart the progress animation
        bar.classList.add('is-running');
        timer = setTimeout(function () {
            render((state.index + 1) % state.items.length, false); // the slideshow always loops
        }, ms);
    }

    function setPlaying(on) {
        var d = ui.dialog;
        on = on && state.items.length > 1;
        d.classList.toggle('is-playing', on);
        var b = d.querySelector('[data-action="play"]');
        b.innerHTML = icon(on ? 'pause' : 'play');
        label(b, on ? state.opts.strings.pause : state.opts.strings.play);
        b.classList.toggle('is-active', on);
        schedule();
    }

    // Browsers refuse <dialog> as the fullscreen element ("Dialog elements are invalid"), so the whole
    // page goes fullscreen: the open modal already covers the viewport from the top layer
    var ownFullscreen = false;
    function toggleFullscreen() {
        var root = document.documentElement;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else if (root.requestFullscreen) {
            ownFullscreen = true;
            root.requestFullscreen().catch(function () {
                ownFullscreen = false;
            });
        }
    }

    ACTIONS.play = function () {
        ui.dialog.classList.remove('is-more');
        setPlaying(!playing());
    };
    KEYS[' '] = function (e) {
        // Space is the slideshow key (Enter still activates a focused button); move focus off
        // the button so the Space keyup doesn't press it too
        if (e.target.closest('button,a')) {
            ui.dialog.focus({ preventScroll: true });
        }
        setPlaying(!playing());
    };
    ACTIONS.more = function () {
        ui.dialog.classList.toggle('is-more');
    };
    ACTIONS.download = function () {
        ui.dialog.classList.remove('is-more');
    };
    ACTIONS.fullscreen = function () {
        ui.dialog.classList.remove('is-more');
        toggleFullscreen();
    };
    ESCAPES.unshift(function () {
        if (ui.dialog.classList.contains('is-more')) {
            ui.dialog.classList.remove('is-more');
            return true;
        }
        return false;
    });
    RENDERERS.push(schedule);
    CLOSERS.push(function () {
        clearTimeout(timer);
        ui.dialog.classList.remove('is-playing', 'is-more');
        if (ownFullscreen && document.fullscreenElement) {
            document.exitFullscreen(); // leave the fullscreen the modal started
        }
        ownFullscreen = false;
    });
    BUILDERS.push(function (d) {
        d.querySelector('[data-action="fullscreen"]').hidden = !document.fullscreenEnabled;
        document.addEventListener('visibilitychange', schedule);
        document.addEventListener('fullscreenchange', function () {
            var on = !!document.fullscreenElement && state.open;
            if (!document.fullscreenElement) {
                ownFullscreen = false;
            }
            var b = d.querySelector('[data-action="fullscreen"]');
            b.innerHTML = icon(on ? 'fullscreenExit' : 'fullscreen');
            b.classList.toggle('is-active', on);
        });
    });

    /* ------------------------------------------------------------------ *
     * Public API
     * ------------------------------------------------------------------ */

    var defaults = {
        interval: 5,
        autostart: false,
        thumbs: true,
        loop: true,
        theme: 'dark',
        compat: false,
        strings: {
            close: 'Close',
            prev: 'Previous',
            next: 'Next',
            play: 'Start slideshow',
            pause: 'Pause slideshow',
            zoom: 'Zoom',
            grid: 'Show all images',
            download: 'Download',
            fullscreen: 'Fullscreen',
            more: 'More',
            counter: 'Image {i} of {n}',
            loading: 'Loading…',
            error: 'The image could not be loaded.'
        }
    };

    function setDefaults(options) {
        options = options || {};
        Object.keys(options).forEach(function (key) {
            if (key === 'strings') {
                Object.keys(options.strings || {}).forEach(function (s) {
                    if (typeof options.strings[s] === 'string') {
                        defaults.strings[s] = options.strings[s];
                    }
                });
            } else {
                defaults[key] = options[key];
            }
        });
    }

    // SuperModal.bind(selectors, options): every element matching the selector (or array of selectors) opens the
    // modal, all of them as one gallery. Calling it again with the same selectors refreshes it (keyboard access for
    // images added since) and replaces its options. Returns a function that unbinds.
    function bind(selectors, options) {
        var sel = [].concat(selectors).filter(function (s) {
            try {
                return typeof s === 'string' && s.trim() && (document.querySelector(s) || true);
            } catch (e) {
                return false; // invalid selector
            }
        }).join(',');
        if (!sel) {
            return function () {};
        }
        var b = BINDINGS.filter(function (x) {
            return x.sel === sel;
        })[0];
        if (!b) {
            b = { sel: sel };
            BINDINGS.push(b);
        }
        b.options = options || {};
        var markIfBound = function () {
            if (BINDINGS.indexOf(b) > -1) {
                mark(b);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', markIfBound);
        } else {
            markIfBound();
        }
        return function unbind() {
            var i = BINDINGS.indexOf(b);
            if (i > -1) {
                BINDINGS.splice(i, 1);
                unmarkAll();
                BINDINGS.forEach(mark);
            }
        };
    }

    /* ------------------------------------------------------------------ *
     * Frame mode: a page in an iframe with the modal's look (e.g. a picker or a form).
     * SuperModal.frame(url, { title }) / SuperModal.close(); the page inside can call parent.SuperModal.close().
     * ------------------------------------------------------------------ */
    var frameDialog = null;

    function openFrame(url, options) {
        options = options || {};
        var src = safeUrl(String(url || ''));
        if (!src) {
            return;
        }
        if (frameDialog) {
            closeFrame(true);
        }
        var d = document.createElement('dialog');
        d.className = 'supermodal supermodal--frame' + (defaults.theme === 'light' ? ' supermodal--light' : '');
        d.setAttribute('aria-label', options.title || '');
        var bar = document.createElement('div');
        bar.className = 'supermodal__bar';
        var title = document.createElement('div');
        title.className = 'supermodal__frameTitle';
        title.textContent = options.title || '';
        var tools = document.createElement('div');
        tools.className = 'supermodal__tools';
        var close = button('close');
        close.setAttribute('aria-label', defaults.strings.close);
        close.title = defaults.strings.close;
        close.addEventListener('click', function () {
            closeFrame();
        });
        tools.appendChild(close);
        bar.appendChild(title);
        bar.appendChild(tools);
        var iframe = document.createElement('iframe');
        iframe.className = 'supermodal__frame';
        iframe.title = options.title || '';
        iframe.src = src;
        d.appendChild(bar);
        d.appendChild(iframe);
        d.addEventListener('cancel', function (e) {
            e.preventDefault();
            closeFrame();
        });
        d.addEventListener('close', function () {
            if (frameDialog === d) {
                closeFrame(true); // closed by the browser
            }
        });
        document.body.appendChild(d);
        frameDialog = d;
        lockScroll();
        d.showModal();
    }

    function closeFrame(now) {
        var d = frameDialog;
        if (!d) {
            return;
        }
        frameDialog = null;
        unlockScroll();
        var done = function () {
            if (d.open) {
                d.close();
            }
            d.remove();
        };
        if (now || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            done();
        } else {
            d.classList.add('is-closing');
            window.setTimeout(done, 200);
        }
    }

    // Defaults the page set before this script loaded (late/async loading by JS optimisers)
    if (window.SuperModalDefaults && typeof window.SuperModalDefaults === 'object') {
        setDefaults(window.SuperModalDefaults);
    }

    window.SuperModal = {
        open: open,
        close: function () {
            if (frameDialog) {
                closeFrame();
            }
            if (state.open) {
                close();
            }
        },
        frame: openFrame,
        bind: bind,
        next: next,
        prev: prev,
        goTo: goTo,
        isOpen: function () {
            return state.open;
        },
        setDefaults: setDefaults,
        _internals: {
            parseData: parseData,
            isImageUrl: isImageUrl,
            safeUrl: safeUrl,
            sanitizeHtml: sanitizeHtml,
            triggerInfo: triggerInfo,
            collectGroup: collectGroup,
            fitGrid: fitGrid
        }
    };
})(window, document);
