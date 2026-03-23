// ===== ADMIN APP =====
// แยกจาก app.js — admin functions ทั้งหมด
// ใช้ shared utilities จาก app.js: CONFIG, userId, apiCall, numberFormat, showToast, showModal, hideModal, showLoading, hideLoading

var isAdminUser = false;
var _dashData = null;

// ===== ADMIN INIT =====
async function initAdmin() {
  var loadingEl = document.getElementById('loading');
  try {
    await liff.init({ liffId: '2009026931-tifU2b4l' });

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    var profile = await liff.getProfile();
    userId = profile.userId;

    isAdminUser = true;
    if (loadingEl) loadingEl.style.display = 'none';

    // Deep link: ?chat=Uxxxx&name=xxx → เปิด chat ของ user คนนั้นทันที
    checkAndOpenChatFromUrl_();

    // LIFF cache fix: เมื่อกลับมาจาก background ให้ re-check URL params
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        checkAndOpenChatFromUrl_();
      }
    });

    switchAdminSubTab('payment');

  } catch (err) {
    if (loadingEl) {
      loadingEl.innerHTML = '<p style="color:var(--red);">Error: ' + err.message + '</p>';
    }
  }
}

// ===== ADMIN SUB-TAB SWITCHING =====
function switchAdminSubTab(sub) {
  var tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });

  var sections = document.querySelectorAll('.content .section');
  sections.forEach(function(s) { s.style.display = 'none'; });

  if (sub === 'users') {
    document.querySelector('[data-tab="users"]').classList.add('active');
    document.getElementById('admin-users-sub').style.display = 'block';
    loadAdminUsers();
  } else if (sub === 'payment') {
    document.querySelector('[data-tab="payment"]').classList.add('active');
    document.getElementById('admin-payment-sub').style.display = 'block';
    loadAdminPayments();
  } else if (sub === 'deposit') {
    document.querySelector('[data-tab="deposit"]').classList.add('active');
    document.getElementById('admin-deposit-sub').style.display = 'block';
    loadAdminDepositReturns();
  } else if (sub === 'dashboard') {
    document.querySelector('[data-tab="dashboard"]').classList.add('active');
    document.getElementById('admin-dashboard-sub').style.display = 'block';
    loadAdminDashboard();
  } else if (sub === 'orders') {
    document.querySelector('[data-tab="orders"]').classList.add('active');
    document.getElementById('admin-orders-sub').style.display = 'block';
    loadAdminOrders();
  } else if (sub === 'simulate') {
    document.querySelector('[data-tab="simulate"]').classList.add('active');
    document.getElementById('admin-simulate-sub').style.display = 'block';
    loadSimulate();
  } else if (sub === 'broadcast') {
    document.querySelector('[data-tab="broadcast"]').classList.add('active');
    document.getElementById('admin-broadcast-sub').style.display = 'block';
    loadAdminBroadcast();
  }
}

// ===== ADMIN USERS =====
function loadAdminUsers() {
  apiCall('adminGetUsers').then(function(data) {
    if (!data.success) return;
    renderAdminUsers(data.users || []);
  });
}

function renderAdminUsers(users) {
  var container = document.getElementById('admin-users-list');
  if (!container) return;
  var total = users.length;
  var pending = users.filter(function(u) { return !u.approved && !u.blocked; }).length;

  var html = '<div class="summary-row" style="margin-bottom:15px;">' +
    '<div class="summary-card pending"><div class="summary-label">ทั้งหมด</div><div class="summary-value" style="color:var(--txt);">' + total + '</div></div>' +
    '<div class="summary-card deposit"><div class="summary-label">รอ Approve</div><div class="summary-value" style="color:var(--amber);">' + pending + '</div></div>' +
  '</div>';

  users.sort(function(a, b) {
    var ap = a.isAdmin ? 0 : (!a.approved && !a.blocked) ? 1 : a.blocked ? 3 : 2;
    var bp = b.isAdmin ? 0 : (!b.approved && !b.blocked) ? 1 : b.blocked ? 3 : 2;
    return ap - bp;
  });

  users.forEach(function(user) {
    var statusText = user.blocked ? '🚫 Blocked' : user.approved ? '✅ Active' : '⏳ Pending';
    var statusColor = user.blocked ? 'var(--red)' : user.approved ? 'var(--green)' : 'var(--amber)';
    var isActive = user.approved && !user.blocked;
    var isBlocked = user.blocked;
    var isPending = !user.approved && !user.blocked;

    html += '<div class="order-card" style="margin-bottom:10px;"><div style="display:flex;align-items:center;gap:12px;">';
    if (user.profileUrl) html += '<img src="' + user.profileUrl + '" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--border);" onerror="this.style.display=\'none\'">';
    var adminBadge = user.isAdmin ? ' <span style="display:inline-block;padding:1px 6px;border-radius:var(--r-full);background:var(--amber-soft);color:var(--amber);font-size:9px;font-weight:700;vertical-align:middle;">👑 ADMIN</span>' : '';
    html += '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + user.displayName + adminBadge + '</div><div style="font-size:10px;color:var(--txt3);font-family:monospace;word-break:break-all;">' + user.userId + '</div><div style="font-size:12px;color:' + statusColor + ';font-weight:600;">' + statusText + '</div></div>';

    if (isPending) {
      html += '<div style="text-align:right;font-size:12px;color:var(--txt3);"><div>฿' + numberFormat(user.pendingRefund || 0) + ' รอคืน</div></div>';
    }

    html += '</div>';
    if (user.bankName) html += '<div style="font-size:11px;color:var(--txt3);margin-top:8px;">🏦 ' + user.bankName + ' ' + user.bankAccount + ' (' + user.accountName + ')</div>';
    if (isActive || isBlocked) html += '<div style="font-size:11px;color:var(--txt3);margin-top:4px;">฿' + numberFormat(user.pendingRefund || 0) + ' รอคืน</div>';

    // Action buttons
    html += '<div style="display:flex;gap:8px;margin-top:10px;align-items:center;">';
    if (isPending) {
      html += '<button onclick="adminApprove(\'' + user.userId + '\')" style="flex:1;padding:8px;border:none;border-radius:var(--r-xs);background:var(--green);color:white;font-size:12px;cursor:pointer;font-weight:700;font-family:var(--f-th);">✅ Approve</button>';
      html += '<button onclick="adminBlock(\'' + user.userId + '\',\'block\')" style="flex:1;padding:8px;border:none;border-radius:var(--r-xs);background:var(--red);color:white;font-size:12px;cursor:pointer;font-weight:700;font-family:var(--f-th);">🚫 Block</button>';
    }
    if (isActive || isBlocked) {
      var checked = isActive ? 'checked' : '';
      var toggleLabel = isActive ? '✅ Active' : '🚫 Blocked';
      var labelColor = isActive ? 'color:var(--green);' : 'color:var(--red);';
      html += '<div class="toggle-wrap">';
      html += '<span class="toggle-label" style="' + labelColor + '">' + toggleLabel + '</span>';
      html += '<label class="toggle"><input type="checkbox" ' + checked + ' onchange="adminToggleBlock(\'' + user.userId + '\', this.checked)"><span class="slider"></span></label>';
      html += '</div>';
    }
    if (isActive) {
      var adminChecked = user.isAdmin ? 'checked' : '';
      var adminLabel = user.isAdmin ? '👑 Admin' : '👤 User';
      var adminLabelColor = user.isAdmin ? 'color:var(--amber);' : 'color:var(--txt3);';
      html += '<div class="toggle-wrap">';
      html += '<span class="toggle-label" style="' + adminLabelColor + '">' + adminLabel + '</span>';
      html += '<label class="toggle toggle-amber"><input type="checkbox" ' + adminChecked + ' onchange="adminToggleAdmin(\'' + user.userId + '\', this.checked)"><span class="slider"></span></label>';
      html += '</div>';
      html += '<button onclick="adminSendMessage(\'' + user.userId + '\',\'' + (user.displayName || '').replace(/'/g, "\\'") + '\')" style="padding:6px 10px;border:none;border-radius:var(--r-xs);background:var(--primary);color:white;font-size:11px;cursor:pointer;font-weight:700;font-family:var(--f-th);white-space:nowrap;">💬 ส่งข้อความ</button>';
    }
    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
}

function adminApprove(targetUserId) {
  apiCall('adminApproveUser', { targetUserId: targetUserId }).then(function(data) {
    if (data.success) { showToast('✅ อนุมัติแล้ว'); loadAdminUsers(); }
    else showToast('❌ ' + (data.error || 'Error'));
  });
}

function adminBlock(targetUserId, action) {
  apiCall('adminBlockUser', { targetUserId: targetUserId, blockAction: action }).then(function(data) {
    if (data.success) { showToast('✅ สำเร็จ'); loadAdminUsers(); }
    else showToast('❌ ' + (data.error || 'Error'));
  });
}

function adminToggleBlock(targetUserId, isChecked) {
  var action = isChecked ? 'unblock' : 'block';
  adminBlock(targetUserId, action);
}

function adminToggleAdmin(targetUserId, isChecked) {
  var action = isChecked ? 'add' : 'remove';
  adminSetAdmin(targetUserId, action);
}

function adminSetAdmin(targetUserId, action) {
  apiCall('adminSetAdmin', { targetUserId: targetUserId, adminAction: action }).then(function(data) {
    if (data.success) {
      showToast(action === 'add' ? '👑 ตั้งเป็น Admin แล้ว' : '👑 ถอด Admin แล้ว');
      loadAdminUsers();
    } else {
      showToast('❌ ' + (data.error || 'Error'));
    }
  });
}

function adminSendMessage(targetUserId, displayName) {
  openAdminChat(targetUserId, displayName);
}

// ===== ADMIN CHAT =====
var adminChatUserId = null;
var adminChatPollingId = null;
var lastChatTarget_ = null;

function checkAndOpenChatFromUrl_() {
  var params = new URLSearchParams(window.location.search);
  var chatTarget = params.get('chat');
  if (chatTarget && chatTarget !== lastChatTarget_) {
    lastChatTarget_ = chatTarget;
    var chatName = params.get('name') || 'User';
    // ปิด chat เก่าก่อน (ถ้ามี)
    if (adminChatPollingId) { clearInterval(adminChatPollingId); adminChatPollingId = null; }
    openAdminChat(chatTarget, decodeURIComponent(chatName));
  }
}

function openAdminChat(targetUserId, displayName) {
  // ปิด chat เก่าก่อน (clear polling + reset state)
  if (adminChatPollingId) { clearInterval(adminChatPollingId); adminChatPollingId = null; }
  // Clear ข้อความเก่าทันที เพื่อไม่ให้เห็นของ user คนก่อน
  document.getElementById('chat-messages').innerHTML = '<div class="chat-empty">กำลังโหลด...</div>';
  adminChatUserId = targetUserId;
  document.getElementById('admin-chat-title').textContent = '💬 ' + displayName;
  showModal('chatModal');
  loadAdminChatMessages();
  adminChatPollingId = setInterval(loadAdminChatMessages, 5000);
}

function closeAdminChat() {
  hideModal('chatModal');
  if (adminChatPollingId) { clearInterval(adminChatPollingId); adminChatPollingId = null; }
  adminChatUserId = null;
}

function loadAdminChatMessages() {
  if (!adminChatUserId) return;
  apiCall('getChatMessages', { userId: adminChatUserId, limit: 50 }).then(function(data) {
    if (!data.success) return;
    renderAdminChatMessages(data.messages);
  });
}

function renderAdminChatMessages(messages) {
  var el = document.getElementById('chat-messages');
  if (!messages || !messages.length) {
    el.innerHTML = '<div class="chat-empty">ยังไม่มีข้อความ</div>';
    return;
  }
  var html = '';
  messages.forEach(function(m) {
    var isMe = m.sender_type === 'admin';
    var time = new Date(m.created_at).toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'});
    var imgHtml = '';
    if (m.image_url) {
      imgHtml = '<a href="' + escapeHtml(m.image_url) + '" target="_blank">' +
        '<img src="' + escapeHtml(m.image_url) + '" class="chat-img"></a>';
    }
    html += '<div class="chat-bubble ' + (isMe ? 'me' : 'them') + '">' +
      imgHtml +
      (m.message ? '<div>' + escapeHtml(m.message) + '</div>' : '') +
      '<div class="chat-time">' + time + '</div></div>';
  });
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

var adminChatImageBase64 = null;

function previewAdminChatImage(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxDim = 1200;
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL('image/jpeg', 0.7);
      adminChatImageBase64 = compressed.split(',')[1];
      document.getElementById('admin-chat-preview-img').src = compressed;
      document.getElementById('admin-chat-image-preview').style.display = 'flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearAdminChatImage() {
  adminChatImageBase64 = null;
  document.getElementById('admin-chat-image-preview').style.display = 'none';
  document.getElementById('admin-chat-image-input').value = '';
}

function sendAdminChatMsg() {
  var input = document.getElementById('chat-input');
  var msg = input.value.trim();
  var hasImage = !!adminChatImageBase64;
  if (!msg && !hasImage) return;
  if (!adminChatUserId) return;
  input.value = '';

  // Optimistic
  var el = document.getElementById('chat-messages');
  var emptyEl = el.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();
  var now = new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'});
  var previewHtml = '';
  if (hasImage) {
    var previewSrc = document.getElementById('admin-chat-preview-img').src;
    previewHtml = '<img src="' + previewSrc + '" class="chat-img">';
  }
  el.innerHTML += '<div class="chat-bubble me">' + previewHtml +
    (msg ? '<div>' + escapeHtml(msg) + '</div>' : '') +
    '<div class="chat-time">' + now + '</div></div>';
  el.scrollTop = el.scrollHeight;

  if (hasImage) {
    var imageData = adminChatImageBase64;
    clearAdminChatImage();
    apiPost({ source: 'liff_chat_image', image: imageData }).then(function(uploadResult) {
      if (!uploadResult || !uploadResult.success) {
        var errMsg = (uploadResult && uploadResult.error) ? uploadResult.error : 'ไม่ทราบสาเหตุ';
        console.error('Admin chat image upload failed:', errMsg);
        showToast('อัปโหลดรูปไม่สำเร็จ: ' + errMsg);
        return;
      }
      apiCall('sendChatMessage', {
        userId: adminChatUserId, senderType: 'admin', senderName: 'Admin',
        message: msg, imageUrl: uploadResult.imageUrl
      }).then(function(data) {
        if (!data.success) showToast('❌ ส่งไม่สำเร็จ');
      });
    }).catch(function(err) {
      console.error('Admin chat image upload error:', err);
      showToast('อัปโหลดรูปไม่สำเร็จ: เครือข่ายมีปัญหา');
    });
  } else {
    apiCall('sendChatMessage', {
      userId: adminChatUserId, senderType: 'admin', senderName: 'Admin', message: msg
    }).then(function(data) {
      if (!data.success) showToast('❌ ส่งไม่สำเร็จ');
    });
  }
}

// ===== ADMIN PAYMENTS =====
var adminPaymentData = [];
var paymentSelections = {};

function loadAdminPayments() {
  var listEl = document.getElementById('admin-pay-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('adminGetPendingPayments').then(function(data) {
    if (!data.success) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    var rawUsers = (data.users || []).filter(function(u) {
      return u.bankName && u.bankAccount;
    });
    var mergeMap = {};
    var mergeOrder = [];
    rawUsers.forEach(function(u) {
      if (!mergeMap[u.userId]) {
        mergeMap[u.userId] = {
          userId: u.userId, displayName: u.displayName, profileUrl: u.profileUrl,
          bankName: u.bankName, bankAccount: u.bankAccount,
          accountName: u.accountName, phone: u.phone, bankId: u.bankId || '', orders: []
        };
        mergeOrder.push(u.userId);
      }
      u.orders.forEach(function(o) {
        mergeMap[u.userId].orders.push({
          orderId: o.orderId, shopeeId: o.shopeeId, amount: o.amount, type: u.type || 'refund'
        });
      });
    });
    adminPaymentData = mergeOrder.map(function(uid) { return mergeMap[uid]; });
    // Sort by BANK_ID ascending, users without BANK_ID go to end
    adminPaymentData.sort(function(a, b) {
      var aId = (a.bankId || '').toString().trim();
      var bId = (b.bankId || '').toString().trim();
      if (aId === '' && bId === '') return 0;
      if (aId === '') return 1;
      if (bId === '') return -1;
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' });
    });
    paymentSelections = {};
    adminPaymentData.forEach(function(u) {
      paymentSelections[u.userId] = new Set(u.orders.map(function(o) { return o.orderId; }));
    });
    renderAdminPayments();
  }).catch(function(err) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>เกิดข้อผิดพลาด</p></div>';
  });
}

function renderAdminPayments() {
  var totalUsers = adminPaymentData.length;
  var totalAmount = 0;
  adminPaymentData.forEach(function(u) {
    u.orders.forEach(function(o) { totalAmount += parseFloat(o.amount) || 0; });
  });

  var summaryEl = document.getElementById('admin-pay-summary');
  summaryEl.innerHTML = '<div class="admin-pay-summary" style="margin-bottom:0;grid-template-columns:1fr 1fr;">' +
    '<div class="aps-card warn"><div class="aps-num">' + totalUsers + '</div><div class="aps-lbl">รอโอน</div></div>' +
    '<div class="aps-card info"><div class="aps-num">฿' + numberFormat(totalAmount) + '</div><div class="aps-lbl">ยอดรวม</div></div>' +
    '</div>' +
    (totalUsers > 0 ? '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<button class="pay-btn" style="flex:1;background:var(--blue);color:#fff;" onclick="exportPaymentsCSV()">📊 Export</button>' +
      '<button class="pay-btn" style="flex:1;background:var(--green);color:#fff;" onclick="bulkApproveAll()">✅ Bulk Approved</button>' +
      '</div>' : '');

  var listEl = document.getElementById('admin-pay-list');
  if (adminPaymentData.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>ไม่มียอดรอโอน</p></div>';
    return;
  }

  var html = '';
  adminPaymentData.forEach(function(user) {
    var selected = paymentSelections[user.userId] || new Set();
    var selectedTotal = 0;
    user.orders.forEach(function(o) {
      if (selected.has(o.orderId)) selectedTotal += parseFloat(o.amount) || 0;
    });
    html += '<div class="pay-card">';
    html += '<div class="pay-card-header">';
    html += '<div class="pay-avatar">';
    if (user.profileUrl) {
      html += '<img src="' + user.profileUrl + '" onerror="this.parentElement.textContent=\'' + (user.displayName || '?').charAt(0) + '\'">';
    } else { html += (user.displayName || '?').charAt(0); }
    html += '</div>';
    var nameDisplay = user.displayName + (user.accountName ? ' (' + user.accountName + ')' : '');
    html += '<div class="pay-user-info"><div class="pay-user-name">' + nameDisplay + '</div>';
    html += '<div class="pay-user-bank">🏦 ' + (user.bankName || '-') + ' ' + (user.bankAccount || '') + '</div></div>';
    html += '<div class="pay-total-box"><div class="pay-total-amount">฿' + numberFormat(selectedTotal) + '</div>';
    html += '<div class="pay-total-label">' + selected.size + ' รายการ</div></div></div>';
    html += '<div class="pay-card-body">';
    user.orders.forEach(function(o) {
      var checked = selected.has(o.orderId);
      var isDeposit = o.type === 'deposit';
      html += '<div class="pay-order-row"><div class="pay-order-left">';
      html += '<div class="pay-check ' + (checked ? 'checked' : '') + '" onclick="togglePayOrder(\'' + user.userId + '\',\'' + o.orderId + '\')">✓</div>';
      html += '<div><div class="pay-oid">#' + o.orderId + '</div>';
      html += '<div class="pay-oid-shop">' + (isDeposit ? '🏷️ มัดจำ' : '🏪 ' + (o.shopeeId || '-')) + '</div></div></div>';
      html += '<div class="pay-oamt"' + (isDeposit ? ' style="color:var(--blue)"' : '') + '>฿' + numberFormat(o.amount) + '</div></div>';
    });
    html += '</div>';
    html += '<div class="pay-card-footer">';
    html += '<button class="pay-btn skip-btn" onclick="skipPayUser(\'' + user.userId + '\')">ข้าม</button>';
    html += '<button class="pay-btn confirm-btn" onclick="showConfirmPayModal(\'' + user.userId + '\')">✅ ยืนยันโอน</button>';
    html += '</div></div>';
  });
  listEl.innerHTML = html;
}

function togglePayOrder(userId, orderId) {
  var set = paymentSelections[userId];
  if (!set) return;
  if (set.has(orderId)) set.delete(orderId); else set.add(orderId);
  renderAdminPayments();
}

function skipPayUser(userId) {
  adminPaymentData = adminPaymentData.filter(function(u) { return u.userId !== userId; });
  delete paymentSelections[userId];
  renderAdminPayments();
  showToast('⏭️ ข้ามรายการแล้ว');
}

var confirmPayUserId = null;

function showConfirmPayModal(userId) {
  confirmPayUserId = userId;
  var user = adminPaymentData.find(function(u) { return u.userId === userId; });
  if (!user) return;
  var selected = paymentSelections[userId] || new Set();
  if (selected.size === 0) { showToast('❌ กรุณาเลือกอย่างน้อย 1 รายการ'); return; }
  var selectedOrders = user.orders.filter(function(o) { return selected.has(o.orderId); });
  var totalAmount = selectedOrders.reduce(function(sum, o) { return sum + (parseFloat(o.amount) || 0); }, 0);

  var modalInner = document.getElementById('confirmPayModalInner');
  modalInner.className = 'modal confirm-pay-modal';
  document.getElementById('cpay-modal-title').textContent = '✅ ยืนยันโอนเงิน';

  var html = '<div class="cpay-bank-card">';
  html += '<div class="cpay-bank-label">โอนเข้าบัญชี</div>';
  html += '<div class="cpay-bank-name">' + (user.bankName || '-') + '</div>';
  html += '<div class="cpay-bank-account">' + (user.bankAccount || '-') + '</div>';
  html += '<div class="cpay-bank-holder">👤 ' + (user.accountName || user.displayName) + '</div>';
  if (user.phone) html += '<div class="cpay-bank-user">📞 ' + user.phone + '</div>';
  html += '</div>';
  html += '<div class="cpay-orders"><div class="cpay-orders-label">📋 รายการที่เลือก (' + selectedOrders.length + ')</div>';
  selectedOrders.forEach(function(o) {
    var isDeposit = o.type === 'deposit';
    html += '<div class="cpay-order-item"><span class="oid">#' + o.orderId + (isDeposit ? ' 🏷️' : '') + '</span><span class="amt">฿' + numberFormat(o.amount) + '</span></div>';
  });
  html += '</div>';
  html += '<div class="cpay-total-box"><span class="cpay-total-label">💵 ยอดโอนรวม</span>';
  html += '<span class="cpay-total-amount">฿' + numberFormat(totalAmount) + '</span></div>';
  html += '<div class="cpay-note">⚠️ กดยืนยันแล้วระบบจะ:<br>1. อัปเดตสถานะ → "Transferred"<br>2. ส่ง Flex แจ้งลูกค้าทาง LINE<br>3. บันทึก Log</div>';
  document.getElementById('cpay-modal-body').innerHTML = html;

  var actHtml = '<button class="btn-cancel" onclick="hideModal(\'confirmPayModal\')">← กลับ</button>';
  actHtml += '<button class="btn-confirm-green" onclick="executePayment()">💸 ยืนยันโอน</button>';
  document.getElementById('cpay-modal-actions').innerHTML = actHtml;
  showModal('confirmPayModal');
}

function executePayment() {
  if (!confirmPayUserId) return;
  var user = adminPaymentData.find(function(u) { return u.userId === confirmPayUserId; });
  if (!user) return;
  var selected = paymentSelections[confirmPayUserId] || new Set();
  var selectedOrders = user.orders.filter(function(o) { return selected.has(o.orderId); });
  var totalAmount = selectedOrders.reduce(function(sum, o) { return sum + (parseFloat(o.amount) || 0); }, 0);

  showLoading('กำลังดำเนินการ...');

  var refundOrders = selectedOrders.filter(function(o) { return o.type !== 'deposit'; });
  var depositOrders = selectedOrders.filter(function(o) { return o.type === 'deposit'; });
  var promises = [];
  if (refundOrders.length > 0) {
    promises.push(apiCall('adminConfirmPayment', {
      targetUserId: confirmPayUserId,
      orderIds: refundOrders.map(function(o) { return o.orderId; }).join(','),
      totalAmount: refundOrders.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0),
      type: 'refund'
    }));
  }
  if (depositOrders.length > 0) {
    promises.push(apiCall('adminConfirmPayment', {
      targetUserId: confirmPayUserId,
      orderIds: depositOrders.map(function(o) { return o.orderId; }).join(','),
      totalAmount: depositOrders.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0),
      type: 'deposit'
    }));
  }

  Promise.all(promises).then(function(results) {
    hideLoading();
    hideModal('confirmPayModal');
    var allSuccess = results.every(function(r) { return r.success; });
    if (allSuccess) {
      showPaymentSuccess(user, selectedOrders, totalAmount, false);
      adminPaymentData = adminPaymentData.filter(function(u) { return u.userId !== confirmPayUserId; });
      delete paymentSelections[confirmPayUserId];
    } else {
      var err = results.find(function(r) { return !r.success; });
      showToast('❌ ' + ((err && err.error) || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function(err) {
    hideLoading();
    hideModal('confirmPayModal');
    showToast('❌ เกิดข้อผิดพลาด: ' + (err.message || err));
  });
}

function showPaymentSuccess(user, orders, totalAmount, isDeposit) {
  var listEl = document.getElementById('admin-pay-list');
  var title = isDeposit ? '💰 คืนเงินมัดจำเรียบร้อย' : '💰 โอนเงินคืนเรียบร้อย';
  var colorClass = isDeposit ? 'blue' : '';
  var html = '<div class="pay-success"><div class="s-icon">✅</div><div class="s-title">โอนเงินสำเร็จ!</div>';
  html += '<div class="s-sub">ส่งแจ้งเตือนให้ <strong>' + user.displayName + '</strong> แล้ว<br>ยอด ฿' + numberFormat(totalAmount) + ' • ' + orders.length + ' รายการ</div>';
  html += '<div class="s-preview"><div class="s-preview-label">📱 Flex Message ที่ส่งให้ลูกค้า</div>';
  html += '<div class="s-preview-bubble"><div class="sp-hdr ' + colorClass + '"><div class="sp-shop">🏪 JAN&ME</div><div class="sp-title">' + title + '</div></div>';
  html += '<div style="font-size:12px;font-weight:600;margin-bottom:2px;">👤 ' + user.displayName + '</div>';
  html += '<div style="font-size:11px;color:var(--txt3);margin-bottom:8px;">🏦 ' + (user.bankName || '-') + ' ' + (user.bankAccount || '') + '</div>';
  orders.forEach(function(o) {
    html += '<div class="sp-row"><span style="color:var(--accent);">#' + o.orderId + '</span><span>฿' + numberFormat(o.amount) + '</span></div>';
  });
  html += '<div class="sp-total"><span>💵 ยอดโอนรวม</span><span class="' + (isDeposit ? 'blue' : 'green') + '">฿' + numberFormat(totalAmount) + '</span></div>';
  html += '</div></div>';
  html += '<button class="btn-back-list" onclick="backToPaymentList()">👈 กลับหน้ารายการ</button></div>';
  listEl.innerHTML = html;
  document.getElementById('admin-pay-summary').innerHTML = '';
}

function backToPaymentList() { renderAdminPayments(); }

function exportPaymentsCSV() {
  if (adminPaymentData.length === 0) { showToast('ไม่มีข้อมูล'); return; }

  // Sort by BANK_ID ascending, users without BANK_ID go to end
  var sorted = adminPaymentData.slice().sort(function(a, b) {
    var aId = (a.bankId || '').toString().trim();
    var bId = (b.bankId || '').toString().trim();
    if (aId === '' && bId === '') return 0;
    if (aId === '') return 1;
    if (bId === '') return -1;
    return aId.localeCompare(bId);
  });

  var rows = [];
  for (var g = 0; g < sorted.length; g += 10) {
    var chunk = sorted.slice(g, g + 10);
    var groupNum = Math.floor(g / 10) + 1;
    var startIdx = g + 1;
    var endIdx = Math.min(g + 10, sorted.length);

    // คำนวณ sum ของกลุ่มนี้ก่อน
    var groupSum = 0;
    chunk.forEach(function(user) {
      var selected = paymentSelections[user.userId] || new Set();
      user.orders.forEach(function(o) {
        if (selected.size === 0 || selected.has(o.orderId)) groupSum += parseFloat(o.amount) || 0;
      });
    });

    // เว้นบรรทัดระหว่างกลุ่ม
    if (rows.length > 0) rows.push('');
    rows.push('ลำดับ,ชื่อ,ธนาคาร,เลขบัญชี,ชื่อบัญชี,เบอร์โทร,BANK_ID,ยอดโอน');
    rows.push('"--- กลุ่มที่ ' + groupNum + ' (' + startIdx + '-' + endIdx + ') รวม ' + chunk.length + ' คน ---",,,,,,"ยอดรวม",' + groupSum.toFixed(2));

    chunk.forEach(function(user, ci) {
      var selected = paymentSelections[user.userId] || new Set();
      var total = 0;
      user.orders.forEach(function(o) {
        if (selected.size === 0 || selected.has(o.orderId)) total += parseFloat(o.amount) || 0;
      });
      var acct = String(user.bankAccount || '').replace(/[\s\-]/g, '').replace(/[^0-9]/g, '');
      var phone = String(user.phone || '').replace(/[^0-9]/g, '');
      if (phone.length === 9) phone = '0' + phone;
      rows.push(
        (g + ci + 1) + ',' +
        '"' + (user.displayName || '') + '",' +
        '"' + (user.bankName || '') + '",' +
        '="' + acct + '",' +
        '"' + (user.accountName || '') + '",' +
        '="' + phone + '",' +
        '"' + (user.bankId || '') + '",' +
        total.toFixed(2)
      );
    });
  }

  var csv = '\uFEFF' + rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'transfer_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 Export สำเร็จ ' + sorted.length + ' รายการ');
}

function bulkApproveAll() {
  if (adminPaymentData.length === 0) { showToast('ไม่มีรายการ'); return; }

  var totalUsers = adminPaymentData.length;
  var totalAmt = 0;
  adminPaymentData.forEach(function(u) {
    u.orders.forEach(function(o) { totalAmt += parseFloat(o.amount) || 0; });
  });

  if (!confirm('✅ Bulk Approved\n\nจะยืนยันโอนเงินทั้งหมด ' + totalUsers + ' คน\nยอดรวม ฿' + numberFormat(totalAmt) + '\n\nดำเนินการต่อ?')) return;

  showLoading('กำลังอนุมัติ 0/' + totalUsers + '...');

  var idx = 0;
  var errors = [];
  var snapshot = adminPaymentData.slice(); // snapshot ก่อน loop

  function processNext() {
    if (idx >= snapshot.length) {
      hideLoading();
      adminPaymentData = [];
      paymentSelections = {};
      renderAdminPayments();
      var msg = errors.length === 0
        ? '✅ Bulk Approved สำเร็จ ' + totalUsers + ' คน'
        : '⚠️ สำเร็จ ' + (totalUsers - errors.length) + '/' + totalUsers + ' คน';
      showToast(msg);
      return;
    }
    var user = snapshot[idx];
    idx++;
    showLoading('กำลังอนุมัติ ' + idx + '/' + totalUsers + '...');

    var selected = paymentSelections[user.userId] || new Set();
    var orders = selected.size > 0
      ? user.orders.filter(function(o) { return selected.has(o.orderId); })
      : user.orders;
    var refundOrders = orders.filter(function(o) { return o.type !== 'deposit'; });
    var depositOrders = orders.filter(function(o) { return o.type === 'deposit'; });
    var promises = [];
    if (refundOrders.length > 0) {
      promises.push(apiCall('adminConfirmPayment', {
        targetUserId: user.userId,
        orderIds: refundOrders.map(function(o) { return o.orderId; }).join(','),
        totalAmount: refundOrders.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0),
        type: 'refund'
      }));
    }
    if (depositOrders.length > 0) {
      promises.push(apiCall('adminConfirmPayment', {
        targetUserId: user.userId,
        orderIds: depositOrders.map(function(o) { return o.orderId; }).join(','),
        totalAmount: depositOrders.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0),
        type: 'deposit'
      }));
    }
    Promise.all(promises).then(function() {
      processNext();
    }).catch(function() {
      errors.push(user.userId);
      processNext();
    });
  }

  processNext();
}

// ===== ADMIN DEPOSIT RETURNS =====
function loadAdminDepositReturns() {
  var container = document.getElementById('admin-deposit-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('adminGetDepositReturns').then(function(data) {
    if (!data.success) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    renderAdminDepositReturns(data.submissions || []);
  });
}

function getBaseSubId_(id) {
  var m = id.match(/^(DR_\d{8}_\d{6})(?:_\d+)?$/);
  return m ? m[1] : id;
}

function renderAdminDepositReturns(items) {
  var container = document.getElementById('admin-deposit-list');

  var groups = {};
  var groupOrder = [];
  items.forEach(function(item) {
    var base = getBaseSubId_(item.submissionId);
    if (!groups[base]) {
      groups[base] = { items: [], base: base };
      groupOrder.push(base);
    }
    groups[base].items.push(item);
  });

  var pendingGroups = groupOrder.filter(function(g) { return groups[g].items[0].status === 'Pending'; }).length;
  var html = '<div class="summary-row" style="margin-bottom:15px;">';
  html += '<div class="summary-card pending"><div class="summary-label">ทั้งหมด</div><div class="summary-value" style="color:var(--txt);">' + groupOrder.length + '</div></div>';
  html += '<div class="summary-card deposit"><div class="summary-label">Pending</div><div class="summary-value" style="color:var(--amber);">' + pendingGroups + '</div></div>';
  html += '</div>';

  if (groupOrder.length === 0) {
    html += '<div class="empty-state"><div class="icon">📦</div><p>ไม่มีรายการส่งคืนมัดจำ</p></div>';
    container.innerHTML = html;
    return;
  }

  groupOrder.forEach(function(base) {
    var group = groups[base].items;
    var first = group[0];
    var isPending = first.status === 'Pending';
    var isApproved = first.status === 'Approved';
    var isRejected = first.status === 'Rejected';
    var statusColor = isPending ? 'var(--amber)' : isApproved ? 'var(--green)' : 'var(--red)';
    var statusIcon = isPending ? '⏳' : isApproved ? '✅' : '❌';
    var totalDep = 0;
    var allSubIds = [];
    group.forEach(function(g) { totalDep += parseFloat(g.depositAmount) || 0; allSubIds.push(g.submissionId); });
    var itemCount = group.length;
    var allSubIdsStr = allSubIds.join(',');

    html += '<div class="adr-card">';
    html += '<div class="adr-header">';
    if (first.profileUrl) html += '<img src="' + first.profileUrl + '" class="adr-avatar" onerror="this.style.display=\'none\'">';
    html += '<div class="adr-user"><div class="adr-name">' + (first.displayName || 'Unknown') + '</div>';
    html += '<div class="adr-time">⏰ ' + (first.submittedAt || '') + '</div></div>';
    html += '<div class="adr-right"><div class="adr-amount">฿' + numberFormat(totalDep) + '<span class="adr-count">' + itemCount + '</span></div>';
    html += '<div class="adr-status" style="color:' + statusColor + '">' + statusIcon + ' ' + first.status + '</div></div>';
    html += '</div>';

    html += '<div class="adr-body">';
    html += '<div class="adr-orders">';
    group.forEach(function(g) {
      var os = (g.orderStatus || '').toLowerCase();
      var isCompleted = os === 'completed';
      html += '<div class="adr-order-row">';
      html += '<div><div class="adr-oid">' + g.orderId + '</div>';
      if (g.shopeeId) html += '<div class="adr-shop">🏪 ' + g.shopeeId + '</div>';
      if (g.orderStatus && !isCompleted) html += '<div class="adr-shop" style="color:#e67e22;font-weight:600">⚠️ ' + g.orderStatus + ' (ยังไม่ Completed)</div>';
      html += '</div>';
      html += '<div class="adr-dep">฿' + numberFormat(g.depositAmount || 0) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    var photos = first.productPhotos || [];
    var tracks = first.trackingPhotos || [];
    html += '<div class="adr-photos">';
    photos.forEach(function(url, idx) {
      if (url) {
        var fid = url.match(/[-\w]{25,}/);
        var viewUrl = fid ? 'https://drive.google.com/file/d/' + fid[0] + '/view' : url;
        html += '<a href="' + viewUrl + '" target="_blank" class="adr-photo-btn product">📷 รูปสินค้า ' + (idx + 1) + '</a>';
      }
    });
    tracks.forEach(function(url, idx) {
      if (url) {
        var fid = url.match(/[-\w]{25,}/);
        var viewUrl = fid ? 'https://drive.google.com/file/d/' + fid[0] + '/view' : url;
        html += '<a href="' + viewUrl + '" target="_blank" class="adr-photo-btn tracking">🚚 Tracking ' + (idx + 1) + '</a>';
      }
    });
    html += '</div>';

    if (first.note) {
      html += '<div class="adr-note">💬 ' + first.note + '</div>';
    }

    if (isPending) {
      html += '<div class="adr-actions">';
      html += '<button class="btn-approve" onclick="adminReviewDeposit(\'' + allSubIdsStr + '\',\'approve\')">✅ Approve</button>';
      html += '<button class="btn-reject" onclick="promptRejectDeposit(\'' + allSubIdsStr + '\')">❌ Reject</button>';
      html += '</div>';
    }
    if (isRejected && first.adminNote) {
      html += '<div class="adr-result" style="background:var(--red-soft);color:var(--red);">💬 เหตุผล: ' + first.adminNote + '</div>';
    }
    if (isApproved) {
      html += '<div class="adr-result" style="background:var(--green-soft);color:var(--green);">✅ อนุมัติโดย ' + (first.reviewedBy || '') + ' เมื่อ ' + (first.reviewedAt || '') + '</div>';
    }

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function adminReviewDeposit(submissionIds, action) {
  showLoading('กำลังดำเนินการ...');
  apiCall('adminReviewDeposit', { submissionId: submissionIds, reviewAction: action }).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast(action === 'approve' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว');
      loadAdminDepositReturns();
    } else {
      showToast('❌ ' + (data.error || 'Error'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

function promptRejectDeposit(submissionIds) {
  var reason = prompt('เหตุผลที่ปฏิเสธ:');
  if (reason === null) return;
  showLoading('กำลังดำเนินการ...');
  apiCall('adminReviewDeposit', { submissionId: submissionIds, reviewAction: 'reject', adminNote: reason }).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('❌ ปฏิเสธแล้ว');
      loadAdminDepositReturns();
    } else {
      showToast('❌ ' + (data.error || 'Error'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

// ===== ADMIN DASHBOARD =====
function loadAdminDashboard() {
  var container = document.getElementById('admin-dashboard-content');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('adminGetDashboard').then(function(data) {
    if (!data.success) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    renderAdminDashboard(data);
  }).catch(function() {
    container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>เกิดข้อผิดพลาด</p></div>';
  });
}

function renderAdminDashboard(data) {
  _dashData = data;
  var r = data.revenue || {};
  var o = data.outstanding || {};
  var ord = data.orders || {};
  var u = data.users || {};
  var top = data.topShoppers || [];
  var container = document.getElementById('admin-dashboard-content');

  var html = '';

  html += '<div style="text-align:right;margin-bottom:12px">';
  html += '<button class="dash-share-btn" onclick="shareDashboardFlex()">📤 แชร์สรุป</button>';
  html += '</div>';

  html += '<div class="dash-section">';
  html += '<div class="dash-title">💰 รายได้</div>';
  html += '<div class="dash-grid">';
  html += dashCard('ยอดขายรวม', r.totalSales, 'green', '💰');
  html += dashCard('กำไรจริง', r.netProfit, 'accent', '📈');
  var feePct = r.feeRate ? Math.round(r.feeRate * 100) : 22;
  html += '<div class="dash-card red" style="position:relative;">' +
    '<button onclick="openFeeSettings(' + feePct + ')" style="position:absolute;top:6px;right:6px;background:none;border:none;font-size:16px;cursor:pointer;opacity:0.6;">⚙️</button>' +
    '<div class="dash-card-icon">🏷️</div>' +
    '<div class="dash-card-value">฿' + numberFormat(r.platformFee || 0) + '</div>' +
    '<div class="dash-card-label">ค่าธรรมเนียม (' + feePct + '%)</div>' +
    '</div>';
  html += dashCard('ยอดโอนคืน', r.totalRefund, 'blue', '💸');
  html += '</div></div>';

  html += '<div class="dash-section">';
  html += '<div class="dash-title">⏳ ยอดค้างจ่าย</div>';
  html += '<div class="dash-grid three">';
  html += dashCard('รอโอนคืน', o.pendingRefund, 'amber', '💸');
  html += dashCard('รอคืนมัดจำ', o.pendingDeposit, 'amber', '📦');
  html += dashCard('รวมค้างจ่าย', o.totalOutstanding, 'red', '🔴');
  html += '</div></div>';

  html += '<div class="dash-section">';
  html += '<div class="dash-title">📋 คำสั่งซื้อ</div>';
  html += '<div class="dash-stats-row">';
  html += '<div class="dash-stat-main"><span class="dash-stat-num">' + ord.total + '</span><span class="dash-stat-lbl">ทั้งหมด</span></div>';
  html += '<div class="dash-stat-main"><span class="dash-stat-num">฿' + numberFormat(ord.avgOrderValue) + '</span><span class="dash-stat-lbl">เฉลี่ย/ออเดอร์</span></div>';
  html += '</div>';

  var statuses = [
    { label: 'Completed', count: ord.completed, color: 'var(--green)' },
    { label: 'Transferred', count: ord.transferred, color: 'var(--blue)' },
    { label: 'Transferring', count: ord.transferring, color: 'var(--purple)' },
    { label: 'Pending', count: ord.pending, color: 'var(--amber)' },
    { label: 'Canceled', count: ord.canceled, color: 'var(--red)' },
    { label: 'Incorrect', count: ord.incorrect, color: 'var(--txt3)' },
    { label: 'Ambiguous', count: ord.ambiguous, color: 'var(--txt3)' }
  ];
  if (ord.investigating > 0) {
    statuses.push({ label: 'Investigating', count: ord.investigating, color: 'var(--amber)' });
  }

  html += '<div class="dash-bars">';
  statuses.forEach(function(s) {
    if (s.count === 0) return;
    var pct = ord.total > 0 ? Math.round(s.count / ord.total * 100) : 0;
    html += '<div class="dash-bar-row">';
    html += '<div class="dash-bar-label">' + s.label + '</div>';
    html += '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div>';
    html += '<div class="dash-bar-val">' + s.count + ' <span class="dash-bar-pct">(' + pct + '%)</span></div>';
    html += '</div>';
  });
  html += '</div></div>';

  html += '<div class="dash-section">';
  html += '<div class="dash-title">👥 สมาชิก</div>';
  html += '<div class="dash-grid">';
  html += dashCardSmall('ทั้งหมด', u.total, 'var(--txt)');
  html += dashCardSmall('Active', u.active, 'var(--green)');
  html += dashCardSmall('รอ Approve', u.pendingApproval, 'var(--amber)');
  html += dashCardSmall('Blocked', u.blocked, 'var(--red)');
  html += '</div></div>';

  if (top.length > 0) {
    html += '<div class="dash-section">';
    html += '<div class="dash-title">🏆 ลูกค้าดีเด่น (Top 5)</div>';
    html += '<div class="dash-rank-list">';
    top.forEach(function(s, idx) {
      var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '　';
      html += '<div class="dash-rank-item">';
      html += '<div class="dash-rank-pos">' + medal + '</div>';
      if (s.profileUrl) {
        html += '<img src="' + s.profileUrl + '" class="dash-rank-avatar" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div class="dash-rank-avatar-placeholder">👤</div>';
      }
      html += '<div class="dash-rank-info">';
      html += '<div class="dash-rank-name">' + (s.displayName || 'Unknown') + '</div>';
      html += '<div class="dash-rank-meta">' + s.orderCount + ' orders</div>';
      html += '</div>';
      html += '<div class="dash-rank-amount">฿' + numberFormat(s.totalSpent) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  container.innerHTML = html;
}

function dashCard(label, value, colorClass, icon) {
  return '<div class="dash-card ' + colorClass + '">' +
    '<div class="dash-card-icon">' + icon + '</div>' +
    '<div class="dash-card-value">฿' + numberFormat(value || 0) + '</div>' +
    '<div class="dash-card-label">' + label + '</div>' +
    '</div>';
}

function dashCardSmall(label, value, color) {
  return '<div class="dash-card-sm">' +
    '<div class="dash-card-sm-val" style="color:' + color + '">' + (value || 0) + '</div>' +
    '<div class="dash-card-sm-lbl">' + label + '</div>' +
    '</div>';
}

// ===== FEE SETTINGS =====
function openFeeSettings(currentPct) {
  document.getElementById('feeRateInput').value = currentPct;
  showModal('feeSettingsModal');
}

function saveFeeRate() {
  var pct = parseFloat(document.getElementById('feeRateInput').value);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    showToast('กรุณากรอกค่า 0-100');
    return;
  }
  hideModal('feeSettingsModal');
  showLoading('กำลังบันทึก...');
  apiCall('adminSetPlatformFee', { feeRate: pct }).then(function(res) {
    hideLoading();
    if (res.success) {
      showToast('บันทึกค่าธรรมเนียม ' + pct + '% แล้ว');
      loadAdminDashboard();
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด');
    }
  });
}

// ===== SHARE DASHBOARD FLEX =====
function shareDashboardFlex() {
  if (!_dashData) {
    showToast('ยังไม่มีข้อมูล');
    return;
  }
  var flexMsg = buildDashboardFlex_(_dashData);
  liff.shareTargetPicker([flexMsg]).then(function(res) {
    if (res) showToast('✅ แชร์สำเร็จ');
  }).catch(function(err) {
    var msg = (err && err.message) || '';
    if (msg.indexOf('not available') > -1 || msg.indexOf('client') > -1) {
      showToast('กรุณาเปิดใน LINE app เพื่อแชร์');
    } else {
      showToast('❌ แชร์ไม่สำเร็จ: ' + msg);
    }
  });
}

function buildDashboardFlex_(data) {
  var r = data.revenue || {};
  var o = data.outstanding || {};
  var ord = data.orders || {};
  var u = data.users || {};

  function fmt(n) {
    return Number(n || 0).toLocaleString();
  }

  function flexRow(label, value, bold, valueColor) {
    return {
      type: 'box', layout: 'horizontal', margin: 'sm',
      contents: [
        { type: 'text', text: label, size: 'sm', color: bold ? '#1a1a1a' : '#8c8c8c', weight: bold ? 'bold' : 'regular', flex: 5, wrap: true },
        { type: 'text', text: String(value), size: 'sm', color: valueColor || '#1a1a1a', weight: bold ? 'bold' : 'regular', align: 'end', flex: 4, wrap: true }
      ]
    };
  }

  // Thai date
  var now = new Date();
  var thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var dd = now.getDate();
  var mm = now.getMonth();
  var yyyy = now.getFullYear() + 543;
  var dateStr = dd + ' ' + thaiMonths[mm] + ' ' + yyyy;

  var bodyContents = [];

  // === รายได้ ===
  bodyContents.push({ type: 'text', text: '💰 รายได้', size: 'sm', weight: 'bold', color: '#1a1a1a', margin: 'none' });
  bodyContents.push(flexRow('ยอดขายรวม', '฿' + fmt(r.totalSales)));
  var flexFeePct = r.feeRate ? Math.round(r.feeRate * 100) : 22;
  bodyContents.push(flexRow('ค่าธรรมเนียม (' + flexFeePct + '%)', '-฿' + fmt(r.platformFee), false, '#E53935'));
  bodyContents.push(flexRow('ยอดโอนคืน', '-฿' + fmt(r.totalRefund), false, '#E53935'));
  bodyContents.push({ type: 'separator', margin: 'md' });
  bodyContents.push(flexRow('📈 กำไรจริง', '฿' + fmt(r.netProfit), true, '#27AE60'));

  bodyContents.push({ type: 'separator', margin: 'lg' });

  // === ค้างจ่าย ===
  bodyContents.push({ type: 'text', text: '⏳ ค้างจ่าย', size: 'sm', weight: 'bold', color: '#1a1a1a', margin: 'md' });
  bodyContents.push(flexRow('รอโอนคืน', '฿' + fmt(o.pendingRefund)));
  bodyContents.push(flexRow('รอคืนมัดจำ', '฿' + fmt(o.pendingDeposit)));
  bodyContents.push({ type: 'separator', margin: 'md' });
  bodyContents.push(flexRow('🔴 รวมค้างจ่าย', '฿' + fmt(o.totalOutstanding), true, '#E53935'));

  bodyContents.push({ type: 'separator', margin: 'lg' });

  // === คำสั่งซื้อ ===
  bodyContents.push({ type: 'text', text: '📋 คำสั่งซื้อ ' + ord.total + ' รายการ', size: 'sm', weight: 'bold', color: '#1a1a1a', margin: 'md' });
  var statusLine = '✅ ' + ord.completed + '  🔄 ' + ord.transferring + '  💜 ' + ord.transferred;
  bodyContents.push({ type: 'text', text: statusLine, size: 'xs', color: '#555555', margin: 'sm', wrap: true });
  var statusLine2 = '⏳ ' + ord.pending + '  ❌ ' + ord.canceled + '  ❓ ' + ord.incorrect;
  bodyContents.push({ type: 'text', text: statusLine2, size: 'xs', color: '#555555', margin: 'xs', wrap: true });
  bodyContents.push({ type: 'text', text: 'เฉลี่ย ฿' + fmt(ord.avgOrderValue) + '/ออเดอร์', size: 'xs', color: '#8c8c8c', margin: 'sm' });

  bodyContents.push({ type: 'separator', margin: 'lg' });

  // === สมาชิก ===
  bodyContents.push({ type: 'text', text: '👥 สมาชิก ' + u.total + ' คน', size: 'sm', weight: 'bold', color: '#1a1a1a', margin: 'md' });
  bodyContents.push({ type: 'text', text: 'Active ' + u.active + ' • รอ Approve ' + u.pendingApproval + ' • Blocked ' + u.blocked, size: 'xs', color: '#555555', margin: 'sm', wrap: true });

  var bubble = {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'box', layout: 'vertical',
      contents: [
        { type: 'text', text: '📊', size: 'xxl', align: 'center' },
        { type: 'text', text: 'สรุปผลงาน JAN&ME', color: '#ffffff', size: 'lg', weight: 'bold', align: 'center', margin: 'sm' },
        { type: 'text', text: dateStr, color: '#B2C5FF', size: 'xs', align: 'center', margin: 'sm' }
      ],
      background: {
        type: 'linearGradient',
        angle: '135deg',
        startColor: '#6C5CE7',
        endColor: '#74B9FF',
        centerColor: '#0984E3'
      },
      paddingAll: '24px',
      paddingBottom: '20px',
      alignItems: 'center',
      justifyContent: 'center'
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '18px',
      contents: bodyContents
    }
  };

  return {
    type: 'flex',
    altText: '📊 สรุปผลงาน JAN&ME - ' + dateStr,
    contents: bubble
  };
}

// ===== SIMULATE USER =====
var simulateUsersCache = null;
var simulateCurrentUserId = null;
var simulateOrders = [];

function loadSimulate() {
  var selectorEl = document.getElementById('admin-simulate-selector');
  var viewEl = document.getElementById('admin-simulate-view');
  viewEl.innerHTML = '';

  if (simulateUsersCache) {
    renderSimulateSelector(simulateUsersCache);
    return;
  }

  selectorEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('adminGetUsers').then(function(data) {
    if (!data.success) {
      selectorEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    simulateUsersCache = (data.users || []).filter(function(u) { return u.approved && !u.blocked; });
    renderSimulateSelector(simulateUsersCache);
  });
}

function renderSimulateSelector(users) {
  var selectorEl = document.getElementById('admin-simulate-selector');
  var html = '<div class="sim-selector">';
  html += '<label style="font-weight:700;font-size:14px;margin-bottom:8px;display:block;">🔍 เลือก User เพื่อดู View</label>';
  html += '<select id="sim-user-select" onchange="onSimulateUserSelect()" class="sim-select">';
  html += '<option value="">-- เลือก User --</option>';
  users.forEach(function(u) {
    html += '<option value="' + u.userId + '">' + u.displayName + '</option>';
  });
  html += '</select></div>';
  selectorEl.innerHTML = html;
}

function onSimulateUserSelect() {
  var sel = document.getElementById('sim-user-select');
  if (!sel || !sel.value) {
    document.getElementById('admin-simulate-view').innerHTML = '';
    return;
  }
  simulateUser(sel.value);
}

function simulateUser(targetUserId) {
  simulateCurrentUserId = targetUserId;
  var viewEl = document.getElementById('admin-simulate-view');
  viewEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลดข้อมูล...</p></div>';

  Promise.all([
    apiCall('adminSimulateUser', { targetUserId: targetUserId }),
    apiCall('getTransferHistory', { targetUserId: targetUserId })
  ]).then(function(results) {
    var data = results[0];
    var transferData = results[1];
    if (!data.success) {
      viewEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    data.transfers = (transferData && transferData.success ? transferData.transfers : []) || [];
    renderSimulateView(data);
  }).catch(function(err) {
    viewEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>เกิดข้อผิดพลาด</p></div>';
  });
}

function renderSimulateView(data) {
  var viewEl = document.getElementById('admin-simulate-view');
  var user = data.user || {};
  var shopeeIds = data.shopeeIds || [];
  var orders = data.orders || [];
  simulateOrders = orders;

  var html = '';

  // Profile card
  html += '<div class="sim-profile-card">';
  html += '<div class="sim-profile-header">';
  if (user.profileUrl) html += '<img src="' + user.profileUrl + '" class="sim-avatar" onerror="this.style.display=\'none\'">';
  html += '<div class="sim-profile-info">';
  html += '<div class="sim-name">' + (user.displayName || 'Unknown') + '</div>';
  var statusText = user.blocked ? '🚫 Blocked' : user.approved ? '✅ Active' : '⏳ Pending';
  var statusColor = user.blocked ? 'var(--red)' : user.approved ? 'var(--green)' : 'var(--amber)';
  html += '<div style="font-size:12px;color:' + statusColor + ';font-weight:600;">' + statusText + '</div>';
  html += '</div></div>';
  if (user.bankName) {
    html += '<div class="sim-bank">🏦 ' + user.bankName + ' ' + (user.bankAccount || '') + ' (' + (user.accountName || '') + ')</div>';
  }
  if (user.phone) html += '<div class="sim-bank">📞 ' + user.phone + '</div>';
  html += '<div style="font-size:9px;color:var(--txt3);font-family:monospace;margin-top:4px;word-break:break-all;">' + (user.userId || '') + '</div>';
  html += '</div>';

  // Financial summary (เหมือน user เห็น — 3-group layout)
  var totalRefund = data.totalRefund || 0;
  var totalDeposit = data.totalDeposit || 0;
  var expectedRefund = data.expectedRefund || 0;
  var pendingDep = data.pendingDeposit || 0;
  var allRefund = totalRefund + expectedRefund;
  var allDeposit = totalDeposit + pendingDep;
  var combined = allRefund + allDeposit;
  var refPaid = data.totalRefundPaid || 0;
  var depReturned = data.totalDepositReturned || 0;
  var totalReceived = refPaid + depReturned;

  // Group 1: Hero Card - รวมยอดรอรับ (รวม expected ด้วย)
  html += '<div class="fin-hero">';
  html += '<div class="fin-hero-top"><span class="fin-hero-icon">💰</span><span class="fin-hero-label">รวมยอดรอรับ</span></div>';
  html += '<div class="fin-hero-value">฿' + numberFormat(combined) + '</div>';
  html += '<div class="fin-hero-detail">ยอดคืน ฿' + numberFormat(allRefund) + ' + มัดจำ ฿' + numberFormat(allDeposit) + '</div>';
  html += '</div>';

  // Group 2: Forecast
  html += '<div class="fin-grid">';
  html += '<div class="fin-box expect"><div class="fin-top"><span class="fin-icon">📋</span><span class="fin-label">คาดว่าจะได้รับ</span></div><div class="fin-value">฿' + numberFormat(expectedRefund) + '</div></div>';
  html += '<div class="fin-box expect"><div class="fin-top"><span class="fin-icon">📦</span><span class="fin-label">คาดมัดจำ</span></div><div class="fin-value">฿' + numberFormat(pendingDep) + '</div></div>';
  html += '</div>';

  // Group 3: History - ได้รับแล้ว
  html += '<div class="fin-history" onclick="showSimPaidHistory()" style="cursor:pointer;">';
  html += '<div class="fin-history-top"><span class="fin-history-icon">✅</span><span class="fin-history-label">ได้รับแล้วทั้งหมด</span></div>';
  html += '<div class="fin-history-value">฿' + numberFormat(totalReceived) + '</div>';
  html += '<div class="fin-history-detail">คืนเงิน ฿' + numberFormat(refPaid) + ' + มัดจำ ฿' + numberFormat(depReturned) + '</div>';
  html += '</div>';

  // Shopee IDs
  if (shopeeIds.length > 0) {
    html += '<div class="sim-section">';
    html += '<div class="sim-section-title">🏪 Shopee ID (' + shopeeIds.length + ')</div>';
    shopeeIds.forEach(function(s) {
      html += '<div class="sim-shopee-row">';
      html += '<div><span style="font-weight:700;">' + s.shopeeId + '</span></div>';
      html += '<div style="font-size:11px;color:var(--txt3);">' + (s.totalOrders || 0) + ' orders / ' + (s.paidOrders || 0) + ' paid</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Transfer history (grouped by date)
  var transfers = data.transfers || [];
  if (transfers.length > 0) {
    // Build orderId → amounts map
    var orderMap = {};
    orders.forEach(function(o) {
      orderMap[o.orderId] = { refund: parseFloat(o.refundAmount) || 0, deposit: parseFloat(o.depositAmount) || 0 };
    });

    html += '<div class="sim-section">';
    html += '<div class="sim-section-title">💸 ประวัติโอนเงิน (' + transfers.length + ' ครั้ง)</div>';
    transfers.forEach(function(t) {
      var icon = t.type === 'deposit' ? '🔄' : '💸';
      var label = t.type === 'deposit' ? 'โอนมัดจำคืน' : 'โอนคืนเงิน';
      var dateStr = formatDateTime(t.timestamp);
      var orderList = String(t.orders || '').split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });

      html += '<div style="padding:10px 0;border-bottom:1px solid var(--border-s);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-size:12px;font-weight:700;">' + icon + ' ' + label + ' ' + dateStr + '</span>';
      html += '<span style="font-size:13px;font-weight:700;color:var(--green);">฿' + numberFormat(t.amount) + '</span>';
      html += '</div>';
      for (var j = 0; j < orderList.length; j++) {
        var oid = orderList[j];
        var amt = orderMap[oid] ? (t.type === 'deposit' ? orderMap[oid].deposit : orderMap[oid].refund) : 0;
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt2);margin-top:3px;padding-left:8px;">';
        html += '<span>' + (j + 1) + '. ' + oid + '</span>';
        html += '<span style="font-weight:600;">฿' + numberFormat(amt) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // Orders list
  html += '<div class="sim-section">';
  html += '<div class="sim-section-title">📋 Orders (' + orders.length + ')</div>';
  if (orders.length === 0) {
    html += '<div class="empty-state"><div class="icon">📭</div><p>ไม่มีรายการ</p></div>';
  } else {
    // Sort by status priority (same as user view)
    orders.sort(function(a, b) {
      return getStatusPriority(a.status) - getStatusPriority(b.status);
    });
    html += '<div class="orders-grid">';
    orders.forEach(function(order) {
      var statusClass = getStatusClass(order.status);
      var statusText2 = getStatusDisplay(order.status);
      var byClass = order.createdBy === 'ADMIN' ? 'admin' : 'user';
      var byText = order.createdBy === 'ADMIN' ? '🛒 Admin' : '👤 ตัวเอง';
      html += '<div class="order-card" onclick="showAdminOrderDetail(\'' + order.orderId + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;">';
      html += '<span class="order-id">' + order.orderId + '</span>';
      html += '<span class="order-status ' + statusClass + '">' + statusText2 + '</span>';
      html += '</div>';
      html += '<div class="order-amount">฿' + numberFormat(order.orderTotal || 0) + '</div>';
      html += '<div class="order-shopee" style="color:' + (order.shopeeId ? 'var(--txt3)' : 'var(--red)') + ';">🏪 ' + (order.shopeeId || '⚠️ รอระบุ') + '</div>';
      html += '<div class="order-time">' + formatDateTime(order.orderTime) + '</div>';
      html += '<div class="order-by ' + byClass + '">' + byText + '</div>';
      if (order.imageUrl) {
        html += '<div style="font-size:11px;color:var(--txt3);margin-top:2px;">📷 มีรูป</div>';
      }
      var simBadges = '';
      var simPaidR = order.paidRefund ? '✅' : '';
      var simPaidD = order.paidDeposit ? '✅' : '';
      if (parseFloat(order.refundAmount) > 0) simBadges += '<span style="font-size:9px;color:var(--green);">💰 ฿' + numberFormat(order.refundAmount) + simPaidR + '</span> ';
      if (parseFloat(order.depositAmount) > 0) simBadges += '<span style="font-size:9px;color:var(--blue);">📦 ฿' + numberFormat(order.depositAmount) + simPaidD + '</span>';
      if (simBadges) html += '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);">' + simBadges + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  viewEl.innerHTML = html;
}

function showSimPaidHistory() {
  if (!simulateCurrentUserId) return;
  apiCall('getTransferHistory', { targetUserId: simulateCurrentUserId }).then(function(data) {
    if (!data.success) { showToast('โหลดข้อมูลไม่สำเร็จ'); return; }
    renderTransferHistory(data.transfers || [], 'admin-order-modal-body', 'admin-order-modal-actions', '#adminOrderModal', 'adminOrderModal');
    showModal('adminOrderModal');
  });
}

// ===== ADMIN ORDERS =====
var adminOrderFilter = 'all';
var adminOrderPage = 1;
var adminStatusCounts = null;
var adminNameCounts = null;
var adminUserFilter = '';
var adminNoImageCount = null;

function loadAdminOrders(status, page) {
  adminOrderFilter = status || adminOrderFilter || 'all';
  adminOrderPage = page || 1;

  renderAdminOrdersFilter();

  var listEl = document.getElementById('admin-orders-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  document.getElementById('admin-orders-pagination').innerHTML = '';

  var params = { page: adminOrderPage };
  if (adminOrderFilter !== 'all') params.status = adminOrderFilter;
  if (adminUserFilter) params.filterUser = adminUserFilter;

  apiCall('adminGetOrders', params).then(function(data) {
    if (!data.success) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    if (data.statusCounts) {
      adminStatusCounts = data.statusCounts;
    }
    if (data.nameCounts) {
      adminNameCounts = data.nameCounts;
    }
    if (data.noImageCount !== undefined) {
      adminNoImageCount = data.noImageCount;
    }
    renderAdminOrdersFilter();
    renderAdminOrdersList(data);
  }).catch(function() {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>เกิดข้อผิดพลาด</p></div>';
  });
}

function renderAdminOrdersFilter() {
  var filterEl = document.getElementById('admin-orders-filter');
  var counts = adminStatusCounts || {};
  var totalAll = 0;
  for (var k in counts) { totalAll += counts[k]; }

  // Name filter dropdown
  var html = '';
  var nc = adminNameCounts || {};
  var nameKeys = Object.keys(nc);
  if (nameKeys.length > 0) {
    // sort by displayName
    nameKeys.sort(function(a, b) {
      var na = (nc[a].displayName || '').toLowerCase();
      var nb = (nc[b].displayName || '').toLowerCase();
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });
    html += '<select class="ao-name-filter" onchange="adminFilterByUser(this.value)">';
    html += '<option value="">👤 ทั้งหมด</option>';
    nameKeys.forEach(function(uid) {
      var sel = adminUserFilter === uid ? ' selected' : '';
      html += '<option value="' + uid + '"' + sel + '>' + (nc[uid].displayName || uid) + ' (' + nc[uid].count + ')</option>';
    });
    html += '</select>';
  }

  // Status filter buttons
  var statuses = [
    { key: 'all', label: 'ทั้งหมด', count: totalAll },
    { key: 'Completed', label: 'Completed' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Transferring', label: 'Transferring' },
    { key: 'Transferred', label: 'Transferred' },
    { key: 'Canceled', label: 'Canceled' },
    { key: 'Incorrect', label: 'Incorrect' },
    { key: 'Ambiguous', label: 'Ambiguous' },
    { key: 'Investigating', label: 'Investigating' },
    { key: 'New', label: 'New' },
    { key: 'Shipped', label: 'Shipped' },
    { key: 'Unpaid', label: 'Unpaid' },
    { key: 'no_image', label: '📷 ไม่มีรูป' }
  ];

  html += '<div class="admin-order-filters">';
  statuses.forEach(function(s) {
    var c = s.key === 'no_image' ? (adminNoImageCount || 0) : (s.count !== undefined ? s.count : (counts[s.key] || 0));
    var active = adminOrderFilter === s.key ? ' active' : '';
    html += '<button class="aof-btn' + active + '" onclick="adminFilterOrders(\'' + s.key + '\')">' + s.label + ' (' + c + ')</button>';
  });
  html += '</div>';
  filterEl.innerHTML = html;
}

function adminFilterOrders(status) {
  loadAdminOrders(status, 1);
}

function adminFilterByUser(userId) {
  adminUserFilter = userId;
  loadAdminOrders(null, 1);
}

function renderAdminOrdersList(data) {
  var listEl = document.getElementById('admin-orders-list');
  var orders = data.orders || [];

  if (orders.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>ไม่มีรายการ</p></div>';
    document.getElementById('admin-orders-pagination').innerHTML = '';
    return;
  }

  var html = '<div class="ao-summary" style="margin-bottom:12px;font-size:12px;color:var(--txt3);">รวม ' + data.total + ' รายการ (หน้า ' + data.page + '/' + data.totalPages + ')</div>';
  html += '<div class="ao-grid">';
  orders.forEach(function(order) {
    var statusClass = getStatusClass(order.status);
    var paidR = order.paidRefund ? '✅' : '';
    var paidD = order.paidDeposit ? '✅' : '';
    var displayName = order.displayName || '-';
    var st = (order.status || '').toLowerCase();

    // Card background color
    var cardBg = '';
    if (st === 'canceled' || st === 'cancelled') {
      cardBg = 'background:var(--red-soft);';
    } else if (st === 'investigating') {
      cardBg = 'background:var(--amber-soft);';
    } else if (st === 'transferred' && order.paidRefund && order.paidDeposit) {
      cardBg = 'background:#D5F5E3;';
    }

    // Voucher % circle
    var pct = 0;
    var pctHtml = '';
    var sub = parseFloat(order.subtotal) || 0;
    var vc = parseFloat(order.voucher) || 0;
    if (sub > 0 && vc > 0) {
      pct = Math.round((vc / sub) * 100);
      var pctColor = '#C9302C'; // red < 20%
      if (pct > 25) pctColor = '#0D6B3E';
      else if (pct > 22) pctColor = '#2ECC71';
      else if (pct > 20) pctColor = '#E67E22';
      pctHtml = '<div class="ao-pct-circle" style="border-color:' + pctColor + ';color:' + pctColor + ';">' + pct + '%</div>';
    }

    html += '<div class="order-card ao-card" style="' + cardBg + '" onclick="showAdminOrderDetail(\'' + order.orderId + '\')">';
    var camIcon = order.hasImage
      ? '<span style="color:var(--green);font-size:10px;" title="มีรูป">📷</span>'
      : '<span style="color:var(--red);opacity:0.5;font-size:10px;" title="ไม่มีรูป">📷</span>';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">';
    html += '<span class="order-id" style="font-size:10px;">' + camIcon + ' ' + order.orderId + '</span>';
    html += '<span class="order-status ' + statusClass + '" style="font-size:9px;">' + order.status + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;font-weight:600;color:var(--txt);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ' + displayName + '</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div class="order-amount" style="font-size:15px;">฿' + numberFormat(order.orderTotal || 0) + '</div>';
    html += '</div>';
    html += '<div style="font-size:9px;color:var(--txt3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏪 ' + (order.shopeeId || '-') + '</div>';
    var badges = '';
    if (order.refundAmount > 0) badges += '<span style="font-size:8px;color:var(--green);">💰' + numberFormat(order.refundAmount) + paidR + '</span> ';
    if (order.depositAmount > 0) badges += '<span style="font-size:8px;color:var(--blue);">📦' + numberFormat(order.depositAmount) + paidD + '</span>';
    if (badges) html += '<div style="margin-top:2px;">' + badges + '</div>';
    html += pctHtml;
    html += '</div>';
  });
  html += '</div>';

  listEl.innerHTML = html;

  // Pagination
  var pagEl = document.getElementById('admin-orders-pagination');
  if (data.totalPages <= 1) {
    pagEl.innerHTML = '';
    return;
  }
  var pagHtml = '<div class="ao-pagination">';
  if (data.page > 1) {
    pagHtml += '<button class="aof-btn" onclick="loadAdminOrders(null,' + (data.page - 1) + ')">← ก่อนหน้า</button>';
  }
  pagHtml += '<span class="ao-page-info">' + data.page + ' / ' + data.totalPages + '</span>';
  if (data.page < data.totalPages) {
    pagHtml += '<button class="aof-btn" onclick="loadAdminOrders(null,' + (data.page + 1) + ')">ถัดไป →</button>';
  }
  pagHtml += '</div>';
  pagEl.innerHTML = pagHtml;
}

// ===== ADMIN ORDER DETAIL MODAL =====
var adminEditOrderId = null;

function showAdminOrderDetail(orderId) {
  adminEditOrderId = orderId;
  var bodyEl = document.getElementById('admin-order-modal-body');
  var actEl = document.getElementById('admin-order-modal-actions');
  bodyEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  actEl.innerHTML = '';
  showModal('adminOrderModal');

  apiCall('getOrderDetail', { orderId: orderId }).then(function(data) {
    if (!data.success) {
      bodyEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'ไม่พบข้อมูล') + '</p></div>';
      actEl.innerHTML = '<button class="btn-cancel" onclick="hideModal(\'adminOrderModal\')">ปิด</button>';
      return;
    }
    renderAdminOrderDetail(data.order);
  }).catch(function() {
    bodyEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>เกิดข้อผิดพลาด</p></div>';
    actEl.innerHTML = '<button class="btn-cancel" onclick="hideModal(\'adminOrderModal\')">ปิด</button>';
  });
}

function renderAdminOrderDetail(order) {
  var bodyEl = document.getElementById('admin-order-modal-body');
  var actEl = document.getElementById('admin-order-modal-actions');

  var statuses = ['Completed', 'Pending', 'Transferring', 'Transferred', 'Canceled', 'Incorrect', 'Ambiguous', 'Investigating', 'New', 'Shipped', 'Unpaid'];

  var html = '';

  // Image link + Poke button
  if (order.imageUrl) {
    var viewUrl = order.imageUrl;
    if (viewUrl.indexOf('drive.google.com') !== -1) {
      var fileId = viewUrl.match(/[-\w]{25,}/);
      if (fileId) viewUrl = 'https://drive.google.com/file/d/' + fileId[0] + '/view';
    }
    html += '<a href="' + viewUrl + '" target="_blank" style="display:block;padding:10px;background:var(--txt);border-radius:var(--r-sm);text-align:center;text-decoration:none;color:white;font-weight:700;margin-bottom:8px;font-size:12px;">📷 ดูรูป Order</a>';
  }
  html += '<button class="aod-poke-btn" onclick="pokeOrderUser(\'' + (order.userId || '') + '\',\'' + order.orderId + '\')">📩 ขอรูป Order</button>';

  // Order info (read-only) — 2 columns
  html += '<div class="aod-field-row">';
  html += '<div class="aod-row half"><span class="aod-label">Order ID</span><span class="aod-value">' + order.orderId + '</span></div>';
  html += '<div class="aod-row half"><span class="aod-label">Order Time</span><span class="aod-value">' + formatDateTime(order.orderTime) + '</span></div>';
  html += '</div>';
  html += '<div class="aod-field-row">';
  html += '<div class="aod-row half"><span class="aod-label">Created By</span><span class="aod-value">' + (order.createdBy || '-') + '</span></div>';
  html += '<div class="aod-row half"><span class="aod-label">Last Edited</span><span class="aod-value">' + (order.lastEditedBy || '-') + '</span></div>';
  html += '</div>';

  html += '<div class="aod-divider"></div>';

  // Status + Shopee ID — 2 columns
  html += '<div class="aod-field-row">';
  html += '<div class="aod-field half"><label>Status</label><select id="aod-status">';
  statuses.forEach(function(s) {
    var sel = (order.status === s) ? ' selected' : '';
    html += '<option value="' + s + '"' + sel + '>' + s + '</option>';
  });
  html += '</select></div>';
  html += '<div class="aod-field half"><label>Shopee ID</label><input type="text" id="aod-shopeeId" value="' + (order.shopeeId || '') + '"></div>';
  html += '</div>';

  html += '<div class="aod-divider"></div>';
  html += '<div style="font-weight:700;font-size:12px;margin-bottom:8px;">💰 Financial</div>';

  // Row 1: Subtotal | Shipping | Ship Discount — 3 columns
  html += '<div class="aod-field-row">';
  html += '<div class="aod-field third"><label>Subtotal</label><input type="number" id="aod-subtotal" value="' + (order.subtotal || 0) + '" oninput="recalcRefundHint()"></div>';
  html += '<div class="aod-field third"><label>Shipping</label><input type="number" id="aod-shipping" value="' + (order.shipping || 0) + '" oninput="recalcRefundHint()"></div>';
  html += '<div class="aod-field third"><label>Ship Dis.</label><input type="number" id="aod-shippingDiscount" value="' + (order.shippingDiscount || 0) + '" oninput="recalcRefundHint()"></div>';
  html += '</div>';

  // Row 2: Voucher (xx%) | Order Total — 2 columns
  var voucherPct = (order.subtotal > 0) ? Math.round((order.voucher || 0) / order.subtotal * 100) : 0;
  html += '<div class="aod-field-row">';
  html += '<div class="aod-field half"><label>Voucher <span id="aod-voucher-pct" class="aod-pct-badge">(' + voucherPct + '%)</span></label><input type="number" id="aod-voucher" value="' + (order.voucher || 0) + '" oninput="recalcRefundHint()"></div>';
  html += '<div class="aod-field half"><label>Order Total</label><input type="number" id="aod-orderTotal" value="' + (order.orderTotal || 0) + '"></div>';
  html += '</div>';

  html += '<div class="aod-divider"></div>';
  html += '<div style="font-weight:700;font-size:12px;margin-bottom:8px;">💳 Refund & Deposit</div>';

  // Pre-fill refund if empty
  var refundVal = parseFloat(order.refundAmount) || 0;
  var depositVal = parseFloat(order.depositAmount) || 0;
  if (refundVal === 0) {
    refundVal = (parseFloat(order.subtotal) || 0) - (parseFloat(order.voucher) || 0) - depositVal;
    if (refundVal < 0) refundVal = 0;
  }

  // Refund | Deposit — 2 columns (editable)
  html += '<div class="aod-field-row">';
  html += '<div class="aod-field half"><label>Refund Amount</label><input type="number" id="aod-refundAmount" value="' + refundVal + '" oninput="recalcRefundHint()" style="border-color:var(--green);"></div>';
  html += '<div class="aod-field half"><label>Deposit Amount</label><input type="number" id="aod-depositAmount" value="' + depositVal + '" oninput="recalcRefundHint()" style="border-color:var(--blue);"></div>';
  html += '</div>';

  // Calculation hint
  var calcResult = (parseFloat(order.subtotal) || 0) - (parseFloat(order.voucher) || 0) - depositVal;
  html += '<div id="aod-refund-hint" class="aod-calc-hint">= ' + numberFormat(order.subtotal || 0) + ' - ' + numberFormat(order.voucher || 0) + ' - ' + numberFormat(depositVal) + ' = ฿' + numberFormat(calcResult) + '</div>';

  // Paid checkboxes — 2 columns
  html += '<div class="aod-field-row" style="margin-top:8px;">';
  var prChecked = order.paidRefund ? ' checked' : '';
  var pdChecked = order.paidDeposit ? ' checked' : '';
  html += '<div class="aod-check half"><label><input type="checkbox" id="aod-paidRefund"' + prChecked + '> จ่ายคืนแล้ว</label></div>';
  html += '<div class="aod-check half"><label><input type="checkbox" id="aod-paidDeposit"' + pdChecked + '> จ่ายมัดจำคืน</label></div>';
  html += '</div>';

  bodyEl.innerHTML = html;

  // Actions
  var actHtml = '<button class="btn-cancel" onclick="hideModal(\'adminOrderModal\')">← ยกเลิก</button>';
  actHtml += '<button class="btn-danger" onclick="confirmDeleteAdminOrder()" style="background:var(--red);color:white;border:none;border-radius:var(--r-xs);padding:10px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f-th);">🗑️ ลบ</button>';
  actHtml += '<button class="btn-confirm-green" onclick="saveAdminOrder()">💾 บันทึก</button>';
  actEl.innerHTML = actHtml;
}

// Poke — ส่งข้อความขอรูปไปหา user
function pokeOrderUser(userId, orderId) {
  if (!userId) { showToast('ไม่พบข้อมูลผู้ใช้'); return; }
  if (!confirm('📩 ส่งข้อความขอรูป Order ' + orderId + ' ไปหาลูกค้า?')) return;

  var msg = 'สวัสดีค่ะ ☺️\n'
    + 'รบกวนส่งรูปหลักฐาน Order: ' + orderId + '\n'
    + 'มาให้ทีมงานตรวจสอบด้วยนะคะ 📸\n\n'
    + '(ส่งรูปผ่านแชทนี้ได้เลยค่ะ)';

  apiCall('adminSendMessage', { targetUserId: userId, message: msg })
    .then(function(data) {
      if (data.success) showToast('✅ ส่งข้อความแล้ว');
      else showToast('❌ ' + (data.error || 'ส่งไม่สำเร็จ'));
    })
    .catch(function() { showToast('❌ เกิดข้อผิดพลาด'); });
}

// Auto-recalculate refund hint + voucher %
function recalcRefundHint() {
  var sub = parseFloat(document.getElementById('aod-subtotal').value) || 0;
  var ship = parseFloat(document.getElementById('aod-shipping').value) || 0;
  var shipDis = parseFloat(document.getElementById('aod-shippingDiscount').value) || 0;
  var voucher = parseFloat(document.getElementById('aod-voucher').value) || 0;
  var deposit = parseFloat(document.getElementById('aod-depositAmount').value) || 0;
  var calc = sub - voucher - deposit;

  var hintEl = document.getElementById('aod-refund-hint');
  if (hintEl) hintEl.textContent = '= ' + numberFormat(sub) + ' - ' + numberFormat(voucher) + ' - ' + numberFormat(deposit) + ' = ฿' + numberFormat(calc);

  var pctEl = document.getElementById('aod-voucher-pct');
  if (pctEl) {
    var pct = sub > 0 ? Math.round(voucher / sub * 100) : 0;
    pctEl.textContent = '(' + pct + '%)';
  }
}

function saveAdminOrder() {
  if (!adminEditOrderId) return;

  var params = {
    orderId: adminEditOrderId,
    status: document.getElementById('aod-status').value,
    shopeeId: document.getElementById('aod-shopeeId').value,
    subtotal: document.getElementById('aod-subtotal').value,
    shipping: document.getElementById('aod-shipping').value,
    shippingDiscount: document.getElementById('aod-shippingDiscount').value,
    voucher: document.getElementById('aod-voucher').value,
    orderTotal: document.getElementById('aod-orderTotal').value,
    refundAmount: document.getElementById('aod-refundAmount').value,
    depositAmount: document.getElementById('aod-depositAmount').value,
    paidRefund: document.getElementById('aod-paidRefund').checked,
    paidDeposit: document.getElementById('aod-paidDeposit').checked
  };

  showLoading('กำลังบันทึก...');
  apiCall('adminUpdateOrder', params).then(function(data) {
    hideLoading();
    if (data.success) {
      var changeCount = (data.changes || []).length;
      if (changeCount > 0) {
        showToast('✅ บันทึกสำเร็จ (' + changeCount + ' การเปลี่ยนแปลง)');
      } else {
        showToast('ℹ️ ไม่มีการเปลี่ยนแปลง');
      }
      hideModal('adminOrderModal');
      loadAdminOrders();
      if (simulateCurrentUserId) simulateUser(simulateCurrentUserId);
    } else {
      showToast('❌ ' + (data.error || 'บันทึกไม่สำเร็จ'));
    }
  }).catch(function(err) {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด: ' + (err.message || err));
  });
}

function confirmDeleteAdminOrder() {
  if (!adminEditOrderId) return;
  if (!confirm('⚠️ ยืนยันลบ Order ' + adminEditOrderId + ' ?\nลบแล้วไม่สามารถกู้คืนได้')) return;

  showLoading('กำลังลบ...');
  apiCall('adminDeleteOrder', { orderId: adminEditOrderId }).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('🗑️ ลบ Order สำเร็จ');
      hideModal('adminOrderModal');
      loadAdminOrders();
      if (simulateCurrentUserId) simulateUser(simulateCurrentUserId);
    } else {
      showToast('❌ ' + (data.error || 'ลบไม่สำเร็จ'));
    }
  }).catch(function(err) {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด: ' + (err.message || err));
  });
}

// Start admin
initAdmin();

// ===== ADMIN BROADCAST =====
var broadcastActiveCount_ = 0;
var broadcastAdminCount_ = 0;
var broadcastTarget_ = 'all';

function loadAdminBroadcast() {
  apiCall('adminGetUsers').then(function(data) {
    var users = data.users || [];
    broadcastActiveCount_ = users.filter(function(u) { return u.approved && !u.blocked; }).length;
    broadcastAdminCount_ = users.filter(function(u) { return u.isAdmin; }).length;
    renderAdminBroadcast();
  });
}

function setBroadcastTarget(target) {
  broadcastTarget_ = target;
  renderAdminBroadcast();
}

function renderAdminBroadcast() {
  var container = document.getElementById('admin-broadcast-content');
  if (!container) return;

  var allActive = broadcastTarget_ === 'all';
  var allStyle = 'flex:1;padding:10px;border-radius:var(--r-full);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--f-th);border:2px solid ' + (allActive ? '#2563EB' : 'var(--border)') + ';background:' + (allActive ? '#EFF6FF' : 'var(--surface)') + ';color:' + (allActive ? '#2563EB' : 'var(--txt3)') + ';';
  var adminStyle = 'flex:1;padding:10px;border-radius:var(--r-full);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--f-th);border:2px solid ' + (!allActive ? '#2563EB' : 'var(--border)') + ';background:' + (!allActive ? '#EFF6FF' : 'var(--surface)') + ';color:' + (!allActive ? '#2563EB' : 'var(--txt3)') + ';';

  var html =
    '<div class="section-title"><h2>📢 Broadcast ข้อความ</h2></div>' +

    '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
      '<button onclick="setBroadcastTarget(\'all\')" style="' + allStyle + '">👥 ทุกคน (' + broadcastActiveCount_ + ' คน)</button>' +
      '<button onclick="setBroadcastTarget(\'admin\')" style="' + adminStyle + '">👑 Admin (' + broadcastAdminCount_ + ' คน)</button>' +
    '</div>' +

    '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">ข้อความสำเร็จรูป</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">' +
      '<button onclick="confirmBroadcast(\'preset\',\'1\',\'🛍️ แจ้งเตือนมีโปรให้กด\')" ' +
        'style="padding:12px;border:1px solid #BFDBFE;border-radius:var(--r-xs);background:#EFF6FF;color:#1D4ED8;font-size:13px;cursor:pointer;text-align:left;font-family:var(--f-th);">🛍️ แจ้งเตือนมีโปรให้กด</button>' +
      '<button onclick="confirmBroadcast(\'preset\',\'2\',\'📤 แจ้งเตือนส่งออเดอร์\')" ' +
        'style="padding:12px;border:1px solid #BFDBFE;border-radius:var(--r-xs);background:#EFF6FF;color:#1D4ED8;font-size:13px;cursor:pointer;text-align:left;font-family:var(--f-th);">📤 แจ้งเตือนส่งออเดอร์</button>' +
      '<button onclick="confirmBroadcast(\'preset\',\'3\',\'💸 แจ้งโอนเรียบร้อย\')" ' +
        'style="padding:12px;border:1px solid #BFDBFE;border-radius:var(--r-xs);background:#EFF6FF;color:#1D4ED8;font-size:13px;cursor:pointer;text-align:left;font-family:var(--f-th);">💸 แจ้งโอนเรียบร้อย</button>' +
    '</div>' +

    '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">ส่งข้อความทั่วไป</div>' +
    '<textarea id="broadcast-text" placeholder="พิมพ์ข้อความที่ต้องการส่ง..." maxlength="500" ' +
      'style="width:100%;height:100px;padding:12px;border:1px solid var(--border);border-radius:var(--r-xs);font-size:14px;font-family:var(--f-th);resize:vertical;box-sizing:border-box;"></textarea>' +
    '<div style="text-align:right;font-size:11px;color:var(--txt3);margin-bottom:10px;"><span id="bc-char-count">0</span>/500</div>' +
    '<button onclick="confirmBroadcastText()" ' +
      'style="width:100%;padding:12px;background:#2563EB;color:white;border:none;border-radius:var(--r-xs);font-size:14px;font-weight:700;cursor:pointer;font-family:var(--f-th);">📢 Broadcast</button>';

  container.innerHTML = html;

  var ta = document.getElementById('broadcast-text');
  if (ta) {
    ta.addEventListener('input', function() {
      document.getElementById('bc-char-count').textContent = this.value.length;
    });
  }
}

function confirmBroadcast(type, value, label) {
  var targetCount = broadcastTarget_ === 'admin' ? broadcastAdminCount_ : broadcastActiveCount_;
  var targetLabel = broadcastTarget_ === 'admin' ? 'Admin เท่านั้น' : 'ทุกคน';
  if (!confirm('📢 ยืนยันส่ง Broadcast\n\n"' + label + '"\n\nส่งถึง: ' + targetLabel + '\nจำนวน: ' + targetCount + ' คน\n\nดำเนินการต่อ?')) return;
  showLoading('กำลังส่ง...');
  var apiParams = type === 'preset' ? { presetId: value } : { message: value };
  apiParams.target = broadcastTarget_;
  apiCall('adminBroadcast', apiParams).then(function(data) {
    hideLoading();
    if (data.success) showToast('✅ ส่งแล้ว ' + data.sent + ' คน');
    else showToast('❌ ' + (data.error || 'Error'));
  });
}

function confirmBroadcastText() {
  var msg = (document.getElementById('broadcast-text').value || '').trim();
  if (!msg) { showToast('⚠️ กรุณากรอกข้อความ'); return; }
  confirmBroadcast('text', msg, msg.substring(0, 30) + (msg.length > 30 ? '...' : ''));
}
