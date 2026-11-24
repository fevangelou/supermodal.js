/*
 * SuperModal.js docs site: demo buttons, the event log and copy buttons
 */
(function () {
    'use strict';

    // The page has a drop-in demo with other lightboxes' markup, so it turns compat mode on
    SuperModal.setDefaults({ compat: true });

    // "Images without links" demo
    SuperModal.bind('#post img');

    var actions = {
        'open-sheet': function () {
            SuperModal.open('#sheet a', 0);
        },
        'open-array': function () {
            SuperModal.open([
                { src: 'images/studio/polar-lights.webp', thumb: 'images/studio/polar-lights-960.webp', title: 'Green and red polar lights', caption: 'Opened from an array of objects, with the slideshow running.' },
                { src: 'images/studio/light-trails.webp', thumb: 'images/studio/light-trails-960.webp', title: 'Neon light trails in Munich' },
                { src: 'images/studio/spiral-stairs.webp', thumb: 'images/studio/spiral-stairs-960.webp', title: 'Spiral staircase' }
            ], 0, { autostart: true, interval: 3 });
        },
        'open-frame': function () {
            SuperModal.frame('frame-demo.html', { title: 'A page inside SuperModal.frame()' });
        }
    };

    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-demo]');
        if (b && actions[b.getAttribute('data-demo')]) {
            e.preventDefault();
            actions[b.getAttribute('data-demo')]();
        }
    });

    // Event log
    var log = document.getElementById('log');
    ['open', 'change', 'close'].forEach(function (name) {
        document.addEventListener('supermodal:' + name, function (e) {
            if (!log) {
                return;
            }
            var line = document.createElement('div');
            var item = e.detail.item;
            line.textContent = 'supermodal:' + name + '  index ' + e.detail.index + (item && item.title ? '  "' + item.title + '"' : '');
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        });
    });

    // Copy buttons on code blocks
    Array.prototype.forEach.call(document.querySelectorAll('.code'), function (box) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'copy';
        b.textContent = 'Copy';
        b.addEventListener('click', function () {
            navigator.clipboard.writeText(box.querySelector('pre').textContent).then(function () {
                b.textContent = 'Copied';
                setTimeout(function () {
                    b.textContent = 'Copy';
                }, 1600);
            });
        });
        box.appendChild(b);
    });
})();
