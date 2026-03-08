var CONFIG = {
  LIFF_ID: '2009026931-IQy8q5QZ',
  API_URL: 'https://script.google.com/macros/s/AKfycbxc1W4MgiGHFnLh8SrfHeqCbKPU033zbfSoTr-TUeGHuTy4qKcPjeZEvgqXC1PyAYiM/exec',
  EDGE_API_URL: 'https://ucarbttnncedmwtrlxyw.supabase.co/functions/v1/api',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYXJidHRubmNlZG13dHJseHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzgyNjQsImV4cCI6MjA4NjM1NDI2NH0.HvM6cVr00gedlANYA1csfpv_DBu7l2OEUls2gy2r1tM',
  USE_EDGE: true  // Phase 2: เปิดใช้ Edge Function สำหรับ read APIs
};

var userId = null;
var userData = null;
var currentDisplayName = '';
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
    currentDisplayName = profile.displayName || '';

    var params = new URLSearchParams(window.location.search);

    if (params.get('contact') === '1') {
      document.getElementById('loading').style.display = 'none';
      document.querySelector('.tabs').style.display = 'none';
      openChat();
      return;
    }

    document.getElementById('profile-pic').src = profile.pictureUrl || '';
    document.getElementById('profile-name').textContent = profile.displayName;

    if (params.get('tab') === 'orders') {
      switchTab('orders');
    }

    loadUserData();

  } catch (err) {
    document.getElementById('loading').innerHTML = '<p style="color:var(--red);">Error: ' + err.message + '</p>';
  }
}

// ===== API =====
// Actions ที่ใช้ Edge Function ได้ (Phase 3: read + write)
var EDGE_ACTIONS = [
  // Read actions (Phase 2)
  'getUserData', 'getOrders', 'getOrderDetail', 'getOrderHistory',
  'getDepositOrders', 'getDepositHistory', 'getDisputes',
  'checkAdmin', 'adminGetUsers',
  'adminGetDepositReturns', 'adminGetPendingPayments',
  // Write actions (Phase 3)
  'updateBank', 'addShopeeId', 'deleteShopeeId',
  'updateOrder', 'deleteOrder', 'contactAdmin', 'createDispute',
  'adminApproveUser', 'adminBlockUser', 'adminConfirmPayment',
  'adminReviewDeposit', 'adminMarkPayment', 'adminSetAdmin',
  'getChatMessages', 'sendChatMessage'
];

function apiCall(action, params) {
  params = params || {};
  params.action = action;
  if (!params.userId) params.userId = userId;

  // ใช้ Edge Function สำหรับทุก action ที่อยู่ใน EDGE_ACTIONS (ถ้าเปิด USE_EDGE)
  var useEdge = CONFIG.USE_EDGE && EDGE_ACTIONS.indexOf(action) !== -1;
  var baseUrl = useEdge ? CONFIG.EDGE_API_URL : CONFIG.API_URL;
  var url = baseUrl + '?' + new URLSearchParams(params).toString();

  var fetchOptions = {};
  if (useEdge) {
    fetchOptions.headers = {
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
    };
  }

  return fetch(url, fetchOptions)
    .then(function(r) { return r.json(); })
    .catch(function(err) {
      // Fallback to GAS if Edge fails
      if (useEdge) {
        console.warn('Edge API failed, falling back to GAS:', err.message);
        var gasUrl = CONFIG.API_URL + '?' + new URLSearchParams(params).toString();
        return fetch(gasUrl).then(function(r) { return r.json(); });
      }
      throw err;
    });
}

function apiPost(data) {
  data.userId = userId;
  return fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); });
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

  // Group 1: Hero - รวมยอดรอรับ (รวม expected ด้วย)
  var totalRefund = userData.totalRefund || 0;
  var totalDeposit = userData.totalDeposit || 0;
  var expectedRefund = userData.expectedRefund || 0;
  var pendingDep = userData.pendingDeposit || 0;
  var allRefund = totalRefund + expectedRefund;
  var allDeposit = totalDeposit + pendingDep;
  var combined = allRefund + allDeposit;
  document.getElementById('total-combined').textContent = '฿' + numberFormat(combined);
  document.getElementById('total-combined-detail').textContent =
    'ยอดคืน ฿' + numberFormat(allRefund) + ' + มัดจำ ฿' + numberFormat(allDeposit);

  // Group 2: Forecast
  document.getElementById('expected-refund').textContent = '฿' + numberFormat(expectedRefund);
  document.getElementById('pending-deposit').textContent = '฿' + numberFormat(pendingDep);

  // Group 3: History - ได้รับแล้ว
  var refPaid = userData.totalRefundPaid || 0;
  var depReturned = userData.totalDepositReturned || 0;
  var totalReceived = refPaid + depReturned;
  document.getElementById('total-received').textContent = '฿' + numberFormat(totalReceived);
  document.getElementById('total-received-detail').textContent =
    'คืนเงิน ฿' + numberFormat(refPaid) + ' + มัดจำ ฿' + numberFormat(depReturned);

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

  var html = '<div class="shopee-grid" style="grid-template-columns:1fr 1fr;">';
  ids.forEach(function(item) {
    html += '<div class="shopee-card" onclick="viewShopeeId(\'' + item.shopeeId + '\')" style="padding:10px;gap:8px;">' +
      '<div class="shopee-icon" style="width:32px;height:32px;font-size:14px;border-radius:8px;">🛒</div>' +
      '<div class="shopee-info" style="flex:1;min-width:0;">' +
        '<div class="shopee-name" style="font-size:12px;">' + item.shopeeId + '</div>' +
        '<div class="shopee-stats" style="font-size:10px;"><span class="stat-paid">✓ ' + item.paidOrders + '</span><span class="stat-total">/ ' + item.totalOrders + '</span></div>' +
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

  showLoading('กำลังบันทึก...');
  apiCall('addShopeeId', { shopeeId: shopeeId }).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('✅ เพิ่ม Shopee ID สำเร็จ');
      hideModal('addShopeeModal');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
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
      return status === 'transferred' || status === 'completed';
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
        var statusColor = order.status === 'Transferring' ? 'color:var(--blue);' : (order.status === 'Transferred' || order.status === 'Completed') ? 'color:var(--green);' : 'color:var(--amber);';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg);border-radius:var(--r-xs);margin-bottom:8px;cursor:pointer;" onclick="hideModal(\'viewShopeeModal\');viewOrder(\'' + order.orderId + '\')">';
        html += '<div><div style="font-weight:700;font-size:13px;font-family:var(--f-mono);">🆔 ' + order.orderId + '</div>';
        html += '<div style="font-size:11px;color:var(--txt3);">' + formatDateTime(order.orderTime) + '</div></div>';
        html += '<div style="text-align:right;"><div style="font-weight:700;">฿' + numberFormat(order.orderTotal || 0) + '</div>';
        html += '<div style="font-size:11px;' + statusColor + '">' + getStatusDisplay(order.status) + '</div></div>';
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
  showLoading('กำลังลบ...');
  apiCall('deleteShopeeId', { shopeeId: shopeeId }).then(function(data) {
    hideLoading();
    hideModal('confirmModal');
    if (data.success) {
      showToast('✅ ลบ Shopee ID สำเร็จ');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
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

  container.innerHTML = '<div class="bank-card" onclick="showBankModal()" style="padding:14px 16px;display:flex;align-items:stretch;gap:0;">' +
    '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">' +
      '<div class="bank-label">BANK ACCOUNT</div>' +
      (user.phone ? '<div class="bank-phone" style="margin-top:6px;font-size:12px;opacity:.7;">📞 ' + user.phone + '</div>' : '') +
    '</div>' +
    '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;justify-content:center;border-left:1px solid rgba(255,255,255,.1);padding-left:14px;">' +
      '<div style="font-size:12px;opacity:.5;font-weight:600;">' + user.bankName + '</div>' +
      '<div class="bank-account" style="font-size:22px;letter-spacing:2px;margin:2px 0 4px;opacity:1;">' + user.bankAccount + '</div>' +
      '<div style="font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.5px;">' + user.accountName + '</div>' +
    '</div>' +
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

  showLoading('กำลังบันทึก...');
  apiCall('updateBank', params).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('✅ บันทึกสำเร็จ');
      hideModal('bankModal');
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

// ===== ORDERS =====

// Status display helpers
function getStatusDisplay(status) {
  var map = {
    'Transferring': 'รอค้างชำระ',
    'Transferred': 'โอนแล้ว',
    'Completed': 'สำเร็จ',
    'Pending': 'รอตรวจ',
    'Canceled': 'ยกเลิก',
    'Incorrect': 'ไม่ถูกต้อง',
    'Ambiguous': 'ไม่ชัดเจน'
  };
  return map[status] || status || 'Pending';
}

function getStatusClass(status) {
  if (status === 'Transferring') return 'transferring';
  if (status === 'Transferred' || status === 'Completed') return 'completed';
  return 'pending';
}

function getStatusPriority(status) {
  var priorities = {
    'Transferring': 0,
    'Pending': 1,
    'Completed': 2,
    'Shipped': 3,
    'New': 3,
    'Transferred': 4,
    'Incorrect': 5,
    'Ambiguous': 5,
    'Canceled': 6
  };
  return priorities[status] !== undefined ? priorities[status] : 3;
}

function loadOrders(filter) {
  currentFilter = filter || 'all';
  var params = {};

  if (filter === 'user') params.filter = 'user';
  else if (filter === 'admin') params.filter = 'admin';
  else if (filter === 'pending') params.status = 'Pending';
  else if (filter === 'transferring') params.status = 'Transferring';
  else if (filter === 'completed') params.status = 'Transferred';

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

  // Sort by status priority: Transferring > Pending > Completed > Transferred > ...
  orders.sort(function(a, b) {
    return getStatusPriority(a.status) - getStatusPriority(b.status);
  });

  var html = '<div class="orders-grid">';
  orders.forEach(function(order) {
    var statusClass = getStatusClass(order.status);
    var statusText = getStatusDisplay(order.status);
    var byClass = order.createdBy === 'ADMIN' ? 'admin' : 'user';
    var byText = order.createdBy === 'ADMIN' ? '🛒 Admin' : '👤 ตัวเอง';
    var shopeeText = order.shopeeId || '⚠️ รอระบุ';
    var shopeeColor = order.shopeeId ? 'var(--txt3)' : 'var(--red)';

    html += '<div class="order-card" onclick="viewOrder(\'' + order.orderId + '\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;">';
    html += '<span class="order-id">' + order.orderId + '</span>';
    html += '<span class="order-status ' + statusClass + '">' + statusText + '</span>';
    html += '</div>';
    html += '<div class="order-amount">฿' + numberFormat(order.orderTotal || 0) + '</div>';
    html += '<div class="order-shopee" style="color:' + shopeeColor + ';">🏪 ' + shopeeText + '</div>';
    html += '<div class="order-time">' + formatDateTime(order.orderTime) + '</div>';
    html += '<div class="order-by ' + byClass + '">' + byText + '</div>';
    if (parseFloat(order.refundAmount) > 0) {
      html += '<div class="order-refund">💰 ฿' + numberFormat(order.refundAmount) + '</div>';
    }
    if (order.status === 'Transferring') {
      html += '<div style="margin-top:6px;padding:6px 8px;background:var(--blue-soft);border-radius:var(--r-xs);font-size:10px;font-weight:700;color:var(--blue);text-align:center;cursor:pointer;" onclick="event.stopPropagation();switchTab(\'admin\');switchAdminSubTab(\'payment\');">💳 ไปหน้าจ่ายเงิน</div>';
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
      html += '<div class="form-group"><label>Status</label><input type="text" value="' + getStatusDisplay(order.status) + '" disabled style="color:' + (order.status === 'Transferring' ? 'var(--blue)' : '') + ';font-weight:700;"></div>';
      html += '</div>';

      if (order.status === 'Transferring') {
        html += '<div style="padding:12px;background:var(--blue-soft);border-radius:var(--r-sm);margin:8px 0;text-align:center;cursor:pointer;" onclick="hideModal(\'orderModal\');switchTab(\'admin\');switchAdminSubTab(\'payment\');">';
        html += '<div style="font-size:14px;font-weight:700;color:var(--blue);">💳 ไปหน้าจ่ายเงิน</div>';
        html += '<div style="font-size:11px;color:var(--txt3);margin-top:2px;">กดเพื่อไปจัดการชำระเงินใน Admin</div>';
        html += '</div>';
      }

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

  showLoading('กำลังบันทึก...');
  apiCall('updateOrder', params).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('✅ บันทึกสำเร็จ');
      hideModal('orderModal');
      loadOrders(currentFilter);
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

function confirmDeleteOrder(orderId) {
  document.getElementById('confirm-delete-btn').onclick = function() { deleteOrder(orderId); };
  hideModal('orderModal');
  showModal('confirmModal');
}

function deleteOrder(orderId) {
  showLoading('กำลังลบ...');
  apiCall('deleteOrder', { orderId: orderId }).then(function(data) {
    hideLoading();
    hideModal('confirmModal');
    if (data.success) {
      showToast('✅ ลบ Order สำเร็จ');
      loadOrders(currentFilter);
      loadUserData();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
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
}

function showModal(id) { document.getElementById(id).classList.add('show'); }
function hideModal(id) { document.getElementById(id).classList.remove('show'); }

// ===== CHAT =====
var chatPollingId = null;
var chatDisplayName = '';

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openChat() {
  showModal('chatModal');
  loadChatMessages();
  chatPollingId = setInterval(loadChatMessages, 5000);
}

function closeChat() {
  hideModal('chatModal');
  if (chatPollingId) { clearInterval(chatPollingId); chatPollingId = null; }
}

function loadChatMessages() {
  apiCall('getChatMessages', { userId: userId, limit: 50 }).then(function(data) {
    if (!data.success) return;
    renderChatMessages(data.messages);
  });
}

function renderChatMessages(messages) {
  var el = document.getElementById('chat-messages');
  if (!messages || !messages.length) {
    el.innerHTML = '<div class="chat-empty">ยังไม่มีข้อความ<br>พิมพ์ข้อความด้านล่างเพื่อเริ่มสนทนา</div>';
    return;
  }
  var html = '';
  messages.forEach(function(m) {
    var isMe = m.sender_type === 'user';
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

var chatImageBase64 = null;

function previewChatImage(input) {
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
      chatImageBase64 = compressed.split(',')[1];
      document.getElementById('chat-preview-img').src = compressed;
      document.getElementById('chat-image-preview').style.display = 'flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearChatImage() {
  chatImageBase64 = null;
  document.getElementById('chat-image-preview').style.display = 'none';
  document.getElementById('chat-image-input').value = '';
}

function sendChatMsg() {
  var input = document.getElementById('chat-input');
  var msg = input.value.trim();
  var hasImage = !!chatImageBase64;
  if (!msg && !hasImage) return;
  input.value = '';

  // Optimistic: show bubble immediately
  var el = document.getElementById('chat-messages');
  var emptyEl = el.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();
  var now = new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'});
  var previewHtml = '';
  if (hasImage) {
    var previewSrc = document.getElementById('chat-preview-img').src;
    previewHtml = '<img src="' + previewSrc + '" class="chat-img">';
  }
  el.innerHTML += '<div class="chat-bubble me">' + previewHtml +
    (msg ? '<div>' + escapeHtml(msg) + '</div>' : '') +
    '<div class="chat-time">' + now + '</div></div>';
  el.scrollTop = el.scrollHeight;

  var name = currentDisplayName;

  if (hasImage) {
    var imageData = chatImageBase64;
    clearChatImage();
    apiPost({ source: 'liff_chat_image', image: imageData }).then(function(uploadResult) {
      if (!uploadResult || !uploadResult.success) {
        var errMsg = (uploadResult && uploadResult.error) ? uploadResult.error : 'ไม่ทราบสาเหตุ';
        console.error('Chat image upload failed:', errMsg);
        showToast('อัปโหลดรูปไม่สำเร็จ: ' + errMsg);
        return;
      }
      apiCall('sendChatMessage', {
        userId: userId, senderType: 'user', senderName: name,
        message: msg, imageUrl: uploadResult.imageUrl
      }).then(function(data) {
        if (!data.success) showToast('ส่งไม่สำเร็จ');
      });
    }).catch(function(err) {
      console.error('Chat image upload error:', err);
      showToast('อัปโหลดรูปไม่สำเร็จ: เครือข่ายมีปัญหา');
    });
  } else {
    apiCall('sendChatMessage', {
      userId: userId, senderType: 'user', senderName: name, message: msg
    }).then(function(data) {
      if (!data.success) showToast('ส่งไม่สำเร็จ');
    });
  }
}

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

function showLoading(msg) {
  var el = document.getElementById('loadingOverlay');
  var txt = document.getElementById('loadingText');
  if (txt) txt.textContent = msg || 'กำลังดำเนินการ...';
  if (el) el.classList.add('show');
}

function hideLoading() {
  var el = document.getElementById('loadingOverlay');
  if (el) el.classList.remove('show');
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
  showLoading('กำลังส่ง...');
  apiCall('createDispute', params).then(function(data) {
    hideLoading();
    if (data.success) { showToast('✅ ส่งแจ้งปัญหาเรียบร้อย'); hideModal('disputeModal'); }
    else showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
  }).catch(function() {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

// ===== ORDER SUB-TABS =====
function switchOrderSubTab(sub) {
  var tabs = document.querySelectorAll('#orders-section .admin-sub-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('orders-list-sub').classList.remove('active');
  document.getElementById('orders-upload-sub').classList.remove('active');
  if (sub === 'list') {
    tabs[0].classList.add('active');
    document.getElementById('orders-list-sub').classList.add('active');
    loadOrders(currentFilter);
  } else {
    tabs[1].classList.add('active');
    document.getElementById('orders-upload-sub').classList.add('active');
    loadDepositOrders();
  }
}

// ===== DEPOSIT RETURN UPLOAD =====
var depositOrders = [];
var selectedDepositOrders = {};
var depositProductFiles = [];
var depositTrackingFiles = [];
var depositCurrentStep = 1;

function showUploadSub(name, el) {
  document.querySelectorAll('.section-toggle .st-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  document.getElementById('upload-new').style.display = name === 'new' ? '' : 'none';
  document.getElementById('upload-history').style.display = name === 'history' ? '' : 'none';
  if (name === 'new') loadDepositOrders();
  if (name === 'history') loadDepositHistory();
}

function loadDepositOrders() {
  var container = document.getElementById('upload-new');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('getDepositOrders').then(function(data) {
    if (!data.success) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + (data.error || 'โหลดไม่สำเร็จ') + '</p></div>';
      return;
    }
    depositOrders = data.orders || [];
    selectedDepositOrders = {};
    depositProductFiles = [];
    depositTrackingFiles = [];
    depositCurrentStep = 1;
    renderDepositWizard();
  });
}

function renderDepositWizard() {
  var container = document.getElementById('upload-new');
  var html = '';

  // Stepper
  html += '<div class="stepper">';
  var steps = ['เลือก Order', 'รูปสินค้า', 'Tracking', 'ตรวจสอบ'];
  for (var s = 0; s < steps.length; s++) {
    var sClass = (s + 1) < depositCurrentStep ? 'done' : (s + 1) === depositCurrentStep ? 'active' : '';
    html += '<div class="step ' + sClass + '">';
    html += '<div class="step-dot">' + (s + 1) + '</div>';
    html += '<span class="step-label">' + steps[s] + '</span>';
    html += '</div>';
    if (s < steps.length - 1) {
      html += '<div class="step-line' + ((s + 1) < depositCurrentStep ? ' done' : '') + '"></div>';
    }
  }
  html += '</div>';

  // Step content
  if (depositCurrentStep === 1) html += renderDepositStep1();
  else if (depositCurrentStep === 2) html += renderDepositStep2();
  else if (depositCurrentStep === 3) html += renderDepositStep3();
  else if (depositCurrentStep === 4) html += renderDepositStep4();
  else if (depositCurrentStep === 5) html += renderDepositSuccess();

  container.innerHTML = html;
}

function renderDepositStep1() {
  var html = '<div class="step-content active">';
  html += '<div class="upload-section-title">📦 เลือก Order ที่ต้องการส่งคืน</div>';
  html += '<div class="upload-section-desc">เลือก Order ที่มีมัดจำค้างอยู่ เพื่ออัปโหลดหลักฐานการส่งคืนสินค้า</div>';

  if (depositOrders.length === 0) {
    html += '<div class="empty-state"><div class="icon">✅</div><p>ไม่มี Order ที่มีมัดจำค้าง</p></div>';
    html += '</div>';
    return html;
  }

  for (var i = 0; i < depositOrders.length; i++) {
    var o = depositOrders[i];
    var sel = selectedDepositOrders[o.orderId] ? ' selected' : '';
    html += '<div class="order-select-item' + sel + '" onclick="toggleDepositOrder(this,\'' + o.orderId + '\')">';
    html += '<div class="osi-radio">✓</div>';
    html += '<div class="osi-info"><div class="osi-id">' + o.orderId + '</div>';
    html += '<div class="osi-shop">🏪 ' + (o.shopeeId || '-') + '</div></div>';
    html += '<div class="osi-right"><div class="osi-amount">฿' + numberFormat(o.depositAmount || 0) + '</div>';
    html += '<div class="osi-status">' + (o.status || '') + '</div></div>';
    html += '</div>';
  }

  html += '<div class="help-text" style="margin-top:10px">💡 เลือกได้หลาย Order พร้อมกัน</div>';
  var hasSelected = Object.keys(selectedDepositOrders).length > 0;
  html += '<div class="action-row"><button class="btn-wizard purple" ' + (hasSelected ? '' : 'disabled') + ' onclick="goUploadStep(2)">ถัดไป →</button></div>';
  html += '</div>';
  return html;
}

function toggleDepositOrder(el, orderId) {
  if (selectedDepositOrders[orderId]) {
    delete selectedDepositOrders[orderId];
  } else {
    var order = depositOrders.filter(function(o) { return o.orderId === orderId; })[0];
    if (order) selectedDepositOrders[orderId] = order;
  }
  renderDepositWizard();
}

function renderDepositStep2() {
  var html = '<div class="step-content active">';
  html += '<div class="upload-section-title">📷 อัปโหลดรูปสินค้า</div>';
  html += '<div class="upload-section-desc">ถ่ายรูปสินค้าที่จะส่งคืน เพื่อยืนยันสภาพสินค้า</div>';

  if (depositProductFiles.length === 0) {
    html += '<div class="upload-zone" onclick="document.getElementById(\'productFileInput\').click()">';
    html += '<div class="uz-icon">📸</div>';
    html += '<div class="uz-title">อัปโหลดรูปสินค้า</div>';
    html += '<div class="uz-desc">กดเพื่อเลือกรูปจากอัลบั้ม</div>';
    html += '<div class="uz-formats"><span class="uz-format">JPG</span><span class="uz-format">PNG</span><span class="uz-format">สูงสุด 5 รูป</span></div>';
    html += '</div>';
    html += '<div class="uz-or">หรือ</div>';
    html += '<button class="camera-btn" onclick="document.getElementById(\'productCameraInput\').click()">📷 เปิดกล้องถ่ายรูป</button>';
  } else {
    html += '<div class="preview-grid">';
    for (var i = 0; i < depositProductFiles.length; i++) {
      html += '<div class="preview-item"><img src="' + depositProductFiles[i].preview + '"><button class="preview-remove" onclick="removeDepositFile(\'product\',' + i + ')">✕</button></div>';
    }
    if (depositProductFiles.length < 5) {
      html += '<div class="preview-add" onclick="document.getElementById(\'productFileInput\').click()"><span class="pa-icon">+</span><span class="pa-text">เพิ่มรูป</span></div>';
    }
    html += '</div>';
  }

  html += '<input type="file" id="productFileInput" accept="image/*" multiple style="display:none" onchange="handleDepositFiles(\'product\',this.files)">';
  html += '<input type="file" id="productCameraInput" accept="image/*" capture="environment" style="display:none" onchange="handleDepositFiles(\'product\',this.files)">';

  html += '<div class="action-row">';
  html += '<button class="btn-wizard outline" onclick="goUploadStep(1)">← กลับ</button>';
  html += '<button class="btn-wizard purple" ' + (depositProductFiles.length > 0 ? '' : 'disabled') + ' onclick="goUploadStep(3)">ถัดไป →</button>';
  html += '</div></div>';
  return html;
}

function renderDepositStep3() {
  var html = '<div class="step-content active">';
  html += '<div class="upload-section-title">🚚 อัปโหลดสลิป Tracking</div>';
  html += '<div class="upload-section-desc">ถ่ายรูปสลิปขนส่ง หรือ Screenshot หน้า Tracking</div>';

  if (depositTrackingFiles.length === 0) {
    html += '<div class="upload-zone" onclick="document.getElementById(\'trackingFileInput\').click()">';
    html += '<div class="uz-icon">🚚</div>';
    html += '<div class="uz-title">อัปโหลดสลิป Tracking</div>';
    html += '<div class="uz-desc">รูป Tracking Number / สลิปขนส่ง</div>';
    html += '<div class="uz-formats"><span class="uz-format">JPG</span><span class="uz-format">PNG</span><span class="uz-format">สูงสุด 3 รูป</span></div>';
    html += '</div>';
    html += '<div class="uz-or">หรือ</div>';
    html += '<button class="camera-btn" style="background:var(--blue);box-shadow:0 3px 14px rgba(46,122,184,.3)" onclick="document.getElementById(\'trackingCameraInput\').click()">📷 เปิดกล้องถ่ายรูป</button>';
  } else {
    html += '<div class="preview-grid">';
    for (var i = 0; i < depositTrackingFiles.length; i++) {
      html += '<div class="preview-item"><img src="' + depositTrackingFiles[i].preview + '"><button class="preview-remove" onclick="removeDepositFile(\'tracking\',' + i + ')">✕</button></div>';
    }
    if (depositTrackingFiles.length < 3) {
      html += '<div class="preview-add" onclick="document.getElementById(\'trackingFileInput\').click()"><span class="pa-icon">+</span><span class="pa-text">เพิ่มรูป</span></div>';
    }
    html += '</div>';
  }

  html += '<input type="file" id="trackingFileInput" accept="image/*" multiple style="display:none" onchange="handleDepositFiles(\'tracking\',this.files)">';
  html += '<input type="file" id="trackingCameraInput" accept="image/*" capture="environment" style="display:none" onchange="handleDepositFiles(\'tracking\',this.files)">';
  html += '<div class="help-text">💡 <strong>ไม่บังคับ</strong> — ข้ามได้ถ้ายังไม่มี Tracking</div>';

  html += '<div class="action-row">';
  html += '<button class="btn-wizard outline" onclick="goUploadStep(2)">← กลับ</button>';
  html += '<button class="btn-wizard purple" onclick="goUploadStep(4)">ถัดไป →</button>';
  html += '</div></div>';
  return html;
}

function renderDepositStep4() {
  var orderKeys = Object.keys(selectedDepositOrders);
  var totalDeposit = 0;
  orderKeys.forEach(function(k) { totalDeposit += parseFloat(selectedDepositOrders[k].depositAmount) || 0; });

  var html = '<div class="step-content active">';
  html += '<div class="upload-section-title">✅ ตรวจสอบข้อมูล</div>';
  html += '<div class="upload-section-desc">ตรวจสอบให้ครบก่อนส่งให้แอดมิน</div>';

  // Orders card
  html += '<div class="review-card"><div class="review-card-head"><div class="rch-icon order">📦</div><div class="rch-title">Order ที่เลือก</div><span class="rch-badge ok">' + orderKeys.length + ' รายการ</span></div>';
  html += '<div class="review-card-body">';
  orderKeys.forEach(function(k) {
    var o = selectedDepositOrders[k];
    html += '<div class="review-order-row"><span class="ro-label">📦 ' + o.orderId + '</span><span class="ro-value">฿' + numberFormat(o.depositAmount || 0) + '</span></div>';
  });
  html += '<div class="review-order-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px"><span class="ro-label" style="font-weight:700">รวมมัดจำ</span><span class="ro-value" style="color:var(--purple)">฿' + numberFormat(totalDeposit) + '</span></div>';
  html += '</div></div>';

  // Photos card
  html += '<div class="review-card"><div class="review-card-head"><div class="rch-icon photo">📷</div><div class="rch-title">รูปสินค้า</div><span class="rch-badge ok">' + depositProductFiles.length + ' รูป</span></div>';
  html += '<div class="review-card-body"><div class="review-images">';
  depositProductFiles.forEach(function(f) { html += '<div class="review-img"><img src="' + f.preview + '"></div>'; });
  html += '</div></div></div>';

  // Tracking card
  html += '<div class="review-card"><div class="review-card-head"><div class="rch-icon tracking">🚚</div><div class="rch-title">สลิป Tracking</div><span class="rch-badge ok">' + depositTrackingFiles.length + ' รูป</span></div>';
  if (depositTrackingFiles.length > 0) {
    html += '<div class="review-card-body"><div class="review-images">';
    depositTrackingFiles.forEach(function(f) { html += '<div class="review-img"><img src="' + f.preview + '"></div>'; });
    html += '</div></div>';
  } else {
    html += '<div class="review-card-body"><div style="font-size:12px;color:var(--txt3)">ไม่มี tracking</div></div>';
  }
  html += '</div>';

  // Note
  html += '<div style="margin-top:12px"><div class="upload-section-title" style="font-size:13px;margin-bottom:8px">💬 หมายเหตุ (ถ้ามี)</div>';
  html += '<textarea class="note-input" id="depositNote" rows="2" placeholder="เช่น สินค้าครบแล้วค่ะ / ส่งคืนทั้งหมด..."></textarea></div>';

  html += '<div class="action-row">';
  html += '<button class="btn-wizard outline" onclick="goUploadStep(3)">← กลับ</button>';
  html += '<button class="btn-wizard green" id="btnSubmitDeposit" onclick="submitDepositReturn()">📨 ส่งให้แอดมิน</button>';
  html += '</div></div>';
  return html;
}

function renderDepositSuccess() {
  var html = '<div class="success-state">';
  html += '<div class="success-check">✅</div>';
  html += '<div class="success-title">ส่งข้อมูลสำเร็จ!</div>';
  html += '<div class="success-desc">รูปสินค้าและ Tracking ถูกส่งให้แอดมินแล้ว<br>แอดมินจะตรวจสอบและอัปเดตสถานะให้ค่ะ</div>';
  html += '<button class="btn-wizard purple" style="width:100%" onclick="resetDepositWizard()">📤 ส่งคืนอีก Order</button>';
  html += '<button class="btn-wizard outline" style="width:100%;margin-top:8px" onclick="showUploadSub(\'history\',document.querySelectorAll(\'.st-btn\')[1])">📋 ดูประวัติ</button>';
  html += '</div>';
  return html;
}

function goUploadStep(n) {
  if (n > 1 && Object.keys(selectedDepositOrders).length === 0) { showToast('❌ กรุณาเลือก Order ก่อน'); return; }
  if (n > 2 && depositProductFiles.length === 0) { showToast('❌ กรุณาอัปโหลดรูปสินค้าก่อน'); return; }
  depositCurrentStep = n;
  renderDepositWizard();
}

function handleDepositFiles(type, files) {
  if (!files || !files.length) return;
  var maxFiles = type === 'product' ? 5 : 3;
  var currentArr = type === 'product' ? depositProductFiles : depositTrackingFiles;
  var remaining = maxFiles - currentArr.length;
  var toProcess = Math.min(files.length, remaining);

  var processed = 0;
  for (var i = 0; i < toProcess; i++) {
    (function(file) {
      compressImage(file, 1200, 0.8, function(base64, preview) {
        var arr = type === 'product' ? depositProductFiles : depositTrackingFiles;
        arr.push({ base64: base64, preview: preview });
        processed++;
        if (processed >= toProcess) renderDepositWizard();
      });
    })(files[i]);
  }
}

function compressImage(file, maxWidth, quality, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width;
      var h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      var base64 = dataUrl.split(',')[1];
      callback(base64, dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeDepositFile(type, index) {
  if (type === 'product') depositProductFiles.splice(index, 1);
  else depositTrackingFiles.splice(index, 1);
  renderDepositWizard();
}

function submitDepositReturn() {
  var orderKeys = Object.keys(selectedDepositOrders);
  var orders = orderKeys.map(function(k) {
    var o = selectedDepositOrders[k];
    return { orderId: o.orderId, shopeeId: o.shopeeId, depositAmount: o.depositAmount };
  });

  var noteEl = document.getElementById('depositNote');
  var note = noteEl ? noteEl.value.trim() : '';

  var payload = {
    source: 'liff_deposit_return',
    orders: orders,
    productPhotos: depositProductFiles.map(function(f) { return f.base64; }),
    trackingPhotos: depositTrackingFiles.map(function(f) { return f.base64; }),
    note: note
  };

  showLoading('กำลังส่งคำขอ...');
  apiPost(payload).then(function(data) {
    hideLoading();
    if (data.success) {
      showToast('✅ ส่งข้อมูลสำเร็จ!');
      depositCurrentStep = 5;
      renderDepositWizard();
    } else {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
    }
  }).catch(function(err) {
    hideLoading();
    showToast('❌ เกิดข้อผิดพลาด');
  });
}

function resetDepositWizard() {
  depositOrders = [];
  selectedDepositOrders = {};
  depositProductFiles = [];
  depositTrackingFiles = [];
  depositCurrentStep = 1;
  loadDepositOrders();
}

// ===== DEPOSIT HISTORY =====
function loadDepositHistory() {
  var container = document.getElementById('upload-history');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลด...</p></div>';
  apiCall('getDepositHistory').then(function(data) {
    if (!data.success) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>โหลดไม่สำเร็จ</p></div>';
      return;
    }
    renderDepositHistory(data.submissions || []);
  });
}

function renderDepositHistory(items) {
  var container = document.getElementById('upload-history');
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📤</div><p>ยังไม่มีประวัติการส่งคืน</p></div>';
    return;
  }
  var html = '';
  items.forEach(function(item) {
    var iconClass = item.status === 'Approved' ? 'sent' : item.status === 'Rejected' ? 'rejected' : 'review';
    var statusIcon = item.status === 'Approved' ? '✅' : item.status === 'Rejected' ? '❌' : '⏳';
    var statusText = item.status || 'Pending';

    html += '<div class="history-card">';
    html += '<div class="hc-top">';
    html += '<div class="hc-icon ' + iconClass + '">' + statusIcon + '</div>';
    html += '<div class="hc-info"><div class="hc-oid">' + item.orderId + '</div>';
    html += '<div class="hc-time">' + (item.submittedAt || '') + '</div></div>';
    html += '<div class="hc-status ' + iconClass + '">' + statusText + '</div>';
    html += '</div>';

    html += '<div class="hc-labels">';
    html += '<span class="hc-label photo">📷 ' + item.productPhotos.length + ' รูป</span>';
    if (item.trackingPhotos.length > 0) html += '<span class="hc-label tracking">🚚 ' + item.trackingPhotos.length + ' รูป</span>';
    html += '<span style="margin-left:auto;font-size:11px;font-weight:700;color:var(--purple);">฿' + numberFormat(item.depositAmount || 0) + '</span>';
    html += '</div>';

    if (item.status === 'Rejected' && item.adminNote) {
      html += '<div style="margin-top:8px;padding:8px 10px;background:var(--red-soft);border-radius:var(--r-xs);font-size:11px;color:var(--red);">💬 แอดมิน: ' + item.adminNote + '</div>';
    }

    html += '</div>';
  });
  container.innerHTML = html;
}

// Start — ไม่เรียก init() ถ้าอยู่ใน admin page (admin-app.js จะเรียก initAdmin() เอง)
if (!window.location.pathname.startsWith('/admin')) {
  init();
}
