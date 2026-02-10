var CONFIG = {
  LIFF_ID: '2009026931-IQy8q5QZ',
  API_URL: 'https://script.google.com/macros/s/AKfycbxc1W4MgiGHFnLh8SrfHeqCbKPU033zbfSoTr-TUeGHuTy4qKcPjeZEvgqXC1PyAYiM/exec'
};

var userId = null;
var userData = null;
var currentShopeeId = null;
var currentOrderId = null;
var currentFilter = 'all';

// ===== INIT =====
async function init() {
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    var profile = await liff.getProfile();
    userId = profile.userId;

    var params = new URLSearchParams(window.location.search);

    if (params.get('contact') === '1') {
      document.getElementById('loading').style.display = 'none';
      document.querySelector('.tabs').style.display = 'none';
      document.getElementById('contact-only-section').style.display = 'block';
      return;
    }

    document.getElementById('profile-pic').src = profile.pictureUrl || '';
    document.getElementById('profile-name').textContent = profile.displayName;

    if (params.get('tab') === 'orders') {
      switchTab('orders');
    }

    loadUserData();
    checkAdminStatus();

  } catch (err) {
    document.getElementById('loading').innerHTML = '<p style="color:var(--red);">Error: ' + err.message + '</p>';
  }
}

// ===== API =====
function apiCall(action, params) {
  params = params || {};
  params.action = action;
  params.userId = userId;

  var url = CONFIG.API_URL + '?' + new URLSearchParams(params).toString();
  return fetch(url).then(function(r) { return r.json(); });
}

// ===== LOAD DATA =====
function loadUserData() {
  apiCall('getUserData').then(function(data) {
    if (data.success) {
      userData = data;

      if (data.user && data.user.blocked) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('blocked-section').style.display = 'block';
        document.querySelector('.tabs').style.display = 'none';
        return;
      }

      if (data.user && !data.user.approved) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pending-approval-section').style.display = 'block';
        document.querySelector('.tabs').style.display = 'none';
        return;
      }

      renderAll();
    }
    document.getElementById('loading').style.display = 'none';
    document.getElementById('info-section').classList.add('active');
  }).catch(function(err) {
    showToast('โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err));
    console.error('loadUserData error:', err);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('info-section').classList.add('active');
  });
}

function renderAll() {
  var badgeEl = document.getElementById('profile-status');
  if (userData.user && userData.user.approved) {
    badgeEl.innerHTML = '✓ อนุมัติแล้ว';
    badgeEl.style.background = 'var(--green-soft)';
    badgeEl.style.color = 'var(--green)';
  }

  document.getElementById('total-orders').textContent = userData.totalOrders || 0;
  document.getElementById('total-refund').textContent = '฿' + numberFormat(userData.totalRefund || 0);
  document.getElementById('total-deposit').textContent = '฿' + numberFormat(userData.totalDeposit || 0);

  renderShopeeIds();
  renderBank();
  renderPendingOrders();
}

// ===== PENDING ORDERS =====
function renderPendingOrders() {
  apiCall('getOrders', { filter: 'all' }).then(function(data) {
    var orders = (data.orders || []).filter(function(o) { return !o.shopeeId || o.shopeeId === ''; });
    var section = document.getElementById('pending-orders-section');
    var container = document.getElementById('pending-orders-list');

    if (orders.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    var html = '<div style="background:var(--amber-soft);border-radius:var(--r-sm);padding:12px;margin-bottom:10px;font-size:12px;color:var(--amber);">กดที่รายการเพื่อระบุ Shopee ID</div>';

    orders.forEach(function(order) {
      html += '<div class="order-card" style="margin-bottom:8px;" onclick="viewOrder(\'' + order.orderId + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><div class="order-id">🆔 ' + order.orderId + '</div>';
      html += '<div style="font-size:11px;color:var(--txt3);">' + formatDateTime(order.orderTime) + '</div></div>';
      html += '<div style="text-align:right;"><div class="order-amount" style="margin:0;">฿' + numberFormat(order.orderTotal || 0) + '</div>';
      html += '<div style="font-size:11px;color:var(--red);">⚠️ รอระบุ</div></div>';
      html += '</div></div>';
    });

    container.innerHTML = html;
  });
}

// ===== SHOPEE IDs =====
function renderShopeeIds() {
  var container = document.getElementById('shopee-list');
  var ids = userData.shopeeIds || [];

  if (ids.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><p>ยังไม่มี Shopee ID</p><button class="btn-save btn" onclick="showAddShopeeModal()">+ เพิ่ม Shopee ID</button></div>';
    return;
  }

  var html = '<div class="shopee-grid" style="grid-template-columns:1fr;">';
  ids.forEach(function(item) {
    var pct = item.totalOrders > 0 ? Math.round((item.paidOrders / item.totalOrders) * 100) : 0;
    var circumference = 2 * Math.PI * 16;
    var offset = circumference - (pct / 100) * circumference;
    var progressClass = pct === 0 ? 'warning' : '';
    var pctColor = pct === 0 ? 'var(--amber)' : 'var(--green)';

    html += '<div class="shopee-card" onclick="viewShopeeId(\'' + item.shopeeId + '\')">' +
      '<div class="shopee-icon">🛒</div>' +
      '<div class="shopee-info">' +
        '<div class="shopee-name">' + item.shopeeId + '</div>' +
        '<div class="shopee-stats"><span class="stat-paid">✓ ' + item.paidOrders + '</span><span class="stat-total">/ ' + item.totalOrders + ' orders</span></div>' +
      '</div>' +
      '<div class="progress-ring">' +
        '<svg width="40" height="40"><circle class="bg" cx="20" cy="20" r="16"/><circle class="progress ' + progressClass + '" cx="20" cy="20" r="16" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/></svg>' +
        '<div class="progress-text" style="color:' + pctColor + '">' + pct + '%</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function showAddShopeeModal() {
  document.getElementById('new-shopee-id').value = '';
  showModal('addShopeeModal');
}

function addShopeeId() {
  var shopeeId = document.getElementById('new-shopee-id').value.trim();
  if (!shopeeId) {
    showToast('กรุณากรอก Shopee ID');
    return;
  }

  apiCall('addShopeeId', { shopeeId: shopeeId }).then(function(data) {
    if (data.success) {
      showToast('✅ เพิ่ม Shopee ID สำเร็จ');
      hideModal('addShopeeModal');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  });
}

function viewShopeeId(shopeeId) {
  currentShopeeId = shopeeId;
  var item = userData.shopeeIds.find(function(s) { return s.shopeeId === shopeeId; });

  apiCall('getOrders', { filter: 'all' }).then(function(data) {
    var orders = (data.orders || []).filter(function(o) { return o.shopeeId === shopeeId; });
    var totalAmount = orders.reduce(function(sum, o) { return sum + (parseFloat(o.orderTotal) || 0); }, 0);
    var paidOrders = orders.filter(function(o) {
      var status = (o.status || '').toLowerCase();
      return status === 'โอนแล้ว' || status === 'completed' || status === 'paid';
    }).length;

    var html = '<div style="text-align:center;padding:10px 0 20px;">';
    html += '<div class="shopee-icon" style="width:60px;height:60px;font-size:28px;margin:0 auto 15px;">🛒</div>';
    html += '<div style="font-size:20px;font-weight:700;margin-bottom:5px;">' + shopeeId + '</div>';
    html += '<div style="font-size:14px;color:var(--txt3);">✓ ' + paidOrders + ' / ' + orders.length + ' orders</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--accent);margin-top:5px;">💰 รวม ฿' + numberFormat(totalAmount) + '</div>';
    html += '</div>';

    if (orders.length > 0) {
      html += '<div style="border-top:1px solid var(--border);padding-top:15px;max-height:300px;overflow-y:auto;">';
      orders.forEach(function(order) {
        var statusColor = (order.status === 'โอนแล้ว' || order.status === 'completed') ? 'color:var(--green);' : 'color:var(--amber);';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg);border-radius:var(--r-xs);margin-bottom:8px;cursor:pointer;" onclick="hideModal(\'viewShopeeModal\');viewOrder(\'' + order.orderId + '\')">';
        html += '<div><div style="font-weight:700;font-size:13px;font-family:var(--f-mono);">🆔 ' + order.orderId + '</div>';
        html += '<div style="font-size:11px;color:var(--txt3);">' + formatDateTime(order.orderTime) + '</div></div>';
        html += '<div style="text-align:right;"><div style="font-weight:700;">฿' + numberFormat(order.orderTotal || 0) + '</div>';
        html += '<div style="font-size:11px;' + statusColor + '">' + (order.status || 'รอตรวจ') + '</div></div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="text-align:center;padding:20px;color:var(--txt3);">ยังไม่มี orders</div>';
    }

    document.getElementById('shopee-modal-body').innerHTML = html;
    showModal('viewShopeeModal');
  });
}

function confirmDeleteShopee() {
  document.getElementById('confirm-delete-btn').onclick = function() {
    deleteShopeeId(currentShopeeId);
  };
  hideModal('viewShopeeModal');
  showModal('confirmModal');
}

function deleteShopeeId(shopeeId) {
  apiCall('deleteShopeeId', { shopeeId: shopeeId }).then(function(data) {
    hideModal('confirmModal');
    if (data.success) {
      showToast('✅ ลบ Shopee ID สำเร็จ');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  });
}

// ===== BANK =====
function renderBank() {
  var container = document.getElementById('bank-display');
  var user = userData.user;

  if (!user || !user.bankName) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🏦</div><p>ยังไม่มีบัญชีรับเงิน</p><button class="btn-save btn" onclick="showBankModal()">+ เพิ่มบัญชี</button></div>';
    return;
  }

  container.innerHTML = '<div class="bank-card" onclick="showBankModal()">' +
    '<div class="bank-label">BANK ACCOUNT</div>' +
    '<div class="bank-name">' + user.bankName + '</div>' +
    '<div class="bank-account">' + user.bankAccount + '</div>' +
    '<div class="bank-holder">ชื่อบัญชี: ' + user.accountName + '</div>' +
    (user.phone ? '<div class="bank-phone">📞 ' + user.phone + '</div>' : '') +
  '</div>';
}

function showBankModal() {
  var user = userData.user || {};
  document.getElementById('input-bank-name').value = user.bankName || '';
  document.getElementById('input-bank-account').value = user.bankAccount || '';
  document.getElementById('input-account-name').value = user.accountName || '';
  document.getElementById('input-phone').value = user.phone || '';
  showModal('bankModal');
}

function saveBank() {
  var params = {
    bankName: document.getElementById('input-bank-name').value,
    bankAccount: document.getElementById('input-bank-account').value.trim(),
    accountName: document.getElementById('input-account-name').value.trim(),
    phone: document.getElementById('input-phone').value.trim()
  };

  apiCall('updateBank', params).then(function(data) {
    if (data.success) {
      showToast('✅ บันทึกสำเร็จ');
      hideModal('bankModal');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  });
}

// ===== ORDERS =====
function loadOrders(filter) {
  currentFilter = filter || 'all';
  var params = {};

  if (filter === 'user') params.filter = 'user';
  else if (filter === 'admin') params.filter = 'admin';
  else if (filter === 'pending') params.status = 'รอตรวจสอบ';
  else if (filter === 'completed') params.status = 'โอนแล้ว';

  apiCall('getOrders', params).then(function(data) {
    if (data.success) {
      renderOrders(data.orders);
    }
  });
}

function filterOrders(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  loadOrders(filter);
}

function renderOrders(orders) {
  var container = document.getElementById('orders-list');

  if (!orders || orders.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>ไม่มีรายการ</p></div>';
    return;
  }

  var html = '<div class="orders-grid">';
  orders.forEach(function(order) {
    var statusClass = (order.status === 'โอนแล้ว' || order.status === 'completed') ? 'completed' : 'pending';
    var byClass = order.createdBy === 'ADMIN' ? 'admin' : 'user';
    var byText = order.createdBy === 'ADMIN' ? '🛒 Admin' : '👤 ตัวเอง';
    var shopeeText = order.shopeeId || '⚠️ รอระบุ';
    var shopeeColor = order.shopeeId ? 'var(--txt3)' : 'var(--red)';

    html += '<div class="order-card" onclick="viewOrder(\'' + order.orderId + '\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;">';
    html += '<span class="order-id">' + order.orderId + '</span>';
    html += '<span class="order-status ' + statusClass + '">' + (order.status || 'รอ') + '</span>';
    html += '</div>';
    html += '<div class="order-amount">฿' + numberFormat(order.orderTotal || 0) + '</div>';
    html += '<div class="order-shopee" style="color:' + shopeeColor + ';">🏪 ' + shopeeText + '</div>';
    html += '<div class="order-time">' + formatDateTime(order.orderTime) + '</div>';
    html += '<div class="order-by ' + byClass + '">' + byText + '</div>';
    if (parseFloat(order.refundAmount) > 0) {
      html += '<div class="order-refund">💰 ฿' + numberFormat(order.refundAmount) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}

function viewOrder(orderId) {
  currentOrderId = orderId;

  function doViewOrder() {
    apiCall('getOrderDetail', { orderId: orderId }).then(function(data) {
      if (!data.success) {
        showToast('ไม่พบข้อมูล Order');
        return;
      }

      var order = data.order;
      var html = '';

      if (order.imageUrl) {
        var viewUrl = order.imageUrl;
        if (viewUrl.indexOf('drive.google.com') !== -1) {
          var fileId = viewUrl.match(/[-\w]{25,}/);
          if (fileId) {
            viewUrl = 'https://drive.google.com/file/d/' + fileId[0] + '/view';
          }
        }
        html += '<a href="' + viewUrl + '" target="_blank" style="display:block;padding:12px;background:var(--txt);border-radius:var(--r-sm);text-align:center;text-decoration:none;color:white;font-weight:700;margin-bottom:12px;font-size:13px;">📷 ดูรูป Order</a>';
      }

      html += '<div class="form-row">';
      html += '<div class="form-group"><label>Order ID</label><input type="text" value="' + order.orderId + '" disabled></div>';
      html += '<div class="form-group"><label>Order Time</label><input type="text" value="' + formatDateTime(order.orderTime) + '" disabled></div>';
      html += '</div>';

      var allShopeeIds = (userData && userData.shopeeIds) ? userData.shopeeIds : [];
      html += '<div class="form-group full"><label>Shopee ID <span style="color:var(--red);">*</span></label>';
      html += '<select id="edit-shopee-id" style="background:white;">';
      html += '<option value="">-- เลือก --</option>';
      if (allShopeeIds.length > 0) {
        allShopeeIds.forEach(function(s) {
          var selected = (s.shopeeId === order.shopeeId) ? 'selected' : '';
          html += '<option value="' + s.shopeeId + '" ' + selected + '>' + s.shopeeId + '</option>';
        });
      }
      if (order.shopeeId && allShopeeIds.length > 0 && !allShopeeIds.find(function(s) { return s.shopeeId === order.shopeeId; })) {
        html += '<option value="' + order.shopeeId + '" selected>' + order.shopeeId + ' (Admin)</option>';
      } else if (order.shopeeId && allShopeeIds.length === 0) {
        html += '<option value="' + order.shopeeId + '" selected>' + order.shopeeId + '</option>';
      }
      html += '</select></div>';

      html += '<div class="form-group full"><label>💰 Order Total</label><input type="number" id="edit-total" value="' + (order.orderTotal || '') + '" style="font-size:18px;font-weight:700;"></div>';

      html += '<div class="form-row">';
      html += '<div class="form-group"><label>Coins Used</label><input type="number" id="edit-coins" value="' + (order.coinsUsed || '') + '"></div>';
      html += '<div class="form-group"><label>Voucher</label><input type="number" id="edit-voucher" value="' + (order.voucher || '') + '"></div>';
      html += '</div>';

      html += '<div class="form-row">';
      html += '<div class="form-group"><label>Shipping</label><input type="number" id="edit-shipping" value="' + (order.shipping || '') + '"></div>';
      html += '<div class="form-group"><label>Shipping Discount</label><input type="number" id="edit-shipping-discount" value="' + (order.shippingDiscount || '') + '"></div>';
      html += '</div>';

      html += '<div class="form-row">';
      html += '<div class="form-group"><label>Subtotal</label><input type="number" id="edit-subtotal" value="' + (order.subtotal || '') + '"></div>';
      html += '<div class="form-group"><label>Status</label><input type="text" value="' + (order.status || '-') + '" disabled></div>';
      html += '</div>';

      html += '<div class="form-row">';
      html += '<div class="form-group"><label>ยอดรอคืน</label><input type="text" value="฿' + numberFormat(order.refundAmount || 0) + '" disabled></div>';
      html += '<div class="form-group"><label>ยอดมัดจำ</label><input type="text" value="฿' + numberFormat(order.depositAmount || 0) + '" disabled></div>';
      html += '</div>';

      html += '<div style="display:flex;gap:8px;margin-top:8px;">';
      html += '<button class="btn-secondary" style="flex:1;padding:10px;font-size:13px;border-radius:var(--r-xs);" onclick="viewOrderHistory(\'' + orderId + '\')">📜 ประวัติ</button>';
      html += '<button style="flex:1;padding:10px;font-size:13px;background:var(--red);color:white;border:none;border-radius:var(--r-xs);cursor:pointer;font-weight:700;" onclick="confirmDeleteOrder(\'' + orderId + '\')">🗑️ ลบ</button>';
      html += '</div>';
      html += '<button style="width:100%;margin-top:8px;padding:14px;border:none;border-radius:var(--r-sm);background:var(--red);color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--f-th);" onclick="showDisputeModal(\'' + orderId + '\')">🚨 แจ้งปัญหา</button>';

      document.getElementById('order-modal-body').innerHTML = html;
      document.getElementById('order-modal-actions').innerHTML = '<button class="btn-cancel" onclick="hideModal(\'orderModal\')">ปิด</button><button class="btn-save" onclick="saveOrder()">💾 บันทึก</button>';
      showModal('orderModal');
    });
  }

  if (!userData || !userData.shopeeIds) {
    apiCall('getUserData').then(function(data) {
      if (data.success) { userData = data; }
      doViewOrder();
    }).catch(function() { doViewOrder(); });
  } else {
    doViewOrder();
  }
}

function saveOrder() {
  var params = {
    orderId: currentOrderId,
    shopeeId: document.getElementById('edit-shopee-id').value,
    subtotal: document.getElementById('edit-subtotal').value,
    shipping: document.getElementById('edit-shipping').value,
    shippingDiscount: document.getElementById('edit-shipping-discount').value,
    voucher: document.getElementById('edit-voucher').value,
    coinsUsed: document.getElementById('edit-coins').value,
    orderTotal: document.getElementById('edit-total').value
  };

  var total = parseFloat(params.orderTotal);
  if (total < 0) { showToast('❌ ตัวเลขต้องไม่ติดลบ'); return; }
  if (total > 10000) {
    if (!confirm('⚠️ ยอดรวมมากกว่า 10,000 บาท\nต้องการบันทึกหรือไม่?')) return;
  }

  apiCall('updateOrder', params).then(function(data) {
    if (data.success) {
      showToast('✅ บันทึกสำเร็จ');
      hideModal('orderModal');
      loadOrders(currentFilter);
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  });
}

function confirmDeleteOrder(orderId) {
  document.getElementById('confirm-delete-btn').onclick = function() { deleteOrder(orderId); };
  hideModal('orderModal');
  showModal('confirmModal');
}

function deleteOrder(orderId) {
  apiCall('deleteOrder', { orderId: orderId }).then(function(data) {
    hideModal('confirmModal');
    if (data.success) {
      showToast('✅ ลบ Order สำเร็จ');
      loadOrders(currentFilter);
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  });
}

function viewOrderHistory(orderId) {
  apiCall('getOrderHistory', { orderId: orderId }).then(function(data) {
    var history = data.history || [];

    var html = '<h4 style="margin-bottom:15px;">📜 ประวัติการแก้ไข</h4>';

    if (history.length === 0) {
      html += '<p style="color:var(--txt3);text-align:center;">ยังไม่มีประวัติการแก้ไข</p>';
    } else {
      history.forEach(function(h) {
        var time = formatDateTime(h.timestamp);
        html += '<div class="history-item">' +
          '<div class="history-time">' + time + '</div>' +
          '<div class="history-change">' + h.field + ': <span class="old">' + h.oldValue + '</span> → <span class="new">' + h.newValue + '</span></div>' +
        '</div>';
      });
    }

    document.getElementById('order-modal-body').innerHTML = html;
    document.getElementById('order-modal-actions').innerHTML = '<button class="btn-cancel" style="width:100%;" onclick="viewOrder(\'' + orderId + '\')">← กลับ</button>';
  });
}

// ===== UTILS =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });

  var tabEl = document.querySelector('[data-tab="' + tab + '"]');
  if (tabEl) tabEl.classList.add('active');
  document.getElementById(tab + '-section').classList.add('active');

  if (tab === 'orders') loadOrders(currentFilter);
  if (tab === 'admin') loadAdminData();
}

function showModal(id) { document.getElementById(id).classList.add('show'); }
function hideModal(id) { document.getElementById(id).classList.remove('show'); }

// ===== CONTACT ADMIN =====
function showContactModal() {
  document.getElementById('contact-message').value = '';
  showModal('contactModal');
}

function cancelContact() { hideModal('contactModal'); }

function sendContactDirect() {
  var message = document.getElementById('contact-message-direct').value.trim();
  if (!message) { showToast('❌ กรุณาพิมพ์ข้อความ'); return; }

  var btn = document.querySelector('#contact-only-section button');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังส่ง...';

  apiCall('contactAdmin', { message: message }).then(function(data) {
    if (data.success) {
      showToast('✅ ส่งข้อความสำเร็จ!');
      setTimeout(function() { if (liff.isInClient()) liff.closeWindow(); }, 1500);
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
      btn.disabled = false; btn.textContent = '📨 ส่งข้อความ';
    }
  }).catch(function() {
    showToast('❌ เกิดข้อผิดพลาด');
    btn.disabled = false; btn.textContent = '📨 ส่งข้อความ';
  });
}

function closeContactForm() { if (liff.isInClient()) liff.closeWindow(); }

function sendContactMessage() {
  var message = document.getElementById('contact-message').value.trim();
  if (!message) { showToast('❌ กรุณาพิมพ์ข้อความ'); return; }

  apiCall('contactAdmin', { message: message }).then(function(data) {
    hideModal('contactModal');
    if (data.success) showToast('✅ ส่งข้อความสำเร็จ! แอดมินจะติดต่อกลับค่ะ');
    else showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
  }).catch(function() {
    hideModal('contactModal');
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

function numberFormat(num) {
  return parseFloat(num || 0).toLocaleString('th-TH');
}

function formatDateTime(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      var match = String(dateStr).match(/(\d{2})[-\/](\d{2})[-\/](\d{4})\s*(\d{2}):(\d{2})/);
      if (match) d = new Date(match[3], match[2] - 1, match[1], match[4], match[5]);
      else return dateStr;
    }
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var mins = String(d.getMinutes()).padStart(2, '0');
    var secs = String(d.getSeconds()).padStart(2, '0');
    return year + '-' + month + '-' + day + ' ' + hours + ':' + mins + ':' + secs;
  } catch (e) { return dateStr; }
}

// ===== DISPUTE =====
function showDisputeModal(orderId) {
  document.getElementById('dispute-order-id').value = orderId;
  document.getElementById('dispute-reason').value = '';
  document.getElementById('dispute-detail').value = '';
  hideModal('orderModal');
  showModal('disputeModal');
}

function submitDispute() {
  var params = {
    orderId: document.getElementById('dispute-order-id').value,
    reason: document.getElementById('dispute-reason').value,
    detail: document.getElementById('dispute-detail').value
  };
  if (!params.reason) { showToast('กรุณาเลือกเหตุผล'); return; }
  apiCall('createDispute', params).then(function(data) {
    if (data.success) { showToast('✅ ส่งแจ้งปัญหาเรียบร้อย'); hideModal('disputeModal'); }
    else showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
  });
}

// ===== ADMIN =====
var isAdminUser = false;

function checkAdminStatus() {
  apiCall('checkAdmin').then(function(data) {
    if (data.success && data.isAdmin) {
      isAdminUser = true;
      document.getElementById('admin-tab').style.display = '';
    }
  }).catch(function(err) { console.error('checkAdmin error:', err); });
}

function loadAdminData() {
  if (!isAdminUser) return;
  var activeSubTab = document.querySelector('.admin-sub-tab.active');
  var tabName = activeSubTab ? activeSubTab.textContent.trim() : '';
  if (tabName.indexOf('โอนเงิน') !== -1) loadAdminPayments();
  else loadAdminUsers();
}

function switchAdminSubTab(sub) {
  document.querySelectorAll('.admin-sub-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.admin-sub-section').forEach(function(s) { s.classList.remove('active'); });
  if (sub === 'users') {
    document.querySelectorAll('.admin-sub-tab')[0].classList.add('active');
    document.getElementById('admin-users-sub').classList.add('active');
    loadAdminUsers();
  } else {
    document.querySelectorAll('.admin-sub-tab')[1].classList.add('active');
    document.getElementById('admin-payment-sub').classList.add('active');
    loadAdminPayments();
  }
}

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
    html += '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + user.displayName + adminBadge + '</div><div style="font-size:12px;color:' + statusColor + ';font-weight:600;">' + statusText + '</div></div>';

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

// ===== ADMIN PAYMENTS =====
var adminPaymentData = [];
var paymentSelections = {};
var paymentViewMode = 'refund';

function loadAdminPayments() {
  var listEl = document.getElementById('admin-pay-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('adminGetPendingPayments').then(function(data) {
    if (!data.success) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    adminPaymentData = (data.users || []).filter(function(u) {
      return u.bankName && u.bankAccount;
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

function switchPaymentMode(mode) {
  paymentViewMode = mode;
  renderAdminPayments();
}

function renderAdminPayments() {
  // Filter by current mode
  var filtered = adminPaymentData.filter(function(u) {
    if (paymentViewMode === 'deposit') return u.type === 'deposit';
    return u.type !== 'deposit';
  });

  var refundCount = adminPaymentData.filter(function(u) { return u.type !== 'deposit'; }).length;
  var depositCount = adminPaymentData.filter(function(u) { return u.type === 'deposit'; }).length;

  var totalUsers = filtered.length;
  var totalAmount = 0;
  filtered.forEach(function(u) {
    u.orders.forEach(function(o) { totalAmount += parseFloat(o.amount) || 0; });
  });

  var summaryEl = document.getElementById('admin-pay-summary');
  var isRefund = paymentViewMode === 'refund';
  var refundActive = isRefund ? 'active' : '';
  var depositActive = !isRefund ? 'active' : '';

  var modeHtml = '<div class="filter-row" style="margin-bottom:12px;">';
  modeHtml += '<button class="filter-btn ' + refundActive + '" onclick="switchPaymentMode(\'refund\')" style="flex:1;">💰 ยอดคืน' + (refundCount > 0 ? ' (' + refundCount + ')' : '') + '</button>';
  modeHtml += '<button class="filter-btn ' + depositActive + '" onclick="switchPaymentMode(\'deposit\')" style="flex:1;">🏦 มัดจำ' + (depositCount > 0 ? ' (' + depositCount + ')' : '') + '</button>';
  modeHtml += '</div>';

  var modeLabel = isRefund ? 'รอโอนคืน' : 'รอคืนมัดจำ';
  var modeColor = isRefund ? 'warn' : 'info';

  summaryEl.innerHTML = modeHtml +
    '<div class="admin-pay-summary" style="margin-bottom:0;grid-template-columns:1fr 1fr;">' +
    '<div class="aps-card ' + modeColor + '"><div class="aps-num">' + totalUsers + '</div><div class="aps-lbl">' + modeLabel + '</div></div>' +
    '<div class="aps-card info"><div class="aps-num">฿' + numberFormat(totalAmount) + '</div><div class="aps-lbl">ยอดรวม</div></div>' +
    '</div>';

  var listEl = document.getElementById('admin-pay-list');
  if (filtered.length === 0) {
    var emptyMsg = isRefund ? 'ไม่มียอดคืนรอโอน' : 'ไม่มีมัดจำรอคืน';
    listEl.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>' + emptyMsg + '</p></div>';
    return;
  }
  var html = '';
  filtered.forEach(function(user) {
    var selected = paymentSelections[user.userId] || new Set();
    var selectedTotal = 0;
    var isDeposit = user.type === 'deposit';
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
    html += '<div class="pay-total-box"><div class="pay-total-amount ' + (isDeposit ? 'deposit-color' : '') + '">฿' + numberFormat(selectedTotal) + '</div>';
    html += '<div class="pay-total-label">' + selected.size + ' ' + (isDeposit ? 'มัดจำ' : 'orders') + '</div></div></div>';
    html += '<div class="pay-card-body">';
    user.orders.forEach(function(o) {
      var checked = selected.has(o.orderId);
      html += '<div class="pay-order-row"><div class="pay-order-left">';
      html += '<div class="pay-check ' + (checked ? 'checked' : '') + '" onclick="togglePayOrder(\'' + user.userId + '\',\'' + o.orderId + '\')">✓</div>';
      html += '<div><div class="pay-oid">#' + o.orderId + '</div>';
      html += '<div class="pay-oid-shop">' + (isDeposit ? '🏷️ มัดจำ' : '🏪 ' + (o.shopeeId || '-')) + '</div></div></div>';
      html += '<div class="pay-oamt">฿' + numberFormat(o.amount) + '</div></div>';
    });
    html += '</div>';
    html += '<div class="pay-card-footer">';
    html += '<button class="pay-btn skip-btn" onclick="skipPayUser(\'' + user.userId + '\')">ข้าม</button>';
    if (isDeposit) {
      html += '<button class="pay-btn deposit-btn" onclick="showConfirmPayModal(\'' + user.userId + '\')">✅ ยืนยันคืนมัดจำ</button>';
    } else {
      html += '<button class="pay-btn confirm-btn" onclick="showConfirmPayModal(\'' + user.userId + '\')">✅ ยืนยันโอนคืน</button>';
    }
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
  var isDeposit = user.type === 'deposit';

  var modalInner = document.getElementById('confirmPayModalInner');
  modalInner.className = 'modal confirm-pay-modal' + (isDeposit ? ' deposit-mode' : '');
  document.getElementById('cpay-modal-title').textContent = isDeposit ? '✅ ยืนยันคืนเงินมัดจำ' : '✅ ยืนยันโอนเงินคืน';

  var html = '<div class="cpay-bank-card">';
  html += '<div class="cpay-bank-label">โอนเข้าบัญชี</div>';
  html += '<div class="cpay-bank-name">' + (user.bankName || '-') + '</div>';
  html += '<div class="cpay-bank-account">' + (user.bankAccount || '-') + '</div>';
  html += '<div class="cpay-bank-holder">👤 ' + (user.accountName || user.displayName) + '</div>';
  if (user.phone) html += '<div class="cpay-bank-user">📞 ' + user.phone + '</div>';
  html += '</div>';
  html += '<div class="cpay-orders"><div class="cpay-orders-label">📋 รายการที่เลือก (' + selectedOrders.length + ')</div>';
  selectedOrders.forEach(function(o) {
    html += '<div class="cpay-order-item"><span class="oid">#' + o.orderId + '</span><span class="amt">฿' + numberFormat(o.amount) + '</span></div>';
  });
  html += '</div>';
  html += '<div class="cpay-total-box ' + (isDeposit ? 'deposit-style' : '') + '"><span class="cpay-total-label">💵 ยอดโอนรวม</span>';
  html += '<span class="cpay-total-amount ' + (isDeposit ? 'deposit-color' : '') + '">฿' + numberFormat(totalAmount) + '</span></div>';
  html += '<div class="cpay-note">⚠️ กดยืนยันแล้วระบบจะ:<br>1. อัปเดตสถานะ → "โอนแล้ว"<br>2. ส่ง Flex แจ้งลูกค้าทาง LINE<br>3. บันทึก Log</div>';
  document.getElementById('cpay-modal-body').innerHTML = html;

  var actHtml = '<button class="btn-cancel" onclick="hideModal(\'confirmPayModal\')">← กลับ</button>';
  actHtml += isDeposit
    ? '<button class="btn-confirm-blue" onclick="executePayment()">💸 ยืนยันโอน</button>'
    : '<button class="btn-confirm-green" onclick="executePayment()">💸 ยืนยันโอน</button>';
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
  var isDeposit = user.type === 'deposit';

  var btns = document.querySelectorAll('#cpay-modal-actions button');
  btns.forEach(function(b) { b.disabled = true; });
  btns[btns.length - 1].textContent = '⏳ กำลังดำเนินการ...';

  apiCall('adminConfirmPayment', {
    targetUserId: confirmPayUserId,
    orderIds: Array.from(selected).join(','),
    totalAmount: totalAmount,
    type: isDeposit ? 'deposit' : 'refund'
  }).then(function(data) {
    hideModal('confirmPayModal');
    if (data.success) {
      showPaymentSuccess(user, selectedOrders, totalAmount, isDeposit);
      adminPaymentData = adminPaymentData.filter(function(u) { return u.userId !== confirmPayUserId; });
      delete paymentSelections[confirmPayUserId];
    } else { showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด')); }
  }).catch(function(err) {
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

// Start
init();
