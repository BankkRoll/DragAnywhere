(() => {
  let uid = 0;

  // === ADD A STYLESHEET FOR HOVER, DRAGGING, AND RESTRICTED ZONES ===
  const style = document.createElement('style');
  style.innerHTML = `
    .hover-highlight {
      outline: 2px dashed #00ffff !important;
      outline-offset: -2px;
    }
    .dragging {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
      opacity: 0.9 !important;
      transition: transform 0.05s ease;
    }
    .no-drop {
      outline: 2px solid red !important;
      background: rgba(255, 0, 0, 0.1) !important;
    }
    .layout-tool-alert {
      position: fixed;
      top: 10px;
      left: 10px;
      background: #1e90ff;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      user-select: none;
      transition: opacity 0.3s ease;
    }
    .layout-tool-alert.layout-tool-alert-hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // === CREATE ALERT BANNER WITH AUTO-HIDE ===
  const alertBanner = document.createElement('div');
  alertBanner.className = 'layout-tool-alert';
  alertBanner.textContent = 'This tool is for testing layouts using drag and drop. Use it on any website!';
  document.body.appendChild(alertBanner);
  // Auto-hide after 10 seconds
  setTimeout(() => {
    alertBanner.classList.add('layout-tool-alert-hidden');
    setTimeout(() => {
      alertBanner.style.display = 'none';
    }, 300); // Match transition duration
  }, 10000);

  // === LOOP OVER ALL ELEMENTS IN THE BODY ===
  document.querySelectorAll('body *:not(script):not(style):not(.layout-tool-alert)').forEach(el => {
    // Avoid reprocessing already floating elements or alert
    if (el.classList.contains('floating-freely')) return;

    // Assign unique ID if none exists
    if (!el.id) el.id = `free-float-${uid++}`;

    // Visual affordance for interactivity
    el.style.cursor = 'move';

    // Hover effect: show dashed border on mouseover
    el.addEventListener('mouseover', () => {
      if (!el.classList.contains('dragging')) {
        el.classList.add('hover-highlight');
      }
    });
    el.addEventListener('mouseout', () => el.classList.remove('hover-highlight'));

    // Drag logic begins here
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;

      // === POSITIONING INFO BEFORE DETACHING ===
      const rect = target.getBoundingClientRect();

      // === CONVERT ELEMENT TO FLOATING ===
      target.style.position = 'absolute';
      target.style.left = `${rect.left + window.scrollX}px`;
      target.style.top = `${rect.top + window.scrollY}px`;
      target.style.width = `${rect.width}px`;
      target.style.height = `${rect.height}px`;
      target.style.margin = '0';
      target.style.zIndex = 9999;
      target.style.pointerEvents = 'auto';

      // === FLOAT IT FREELY IN BODY IF NEEDED ===
      if (!target.classList.contains('floating-freely')) {
        document.body.appendChild(target);
        target.classList.add('floating-freely');
      }

      // Add dragging class for visual feedback
      target.classList.add('dragging');

      // Offset from click point for smoother dragging
      const shiftX = e.clientX - rect.left;
      const shiftY = e.clientY - rect.top;

      // === SNAPPING AND BOUNDARY SETTINGS ===
      const snapThreshold = 10; // Tighter snapping for precision
      const viewportPadding = 5; // Prevent dragging outside viewport

      // Get all elements for snapping and container detection
      const allElements = Array.from(document.querySelectorAll('body *:not(script):not(style):not(.layout-tool-alert)'))
        .filter(elem => elem !== target && !elem.classList.contains('dragging'));

      // Identify container-like elements (div, section, etc. with children or sufficient size)
      const containers = allElements.filter(elem => {
        const tag = elem.tagName.toLowerCase();
        const rect = elem.getBoundingClientRect();
        return (
          ['div', 'section', 'article', 'main', 'aside'].includes(tag) &&
          (elem.children.length > 0 || (rect.width > 100 && rect.height > 100))
        );
      });

      // === CHECK FOR RESTRICTED DROP ZONES ===
      const noDropZones = document.querySelectorAll('.no-drop') || [];
      function isInNoDropZone(x, y) {
        return Array.from(noDropZones).some(zone => {
          const zoneRect = zone.getBoundingClientRect();
          return (
            x >= zoneRect.left &&
            x <= zoneRect.right &&
            y >= zoneRect.top &&
            y <= zoneRect.bottom
          );
        });
      }

      // Reposition element with precise snapping
      function moveAt(pageX, pageY) {
        let newX = pageX - shiftX;
        let newY = pageY - shiftY;

        // === BOUNDARY CHECKS (KEEP WITHIN VIEWPORT) ===
        const maxX = window.innerWidth - rect.width - viewportPadding;
        const maxY = window.innerHeight - rect.height - viewportPadding;
        newX = Math.max(viewportPadding, Math.min(newX, maxX));
        newY = Math.max(viewportPadding, Math.min(newY, maxY));

        // === PRECISE EDGE SNAPPING ===
        let closestSnap = { dist: Infinity, x: newX, y: newY };

        // Snap to all elements' edges
        allElements.forEach(elem => {
          const elemRect = elem.getBoundingClientRect();
          const elemLeft = elemRect.left + window.scrollX;
          const elemRight = elemRect.right + window.scrollX;
          const elemTop = elemRect.top + window.scrollY;
          const elemBottom = elemRect.bottom + window.scrollY;

          const proposedLeft = newX;
          const proposedRight = newX + rect.width;
          const proposedTop = newY;
          const proposedBottom = newY + rect.height;

          // Snap to left edge
          const distLeft = Math.abs(proposedLeft - elemRight);
          if (distLeft < snapThreshold && distLeft < closestSnap.dist) {
            closestSnap = { dist: distLeft, x: elemRight, y: newY };
          }
          // Snap to right edge
          const distRight = Math.abs(proposedRight - elemLeft);
          if (distRight < snapThreshold && distRight < closestSnap.dist) {
            closestSnap = { dist: distRight, x: elemLeft - rect.width, y: newY };
          }
          // Snap to top edge
          const distTop = Math.abs(proposedTop - elemBottom);
          if (distTop < snapThreshold && distTop < closestSnap.dist) {
            closestSnap = { dist: distTop, x: newX, y: elemBottom };
          }
          // Snap to bottom edge
          const distBottom = Math.abs(proposedBottom - elemTop);
          if (distBottom < snapThreshold && distBottom < closestSnap.dist) {
            closestSnap = { dist: distBottom, x: newX, y: elemTop - rect.height };
          }
        });

        // Snap to containers' inner edges
        containers.forEach(container => {
          const containerRect = container.getBoundingClientRect();
          const cLeft = containerRect.left + window.scrollX;
          const cRight = containerRect.right + window.scrollX;
          const cTop = containerRect.top + window.scrollY;
          const cBottom = containerRect.bottom + window.scrollY;

          const proposedLeft = newX;
          const proposedRight = newX + rect.width;
          const proposedTop = newY;
          const proposedBottom = newY + rect.height;

          // Snap to container's inner edges
          const distLeft = Math.abs(proposedLeft - cLeft);
          if (distLeft < snapThreshold && distLeft < closestSnap.dist) {
            closestSnap = { dist: distLeft, x: cLeft, y: newY };
          }
          const distRight = Math.abs(proposedRight - cRight);
          if (distRight < snapThreshold && distRight < closestSnap.dist) {
            closestSnap = { dist: distRight, x: cRight - rect.width, y: newY };
          }
          const distTop = Math.abs(proposedTop - cTop);
          if (distTop < snapThreshold && distTop < closestSnap.dist) {
            closestSnap = { dist: distTop, x: newX, y: cTop };
          }
          const distBottom = Math.abs(proposedBottom - cBottom);
          if (distBottom < snapThreshold && distBottom < closestSnap.dist) {
            closestSnap = { dist: distBottom, x: newX, y: cBottom - rect.height };
          }
        });

        // Apply closest snap point
        newX = closestSnap.x;
        newY = closestSnap.y;

        // === CHECK RESTRICTED ZONES ===
        if (isInNoDropZone(newX + rect.width / 2, newY + rect.height / 2)) {
          target.style.outline = '2px solid red';
        } else {
          target.style.outline = '';
        }

        // Apply new position
        target.style.left = `${newX}px`;
        target.style.top = `${newY}px`;
      }

      function onMouseMove(e) {
        moveAt(e.pageX, e.pageY);
      }

      // Add drag listeners
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', onMouseMove);
        target.classList.remove('dragging');
        target.style.outline = '';

        // === PREVENT DROPPING IN RESTRICTED ZONES ===
        const finalX = parseFloat(target.style.left);
        const finalY = parseFloat(target.style.top);
        if (isInNoDropZone(finalX + rect.width / 2, finalY + rect.height / 2)) {
          target.style.left = `${rect.left + window.scrollX}px`;
          target.style.top = `${rect.top + window.scrollY}px`;
        }
      }, { once: true });

      // Prevent ghost dragging artifacts
      target.ondragstart = () => false;
    });
  });
})();
