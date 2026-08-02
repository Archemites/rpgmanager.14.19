/* ============================================================
   GM generic right-click context menu (Windows-style popup): a floating
   list of labeled actions positioned at the cursor. Callers (mouse.js) build
   the item list per right-click target (token / note marker / empty map)
   and call openContextMenu(screenX, screenY, items). Self-contained — no
   forward references into other GM files.
   ============================================================ */

(() => {
  'use strict';

  const menuEl = document.createElement('div');
  menuEl.id = 'gmContextMenu';
  menuEl.className = 'context-menu';
  document.body.appendChild(menuEl);

  function closeContextMenu() {
    menuEl.classList.remove('open');
    menuEl.innerHTML = '';
  }

  // items: [{ label, danger?: bool, onClick: fn }, ...]
  function openContextMenu(screenX, screenY, items) {
    menuEl.innerHTML = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'context-menu-item' + (item.danger ? ' danger' : '');
      row.textContent = item.label;
      row.addEventListener('click', () => {
        closeContextMenu();
        item.onClick();
      });
      menuEl.appendChild(row);
    }
    menuEl.classList.add('open');

    // clamp so the menu never renders off-screen
    const rect = menuEl.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    menuEl.style.left = Math.max(0, Math.min(screenX, maxX)) + 'px';
    menuEl.style.top = Math.max(0, Math.min(screenY, maxY)) + 'px';
  }

  // Close on the NEXT mousedown outside the menu. Listening in the capture
  // phase and skipping button 2 (right-click) means the very mousedown that
  // opens the menu (dispatched to mouse.js's canvas listener first, since
  // canvas is the event target and this is document-level) never closes it
  // in the same tick — only a later, separate mousedown does.
  document.addEventListener('mousedown', (e) => {
    if (!menuEl.classList.contains('open')) return;
    if (e.button === 2) return;  // the right-click that opens/repositions the menu shouldn't also close it
    if (!menuEl.contains(e.target)) closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });
  window.addEventListener('scroll', closeContextMenu, true);

  // ---------- Expose to window.RPG ----------
  window.RPG.openContextMenu = openContextMenu;
  window.RPG.closeContextMenu = closeContextMenu;
})();
