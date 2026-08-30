/* ================================================================
   حراء للسياحة — سلوكيات مشتركة لكل صفحات النظام (Layout Helpers)
   يعتمد على وجود supabase.js قبله في الصفحة
   ================================================================ */

// ================================================================
// تبديل القائمة الجانبية (موبايل: تظهر فوق المحتوى / ديسكتوب: تطوي)
// ================================================================
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.getElementById('main-content');
    var overlay = document.getElementById('sidebar-overlay');
    var icon = document.getElementById('menu-toggle-icon');
    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    var isOpenNow;

    if (!sidebar) return;

    if (isMobile) {
        sidebar.classList.toggle('open');
        isOpenNow = sidebar.classList.contains('open');
        if (overlay) overlay.classList.toggle('show', isOpenNow);
    } else {
        sidebar.classList.toggle('closed');
        isOpenNow = !sidebar.classList.contains('closed');
        if (mainContent) mainContent.classList.toggle('full', !isOpenNow);
    }

    if (icon) icon.className = isOpenNow ? 'fas fa-xmark' : 'fas fa-bars';
}

// إغلاق القائمة تلقائياً عند تغيير حجم الشاشة لتفادي تعارض الكلاسات
window.addEventListener('resize', function() {
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.getElementById('main-content');
    var overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
        sidebar.classList.remove('closed');
        if (mainContent) mainContent.classList.remove('full');
    } else {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }
});

// ================================================================
// تطبيق اسم النظام في كل عناصر البراند بالصفحة
// ================================================================
function applySystemName(opts) {
    opts = opts || {};
    var systemName = 'حراء للسياحة';
    try {
        systemName = Supabase.getSystemName() || systemName;
    } catch (e) {
        console.warn('تعذر جلب اسم النظام، سيتم استخدام الاسم الافتراضي');
    }

    var pageLabel = opts.pageLabel || '';
    document.title = (pageLabel ? pageLabel + ' - ' : '') + systemName;

    document.querySelectorAll('[data-brand]').forEach(function(el) {
        el.innerHTML = '🕋 ' + systemName;
    });

    var welcome = document.getElementById('welcomeTitle');
    if (welcome && opts.welcome !== false) {
        welcome.textContent = opts.welcomeText || (systemName ? 'مرحباً بك في ' + systemName : 'مرحباً بك');
    }

    var footer = document.getElementById('footerText');
    if (footer) {
        footer.textContent = '© ' + new Date().getFullYear() + ' ' + systemName + ' — جميع الحقوق محفوظة';
    }
}

// ================================================================
// نظام التنبيهات (Toast) الموحّد
// ================================================================
function ensureToastContainer() {
    var c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toastContainer';
        document.body.appendChild(c);
    }
    return c;
}

var TOAST_ICONS = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
};

function showToast(message, type) {
    type = type || 'info';
    var container = ensureToastContainer();
    var el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.innerHTML = '<i class="fas ' + (TOAST_ICONS[type] || TOAST_ICONS.info) + '"></i><span>' + message + '</span>';
    container.appendChild(el);

    setTimeout(function() {
        el.style.transition = 'opacity 0.25s, transform 0.25s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
        setTimeout(function() { el.remove(); }, 250);
    }, 3200);
}

// ================================================================
// تحديث "آخر تحديث" الوقت
// ================================================================
function updateLastRefreshed() {
    var el = document.getElementById('lastUpdated');
    if (!el) return;
    var now = new Date();
    var timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = '<i class="fas fa-clock"></i> آخر تحديث: ' + timeStr;
}

// ================================================================
// تحديث ذكي: يوقف التحديث التلقائي عند تصغير التبويب لتحسين الأداء
// ================================================================
function startSmartAutoRefresh(fn, intervalMs) {
    var timer = null;

    function tick() {
        if (document.visibilityState === 'visible') {
            fn();
        }
    }

    function start() {
        if (timer) clearInterval(timer);
        timer = setInterval(tick, intervalMs);
    }

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            fn(); // تحديث فوري عند الرجوع للتبويب
        }
    });

    start();
    return timer;
}

// ================================================================
// تسجيل الخروج
// ================================================================
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('darkMode');
        window.location.href = 'login.html';
    }
}

// ================================================================
// عرض/إخفاء المودالز (نمط موحّد data-modal)
// ================================================================
function openModalById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
}
function closeModalById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
}
