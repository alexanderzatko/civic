/**
 * Full-document HTML for blackout paint (mirrors Rovas `rovas-photo-paint.js`).
 * Host talks via `window.ReactNativeWebView.postMessage` / injected `CivicPaint.*`.
 */
export const PHOTO_PAINT_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #1a1a1a; height: 100%; overflow: hidden; touch-action: none; }
  #wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  canvas { max-width: 100%; max-height: 100%; touch-action: none; }
</style>
</head>
<body>
<div id="wrap"><canvas id="c"></canvas></div>
<script>
(function () {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var undoStack = [];
  var drawing = false;
  var lastX = 0, lastY = 0, startX = 0, startY = 0;
  var brush = 24;
  var straighten = false;
  var ready = false;

  function post(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function updateUndo() {
    post({ type: 'undoState', canUndo: undoStack.length > 1 });
  }

  function pushUndo() {
    try {
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStack.length > 25) undoStack.splice(1, 1);
      updateUndo();
    } catch (e) {}
  }

  function canvasPos(evt) {
    var rect = canvas.getBoundingClientRect();
    var t = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]);
    var clientX = t ? t.clientX : evt.clientX;
    var clientY = t ? t.clientY : evt.clientY;
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function strokeTo(x, y) {
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = brush;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function onDown(evt) {
    if (!ready) return;
    evt.preventDefault();
    pushUndo();
    drawing = true;
    var p = canvasPos(evt);
    startX = lastX = p.x;
    startY = lastY = p.y;
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(lastX, lastY, brush / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function onMove(evt) {
    if (!drawing) return;
    evt.preventDefault();
    var p = canvasPos(evt);
    strokeTo(p.x, p.y);
  }

  function onUp(evt) {
    if (!drawing) return;
    evt.preventDefault();
    drawing = false;
    if (!straighten || !undoStack.length) return;
    var endX = lastX, endY = lastY;
    try { ctx.putImageData(undoStack[undoStack.length - 1], 0, 0); } catch (e) { return; }
    lastX = startX;
    lastY = startY;
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(startX, startY, brush / 2, 0, Math.PI * 2);
    ctx.fill();
    strokeTo(endX, endY);
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('touchcancel', onUp, { passive: false });

  function loadFromSrc(src) {
    ready = false;
    undoStack = [];
    post({ type: 'status', status: 'loading' });
    var image = new Image();
    image.onload = function () {
      var w = image.naturalWidth || image.width;
      var h = image.naturalHeight || image.height;
      if (!w || !h) {
        post({ type: 'status', status: 'error' });
        return;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(image, 0, 0);
      undoStack = [];
      pushUndo();
      ready = true;
      post({ type: 'status', status: 'ready' });
    };
    image.onerror = function () {
      post({ type: 'status', status: 'error' });
    };
    image.src = src;
  }

  function onHostMessage(raw) {
    var data = typeof raw === 'string' ? raw : (raw && raw.data);
    if (typeof data !== 'string') return;
    var msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || !msg.type) return;
    if (msg.type === 'load' && msg.src) {
      loadFromSrc(msg.src);
      return;
    }
    if (msg.type === 'setBrush') {
      window.CivicPaint.setBrush(msg.value);
      return;
    }
    if (msg.type === 'setStraighten') {
      window.CivicPaint.setStraighten(msg.value);
      return;
    }
    if (msg.type === 'undo') { window.CivicPaint.undo(); return; }
    if (msg.type === 'clear') { window.CivicPaint.clear(); return; }
    if (msg.type === 'export') { window.CivicPaint.exportJpeg(); return; }
  }

  document.addEventListener('message', function (e) { onHostMessage(e.data); });
  window.addEventListener('message', function (e) { onHostMessage(e.data); });

  window.CivicPaint = {
    load: loadFromSrc,
    setBrush: function (n) {
      brush = Math.max(4, Math.min(80, parseInt(n, 10) || 24));
    },
    setStraighten: function (v) {
      straighten = !!v;
    },
    undo: function () {
      if (undoStack.length <= 1) return;
      ctx.putImageData(undoStack.pop(), 0, 0);
      updateUndo();
    },
    clear: function () {
      if (undoStack.length <= 1) return;
      ctx.putImageData(undoStack[0], 0, 0);
      undoStack = [undoStack[0]];
      updateUndo();
    },
    exportJpeg: function () {
      if (!ready) {
        post({ type: 'export', ok: false });
        return;
      }
      try {
        var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        var comma = dataUrl.indexOf(',');
        var b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
        post({ type: 'export', ok: true, data: b64 });
      } catch (e) {
        post({ type: 'export', ok: false });
      }
    }
  };

  post({ type: 'status', status: 'boot' });
})();
</script>
</body>
</html>`;
