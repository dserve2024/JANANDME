// ===== ADMIN APP =====
// แยกจาก app.js — admin functions ทั้งหมด
// ใช้ shared utilities จาก app.js: CONFIG, userId, apiCall, numberFormat, showToast, showModal, hideModal, showLoading, hideLoading

var isAdminUser = false;

// ===== ADMIN INIT =====
async function initAdmin() {
  var banner = document.getElementById('debug-banner');
  var loadingEl = document.getElementById('loading');
  function dbg(msg) {
    if (banner) banner.textContent = msg;
  }
  try {
    dbg('Step 1: LIFF init...');
    await liff.init({ liffId: CONFIG.LIFF_ID });

    dbg('Step 2: isLoggedIn = ' + liff.isLoggedIn());
    if (!liff.isLoggedIn()) {
      dbg('Step 2b: calling liff.login()...');
      liff.login();
      return;
    }

    dbg('Step 3: getProfile...');
    var profile = await liff.getProfile();
    userId = profile.userId;
    dbg('Step 4: userId = ' + userId.substring(0, 10) + '...');

    isAdminUser = true;
    if (loadingEl) loadingEl.style.display = 'none';

    dbg('Step 5: switchAdminSubTab(payment)...');
    switchAdminSubTab('payment');
    dbg('Step 6: DONE');

  } catch (err) {
    dbg('ERROR: ' + err.message);
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
    document.getElementById('admin-users-sub').style.display = '';
    loadAdminUsers();
  } else if (sub === 'payment') {
    document.querySelector('[data-tab="payment"]').classList.add('active');
    document.getElementById('admin-payment-sub').style.display = '';
    loadAdminPayments();
  } else if (sub === 'deposit') {
    document.querySelector('[data-tab="deposit"]').classList.add('active');
    document.getElementById('admin-deposit-sub').style.display = '';
    loadAdminDepositReturns();
  } else if (sub === 'dashboard') {
    document.querySelector('[data-tab="dashboard"]').classList.add('active');
    document.getElementById('admin-dashboard-sub').style.display = '';
    loadAdminDashboard();
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
  var message = prompt('ส่งข้อความถึง ' + displayName + ':');
  if (!message || !message.trim()) return;
  apiCall('adminSendMessage', { targetUserId: targetUserId, message: message.trim() }).then(function(data) {
    if (data.success) showToast('✅ ส่งข้อความแล้ว');
    else showToast('❌ ' + (data.error || 'Error'));
  });
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
          accountName: u.accountName, phone: u.phone, orders: []
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
    '</div>';

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
  var r = data.revenue || {};
  var o = data.outstanding || {};
  var ord = data.orders || {};
  var u = data.users || {};
  var top = data.topShoppers || [];
  var container = document.getElementById('admin-dashboard-content');

  var html = '';

  html += '<div class="dash-section">';
  html += '<div class="dash-title">💰 รายได้</div>';
  html += '<div class="dash-grid">';
  html += dashCard('ยอดขายรวม', r.totalSales, 'green', '💰');
  html += dashCard('กำไรจริง', r.netProfit, 'accent', '📈');
  html += dashCard('โอนคืนแล้ว', r.totalRefundPaid, 'blue', '💸');
  html += dashCard('มัดจำคืนแล้ว', r.totalDepositPaid, 'blue', '🔄');
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

// Start admin
initAdmin();
