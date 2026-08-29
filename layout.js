/* ================================================================
   layout.js — نظام حراء للسياحة
   سلوكيات مشتركة لكل صفحات النظام (Sidebar / اسم النظام / Toast / تسجيل الخروج)
   ================================================================ */
var Layout = (function () {

    function toggleSidebar() {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('open');
    }

    function initMobileSidebar() {
        var sidebar = document.getElementById('sidebar');
        var toggleBtn = document.querySelector('[data-sidebar-toggle]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && sidebar) sidebar.classList.remove('open');
        });
    }

    function setCurrentDate(elementId) {
        var el = document.getElementById(elementId || 'current-date');
        if (!el) return;
        var now = new Date();
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        el.textContent = now.toLocaleDateString('ar-EG', options);
    }

    // pageLabel: عنوان الصفحة اللي هيتحط قبل اسم النظام في <title>، مثال: "الرحلات"
    function applySystemName(pageLabel) {
        var systemName = 'حراء للسياحة';
        try {
            systemName = Supabase.getSystemName() || systemName;
        } catch (e) {
            console.warn('تعذر جلب اسم النظام، سيتم استخدام الاسم الافتراضي');
        }

        document.title = (pageLabel ? pageLabel + ' - ' : '') + systemName;

        var brand = document.getElementById('sidebarBrandText');
        if (brand) brand.innerHTML = '🕋 ' + systemName;

        var mobileBrand = document.getElementById('mobileBrandText');
        if (mobileBrand) mobileBrand.innerHTML = '🕋 ' + systemName;

        var welcome = document.getElementById('welcomeTitle');
        if (welcome) welcome.textContent = 'مرحباً بك في ' + systemName + ' 👋';

        var footer = document.getElementById('footerText');
        if (footer) footer.textContent = '© ' + new Date().getFullYear() + ' ' + systemName + ' — جميع الحقوق محفوظة';

        return systemName;
    }

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

    function logout() {
        if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('darkMode');
        window.location.href = 'login.html';
    }

    // خريطة عامة لتحويل حالات النظام (رحلات/حجوزات) لكلاس الشارة المناسب
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

    return {
        toggleSidebar: toggleSidebar,
        initMobileSidebar: initMobileSidebar,
        setCurrentDate: setCurrentDate,
        applySystemName: applySystemName,
        showToast: showToast,
        logout: logout,
        statusBadgeClass: statusBadgeClass
    };
})();
