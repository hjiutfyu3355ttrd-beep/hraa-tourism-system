/* ================================================================
   layout.js — نظام حراء للسياحة
   سلوكيات مشتركة لكل صفحات النظام (Sidebar / اسم النظام / Toast / تسجيل الخروج)
   ================================================================ */
var Layout = (function () {

    // ================================================================
    // SIDEBAR - نظام موحد للهامبورجر في جميع الصفحات
    // ================================================================
    function initSidebar() {
        var sidebar = document.getElementById('sidebar');
        var toggleBtn = document.getElementById('sidebarToggle');
        var overlay = document.getElementById('sidebarOverlay');
        var mainContent = document.getElementById('mainContent');

        if (!sidebar || !toggleBtn) return;

        var MOBILE_BREAKPOINT = 1200;

        function toggleSidebar() {
            if (window.innerWidth <= MOBILE_BREAKPOINT) {
                var isOpen = sidebar.classList.toggle('open');
                if (overlay) overlay.classList.toggle('active');
                document.body.style.overflow = isOpen ? 'hidden' : '';
            } else {
                sidebar.classList.toggle('collapsed');
                if (mainContent) mainContent.classList.toggle('expanded');
            }
        }

        toggleBtn.addEventListener('click', toggleSidebar);

        if (overlay) {
            overlay.addEventListener('click', function() {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // إغلاق القائمة بالـ Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });

        // ضبط الحالة عند تغيير حجم الشاشة
        window.addEventListener('resize', function() {
            if (window.innerWidth > MOBILE_BREAKPOINT) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            } else {
                sidebar.classList.remove('collapsed');
                if (mainContent) mainContent.classList.remove('expanded');
            }
        });

        // دعم التوافق مع data-sidebar-toggle (للصفحات القديمة)
        var oldToggle = document.querySelector('[data-sidebar-toggle]');
        if (oldToggle) {
            oldToggle.addEventListener('click', toggleSidebar);
        }
    }

    // ================================================================
    // CURRENT DATE
    // ================================================================
    function setCurrentDate(elementId) {
        var el = document.getElementById(elementId || 'current-date');
        if (!el) return;
        var now = new Date();
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        el.textContent = now.toLocaleDateString('ar-EG', options);
    }

    // ================================================================
    // SYSTEM NAME
    // ================================================================
    function applySystemName(pageLabel) {
        var systemName = 'حراء للسياحة';
        try {
            systemName = Supabase.getSystemName() || systemName;
        } catch (e) {
            console.warn('تعذر جلب اسم النظام، سيتم استخدام الاسم الافتراضي');
        }

        document.title = (pageLabel ? pageLabel + ' - ' : '') + systemName;

        var brand = document.getElementById('sidebarBrandText');
        if (brand) {
            var isLegacy = brand.innerHTML.includes('🕋');
            if (isLegacy) {
                brand.innerHTML = '🕋 ' + systemName + ' <small>النظام المحاسبي المتكامل</small>';
            } else {
                brand.innerHTML = systemName + ' <small>النظام المحاسبي المتكامل</small>';
            }
        }

        var mobileBrand = document.getElementById('mobileBrandText');
        if (mobileBrand) mobileBrand.innerHTML = '🕋 ' + systemName;

        var welcome = document.getElementById('welcomeTitle');
        if (welcome) welcome.textContent = 'مرحباً بك في ' + systemName + ' 👋';

        var footer = document.getElementById('footerText');
        if (footer) footer.textContent = '© ' + new Date().getFullYear() + ' ' + systemName + ' — جميع الحقوق محفوظة';

        return systemName;
    }

    // ================================================================
    // TOAST
    // ================================================================
    function showToast(message, type) {
        var existing = document.querySelectorAll('.toast-notification');
        for (var i = 0; i < existing.length; i++) existing[i].remove();

        var toast = document.createElement('div');
        var cls = 'toast-notification';
        if (type === 'success') cls += ' toast-success';
        else if (type === 'error') cls += ' toast-error';
        else if (type === 'warning') cls += ' toast-warning';
        toast.className = cls;

        var iconClass = 'fa-circle-info';
        if (type === 'success') iconClass = 'fa-circle-check';
        else if (type === 'error') iconClass = 'fa-circle-xmark';
        else if (type === 'warning') iconClass = 'fa-triangle-exclamation';

        toast.innerHTML = '<i class="fas ' + iconClass + '"></i><span>' + message + '</span>';
        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }, 3000);
    }

    // ================================================================
    // LOGOUT
    // ================================================================
    function logout() {
        if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('darkMode');
        window.location.href = 'login.html';
    }

    // ================================================================
    // STATUS BADGE MAP
    // ================================================================
    var STATUS_BADGE_MAP = {
        'مخطط': 'status-pending',
        'مبدئي': 'status-pending',
        'جاري': 'status-active',
        'مؤكد': 'status-active',
        'منتهي': 'status-completed',
        'مكتمل': 'status-completed',
        'ملغي': 'status-cancelled'
    };

    function statusBadgeClass(status) {
        return STATUS_BADGE_MAP[status] || 'status-pending';
    }

    // ================================================================
    // EXPOSE
    // ================================================================
    return {
        initSidebar: initSidebar,
        setCurrentDate: setCurrentDate,
        applySystemName: applySystemName,
        showToast: showToast,
        logout: logout,
        statusBadgeClass: statusBadgeClass
    };
})();
