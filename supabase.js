// ================================================================
// SUPABASE CONFIGURATION - نظام التوكن المتكامل
// ================================================================

// ================================================================
// 1. الإعدادات الأساسية
// ================================================================
var SUPABASE_CONFIG = {
    URL: 'https://exalyiwznoadnugtkyne.supabase.co',
    KEY: 'sb_publishable_ySucS0qeduwnGooAgMrPEw_coMeDbno'
};

// ================================================================
// 2. إدارة التوكن والجلسة
// ================================================================

/**
 * الحصول على الجلسة الحالية من localStorage
 */
function getSession() {
    try {
        var session = localStorage.getItem('supabase_session');
        if (!session) return null;
        return JSON.parse(session);
    } catch (e) {
        console.error('خطأ في قراءة الجلسة:', e);
        return null;
    }
}

/**
 * حفظ الجلسة في localStorage
 */
function saveSession(sessionData) {
    try {
        localStorage.setItem('supabase_session', JSON.stringify(sessionData));
        return true;
    } catch (e) {
        console.error('خطأ في حفظ الجلسة:', e);
        return false;
    }
}

/**
 * الحصول على التوكن الحالي
 */
function getToken() {
    var session = getSession();
    if (session && session.access_token) {
        return session.access_token;
    }
    return null;
}

/**
 * التحقق من صلاحية التوكن
 */
function isTokenValid() {
    var session = getSession();
    if (!session || !session.access_token) return false;
    
    if (session.expires_at) {
        var now = Math.floor(Date.now() / 1000);
        if (now >= session.expires_at) {
            console.warn('⚠️ التوكن منتهي الصلاحية');
            return false;
        }
    }
    return true;
}

/**
 * تحديث التوكن باستخدام Refresh Token
 */
async function refreshToken() {
    try {
        var session = getSession();
        if (!session || !session.refresh_token) {
            console.warn('⚠️ لا يوجد Refresh Token لتحديثه');
            return false;
        }
        
        console.log('🔄 جاري تحديث التوكن...');
        
        var response = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_CONFIG.KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: session.refresh_token
            })
        });
        
        if (!response.ok) {
            throw new Error('فشل تحديث التوكن');
        }
        
        var data = await response.json();
        
        var newSession = {
            user: data.user,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            expires_at: Math.floor(Date.now() / 1000) + data.expires_in
        };
        
        saveSession(newSession);
        console.log('✅ تم تحديث التوكن بنجاح');
        return true;
        
    } catch (error) {
        console.error('❌ فشل تحديث التوكن:', error);
        return false;
    }
}

/**
 * التحقق من وجود جلسة نشطة
 */
function isLoggedIn() {
    var session = getSession();
    return session && session.user && session.access_token;
}

/**
 * الحصول على المستخدم الحالي
 */
function getCurrentUser() {
    var session = getSession();
    return session ? session.user : null;
}

/**
 * تسجيل الخروج
 */
function logoutUser() {
    localStorage.removeItem('supabase_session');
    window.location.href = 'login.html';
}

/**
 * التحقق من الصلاحية (هل المستخدم مدير؟)
 */
function isAdmin() {
    var user = getCurrentUser();
    if (!user) return false;
    return user.user_metadata?.role === 'admin' || user.email === 'admin@qasr.com';
}

/**
 * تسجيل الدخول (للاستخدام من صفحة login)
 */
async function loginUser(email, password) {
    try {
        var response = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_CONFIG.KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        var data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error_description || data.message || 'فشل تسجيل الدخول');
        }
        
        var sessionData = {
            user: data.user,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            expires_at: Math.floor(Date.now() / 1000) + data.expires_in
        };
        
        saveSession(sessionData);
        console.log('✅ تم تسجيل الدخول بنجاح:', data.user.email);
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        throw error;
    }
}

// ================================================================
// 3. إعدادات النظام (باستخدام الجدول المباشر - الحل 1)
// ================================================================

// متغير عام لتخزين العملة الحالية
var currentCurrency = 'SAR';
var currentCurrencySymbol = 'ر.س';
var _systemSettings = null;

/**
 * الحصول على الإعدادات الافتراضية للنظام
 * @returns {Object} كائن الإعدادات الافتراضية
 */
function getDefaultSettings() {
    return {
        systemName: 'حراء للسياحة',
        language: 'ar',
        currency: 'SAR',
        dateFormat: 'ar',
        numberFormat: 'ar',
        notifyTransactions: true,
        notifyDebts: true,
        notifySystem: false,
        logoUrl: '',
        darkMode: false  // ✅ تم التعديل: false بدلاً من true
    };
}

/**
 * الحصول على الإعدادات المحلية من localStorage
 * @returns {Object} كائن الإعدادات المحلية
 */
function getLocalSettings() {
    try {
        var saved = localStorage.getItem('systemSettings');
        if (saved) {
            var settings = JSON.parse(saved);
            console.log('📂 استخدام الإعدادات من localStorage:', settings);
            _systemSettings = settings;
            currentCurrency = settings.currency || 'SAR';
            currentCurrencySymbol = getCurrencySymbol(currentCurrency);
            return settings;
        }
    } catch (e) {
        console.warn('⚠️ فشل قراءة الإعدادات من localStorage:', e);
    }
    return getDefaultSettings();
}

/**
 * جلب إعدادات المستخدم (باستخدام الجدول المباشر - بدون RPC)
 * @returns {Promise<Object>} كائن الإعدادات
 */
async function getUserSettings() {
    try {
        var user = getCurrentUser();
        if (!user) {
            console.warn('⚠️ لا يوجد مستخدم مسجل');
            return getLocalSettings();
        }

        console.log('📡 جلب الإعدادات من جدول user_settings للمستخدم:', user.id);

        try {
            var response = await fetch(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?user_id=eq.' + user.id + '&select=*', {
                method: 'GET',
                headers: getHeaders(true)
            });

            if (response.ok) {
                var data = await response.json();
                console.log('📡 استجابة الإعدادات (جدول مباشر):', data);
                
                if (data && data.length > 0) {
                    var settings = data[0];
                    var result = {
                        systemName: settings.system_name || 'حراء للسياحة',
                        language: settings.language || 'ar',
                        currency: settings.currency || 'SAR',
                        dateFormat: settings.date_format || 'ar',
                        numberFormat: settings.number_format || 'ar',
                        notifyTransactions: settings.notify_transactions !== undefined ? settings.notify_transactions : true,
                        notifyDebts: settings.notify_debts !== undefined ? settings.notify_debts : true,
                        notifySystem: settings.notify_system !== undefined ? settings.notify_system : false,
                        logoUrl: settings.logo_url || '',
                        darkMode: settings.dark_mode !== undefined ? settings.dark_mode : false  // ✅ تم التعديل: false بدلاً من true
                    };
                    
                    // تحديث المتغيرات العامة
                    _systemSettings = result;
                    currentCurrency = result.currency;
                    currentCurrencySymbol = getCurrencySymbol(currentCurrency);
                    localStorage.setItem('systemSettings', JSON.stringify(result));
                    localStorage.setItem('systemCurrency', currentCurrency);
                    
                    return result;
                }
            }
        } catch (directError) {
            console.warn('⚠️ فشل الجلب المباشر، استخدام localStorage:', directError);
        }
        
        return getLocalSettings();

    } catch (error) {
        console.error('❌ خطأ في جلب الإعدادات:', error);
        return getLocalSettings();
    }
}

/**
 * حفظ إعدادات المستخدم (باستخدام الجدول المباشر - بدون RPC)
 * @param {Object} settings - كائن الإعدادات
 * @returns {Promise<boolean>} نجاح العملية
 */
async function saveUserSettings(settings) {
    try {
        var user = getCurrentUser();
        if (!user) {
            throw new Error('لا يوجد مستخدم مسجل');
        }

        console.log('📤 حفظ الإعدادات في جدول user_settings:', settings);

        // تحويل كائن الإعدادات إلى صيغة الجدول
        var dbData = {
            user_id: user.id,
            system_name: settings.systemName || 'حراء للسياحة',
            language: settings.language || 'ar',
            currency: settings.currency || 'SAR',
            date_format: settings.dateFormat || 'ar',
            number_format: settings.numberFormat || 'ar',
            notify_transactions: settings.notifyTransactions !== undefined ? settings.notifyTransactions : true,
            notify_debts: settings.notifyDebts !== undefined ? settings.notifyDebts : true,
            notify_system: settings.notifySystem !== undefined ? settings.notifySystem : false,
            logo_url: settings.logoUrl || '',
            dark_mode: settings.darkMode !== undefined ? settings.darkMode : false,  // ✅ تم التعديل: false بدلاً من true
            updated_at: new Date().toISOString()
        };

        // محاولة تحديث (PUT)
        var response = await fetch(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?user_id=eq.' + user.id, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(dbData)
        });

        // إذا فشل PUT (ربما السجل غير موجود)، جرب POST
        if (!response.ok) {
            console.log('📤 PUT فشل (قد يكون السجل غير موجود)، محاولة POST...');
            
            var postResponse = await fetch(SUPABASE_CONFIG.URL + '/rest/v1/user_settings', {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(dbData)
            });

            if (!postResponse.ok) {
                var errorText = await postResponse.text();
                throw new Error('فشل حفظ الإعدادات (POST): ' + errorText);
            }
            console.log('✅ تم إنشاء الإعدادات (POST)');
        } else {
            console.log('✅ تم تحديث الإعدادات (PUT)');
        }

        // تحديث المتغيرات العامة
        _systemSettings = settings;
        currentCurrency = settings.currency || 'SAR';
        currentCurrencySymbol = getCurrencySymbol(currentCurrency);

        // تحديث localStorage
        localStorage.setItem('systemSettings', JSON.stringify(settings));
        localStorage.setItem('systemCurrency', currentCurrency);

        console.log('✅ تم حفظ الإعدادات في Supabase');
        return true;

    } catch (error) {
        console.error('❌ خطأ في حفظ الإعدادات:', error);
        throw error;
    }
}

// ================================================================
// 4. دوال الإعدادات الجديدة (لصفحة settings.html)
// ================================================================

/**
 * تحديث إعدادات النظام (واجهة مبسطة)
 * @param {Object} settings - كائن الإعدادات
 * @returns {Promise<Object>} نتيجة التحديث
 */
async function updateSystemSettings(settings) {
    try {
        console.log('📤 تحديث إعدادات النظام:', settings);
        
        var user = getCurrentUser();
        if (!user) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }
        
        await saveUserSettings(settings);
        
        // تحديث cache
        _systemSettings = settings;
        currentCurrency = settings.currency || 'SAR';
        currentCurrencySymbol = getCurrencySymbol(currentCurrency);
        
        // تحديث الواجهة
        applySystemName();
        applySystemLogo();
        
        return { success: true, settings: settings };
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإعدادات:', error);
        throw error;
    }
}

/**
 * رفع شعار النظام
 * @param {File} file - ملف الصورة
 * @returns {Promise<Object>} نتيجة الرفع
 */
async function uploadLogo(file) {
    try {
        console.log('📤 جاري رفع الشعار...');
        
        var user = getCurrentUser();
        if (!user) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }
        
        // التحقق من حجم الملف
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
        }
        
        if (!file.type.startsWith('image/')) {
            throw new Error('الرجاء اختيار ملف صورة صحيح');
        }
        
        // قراءة الملف كـ base64
        var base64 = await new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { reject(reader.error); };
            reader.readAsDataURL(file);
        });
        
        // حفظ الشعار في الإعدادات
        var settings = await getUserSettings();
        settings.logoUrl = base64;
        
        await saveUserSettings(settings);
        
        // تحديث cache
        _systemSettings = settings;
        
        // تطبيق الشعار على الواجهة
        applySystemLogo();
        
        console.log('✅ تم رفع الشعار بنجاح');
        return { success: true, logoUrl: base64 };
        
    } catch (error) {
        console.error('❌ خطأ في رفع الشعار:', error);
        throw error;
    }
}

/**
 * حذف شعار النظام
 * @returns {Promise<Object>} نتيجة الحذف
 */
async function removeLogo() {
    try {
        console.log('🗑️ جاري حذف الشعار...');
        
        var settings = await getUserSettings();
        delete settings.logoUrl;
        
        await saveUserSettings(settings);
        
        // تحديث cache
        _systemSettings = settings;
        
        // تطبيق الشعار على الواجهة
        applySystemLogo();
        
        console.log('✅ تم حذف الشعار بنجاح');
        return { success: true };
        
    } catch (error) {
        console.error('❌ خطأ في حذف الشعار:', error);
        throw error;
    }
}

/**
 * إعادة تعيين النظام إلى الإعدادات الافتراضية
 * @returns {Promise<Object>} نتيجة إعادة التعيين
 */
async function resetSystem() {
    try {
        console.log('🔄 جاري إعادة تعيين النظام...');
        
        var user = getCurrentUser();
        if (!user) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }
        
        // حذف جميع البيانات من الجداول
        var tables = ['transactions', 'clients', 'cars', 'banks', 'services'];
        
        for (var i = 0; i < tables.length; i++) {
            try {
                var table = tables[i];
                var response = await fetch(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?user_id=eq.' + user.id, {
                    method: 'DELETE',
                    headers: getHeaders(true)
                });
                if (!response.ok) {
                    console.warn('⚠️ خطأ في حذف بيانات ' + table + ':', response.status);
                }
            } catch (e) {
                console.warn('⚠️ فشل حذف ' + table + ':', e);
            }
        }
        
        // حذف إعدادات المستخدم
        try {
            await fetch(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?user_id=eq.' + user.id, {
                method: 'DELETE',
                headers: getHeaders(true)
            });
        } catch (e) {
            console.warn('⚠️ فشل حذف الإعدادات:', e);
        }
        
        // إعادة تعيين الإعدادات
        var defaultSettings = getDefaultSettings();
        await saveUserSettings(defaultSettings);
        
        // تنظيف localStorage
        localStorage.removeItem('systemSettings');
        localStorage.removeItem('systemLogo');
        
        console.log('✅ تم إعادة تعيين النظام بنجاح');
        return { success: true };
        
    } catch (error) {
        console.error('❌ خطأ في إعادة تعيين النظام:', error);
        throw error;
    }
}

/**
 * تصدير جميع البيانات
 * @returns {Promise<Object>} كائن يحتوي على جميع البيانات
 */
async function exportAllData() {
    try {
        console.log('📤 جاري تصدير البيانات...');
        
        var user = getCurrentUser();
        if (!user) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }
        
        var tables = ['transactions', 'clients', 'cars', 'banks', 'services'];
        var result = {};
        
        for (var i = 0; i < tables.length; i++) {
            try {
                var table = tables[i];
                var data = await fetchData(table);
                result[table] = data || [];
            } catch (e) {
                console.warn('⚠️ فشل تصدير ' + table + ':', e);
                result[table] = [];
            }
        }
        
        // إضافة الإعدادات
        result.settings = await getUserSettings();
        result.exportedAt = new Date().toISOString();
        
        console.log('✅ تم تصدير البيانات بنجاح');
        return result;
        
    } catch (error) {
        console.error('❌ خطأ في تصدير البيانات:', error);
        throw error;
    }
}

/**
 * حذف جميع البيانات
 * @returns {Promise<Object>} نتيجة الحذف
 */
async function clearAllData() {
    try {
        console.log('🗑️ جاري حذف جميع البيانات...');
        
        var user = getCurrentUser();
        if (!user) {
            throw new Error('يجب تسجيل الدخول أولاً');
        }
        
        var tables = ['transactions', 'clients', 'cars', 'banks', 'services'];
        
        for (var i = 0; i < tables.length; i++) {
            try {
                var table = tables[i];
                var response = await fetch(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?user_id=eq.' + user.id, {
                    method: 'DELETE',
                    headers: getHeaders(true)
                });
                if (!response.ok) {
                    console.warn('⚠️ خطأ في حذف بيانات ' + table + ':', response.status);
                }
            } catch (e) {
                console.warn('⚠️ فشل حذف ' + table + ':', e);
            }
        }
        
        console.log('✅ تم حذف جميع البيانات بنجاح');
        return { success: true };
        
    } catch (error) {
        console.error('❌ خطأ في حذف البيانات:', error);
        throw error;
    }
}

// ================================================================
// 5. دوال API الأساسية (مع نظام إعادة المحاولة)
// ================================================================

/**
 * الحصول على Headers مع التوكن
 * @param {boolean} includeAuth - هل يتضمن التوكن
 * @returns {Object} كائن الـ Headers
 */
function getHeaders(includeAuth) {
    var headers = {
        'apikey': SUPABASE_CONFIG.KEY,
        'Content-Type': 'application/json'
    };
    
    if (includeAuth !== false) {
        var token = getToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
    }
    
    return headers;
}

/**
 * تنفيذ طلب مع إعادة المحاولة عند انتهاء التوكن
 * @param {string} url - رابط الطلب
 * @param {Object} options - خيارات الطلب
 * @param {number} retryCount - عدد محاولات إعادة المحاولة
 * @returns {Promise<Response>} استجابة الطلب
 */
async function fetchWithRetry(url, options, retryCount) {
    retryCount = retryCount || 0;
    var maxRetries = 2;
    
    try {
        var response = await fetch(url, options);
        
        if (response.status === 401 && retryCount < maxRetries) {
            console.warn('⚠️ توكن منتهي الصلاحية، محاولة التحديث...');
            
            var refreshed = await refreshToken();
            
            if (refreshed) {
                options.headers = getHeaders(true);
                console.log('🔄 إعادة المحاولة مع التوكن الجديد...');
                return await fetchWithRetry(url, options, retryCount + 1);
            } else {
                console.warn('⚠️ فشل تحديث التوكن، استخدام المفتاح العام...');
                var publicHeaders = {
                    'apikey': SUPABASE_CONFIG.KEY,
                    'Content-Type': 'application/json'
                };
                options.headers = publicHeaders;
                return await fetchWithRetry(url, options, retryCount + 1);
            }
        }
        
        return response;
        
    } catch (error) {
        if (retryCount < maxRetries) {
            console.warn('⚠️ خطأ في الطلب، إعادة المحاولة...', retryCount + 1);
            return await fetchWithRetry(url, options, retryCount + 1);
        }
        throw error;
    }
}

/**
 * جلب البيانات من جدول في Supabase
 * @param {string} table - اسم الجدول
 * @param {Object} options - خيارات الجلب (order, limit, filter)
 * @returns {Promise<Array>} مصفوفة البيانات
 */
async function fetchData(table, options) {
    try {
        var url = SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?select=*';
        
        if (options) {
            if (options.order) {
                url += '&order=' + options.order + '.desc';
            }
            if (options.limit) {
                url += '&limit=' + options.limit;
            }
            if (options.filter) {
                for (var key in options.filter) {
                    url += '&' + key + '=eq.' + options.filter[key];
                }
            }
        }
        
        var headers = getHeaders(true);
        console.log('📡 جلب البيانات من:', url);
        
        var response = await fetchWithRetry(url, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('خطأ في جلب البيانات من ' + table + ':', error);
        throw error;
    }
}

/**
 * إضافة بيانات إلى جدول في Supabase
 * @param {string} table - اسم الجدول
 * @param {Object} data - البيانات المراد إضافتها
 * @returns {Promise<Object>} البيانات المضافة
 */
async function addData(table, data) {
    try {
        var headers = getHeaders(true);
        
        var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/' + table, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            var errorText = await response.text();
            throw new Error('فشل إضافة البيانات: ' + errorText);
        }
        
        var text = await response.text();
        if (text && text.length > 0) {
            return JSON.parse(text);
        }
        return {};
        
    } catch (error) {
        console.error('خطأ في إضافة البيانات إلى ' + table + ':', error);
        throw error;
    }
}

/**
 * تحديث بيانات في جدول في Supabase
 * @param {string} table - اسم الجدول
 * @param {string|number} id - معرف السجل
 * @param {Object} data - البيانات المراد تحديثها
 * @returns {Promise<Object>} البيانات المحدثة
 */
async function updateData(table, id, data) {
    try {
        var headers = getHeaders(true);
        
        var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?id=eq.' + id, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            var errorText = await response.text();
            throw new Error('فشل تحديث البيانات: ' + errorText);
        }
        
        var text = await response.text();
        if (text && text.length > 0) {
            return JSON.parse(text);
        }
        return {};
        
    } catch (error) {
        console.error('خطأ في تحديث البيانات في ' + table + ':', error);
        throw error;
    }
}

/**
 * حذف بيانات من جدول في Supabase
 * @param {string} table - اسم الجدول
 * @param {string|number} id - معرف السجل
 * @returns {Promise<boolean>} نجاح العملية
 */
async function deleteData(table, id) {
    try {
        var headers = getHeaders(true);
        
        var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?id=eq.' + id, {
            method: 'DELETE',
            headers: headers
        });
        
        if (!response.ok) {
            var errorText = await response.text();
            throw new Error('فشل حذف البيانات: ' + errorText);
        }
        
        return true;
        
    } catch (error) {
        console.error('خطأ في حذف البيانات من ' + table + ':', error);
        throw error;
    }
}

// ================================================================
// 6. دوال خاصة بجداول النظام
// ================================================================

/**
 * جلب المعاملات المالية
 * @param {number} limit - الحد الأقصى لعدد السجلات
 * @returns {Promise<Array>} مصفوفة المعاملات
 */
async function getTransactions(limit) {
    return await fetchData('transactions', {
        order: 'date',
        limit: limit || 200
    });
}

/**
 * جلب البنوك
 * @returns {Promise<Array>} مصفوفة البنوك
 */
async function getBanks() {
    return await fetchData('banks');
}

/**
 * جلب السيارات
 * @returns {Promise<Array>} مصفوفة السيارات
 */
async function getCars() {
    return await fetchData('cars');
}

/**
 * جلب العملاء
 * @returns {Promise<Array>} مصفوفة العملاء
 */
async function getClients() {
    return await fetchData('clients');
}

/**
 * جلب المستخدمين
 * @returns {Promise<Array>} مصفوفة المستخدمين
 */
async function getUsers() {
    return await fetchData('users');
}

/**
 * جلب الخدمات
 * @returns {Promise<Array>} مصفوفة الخدمات
 */
async function getServices() {
    return await fetchData('services');
}

// ---- وحدات السياحة الدينية ----

/**
 * جلب الرحلات
 * @returns {Promise<Array>} مصفوفة الرحلات
 */
async function getTrips() {
    return await fetchData('trips', { order: 'departure_date' });
}

/**
 * جلب الحجوزات
 * @param {string} tripId - معرف الرحلة (اختياري)
 * @returns {Promise<Array>} مصفوفة الحجوزات
 */
async function getBookings(tripId) {
    var opts = {};
    if (tripId) opts.filter = { trip_id: tripId };
    return await fetchData('bookings', opts);
}

/**
 * جلب الفنادق
 * @returns {Promise<Array>} مصفوفة الفنادق
 */
async function getHotels() {
    return await fetchData('hotels');
}

/**
 * جلب المناديب
 * @returns {Promise<Array>} مصفوفة المناديب
 */
async function getRepresentatives() {
    return await fetchData('representatives');
}

/**
 * جلب معاملات المناديب
 * @param {string} repId - معرف المندوب (اختياري)
 * @returns {Promise<Array>} مصفوفة المعاملات
 */
async function getRepTransactions(repId) {
    var opts = {};
    if (repId) opts.filter = { rep_id: repId };
    return await fetchData('rep_transactions', opts);
}

/**
 * جلب الوكلاء
 * @returns {Promise<Array>} مصفوفة الوكلاء
 */
async function getAgents() {
    return await fetchData('agents');
}

// ================================================================
// 7. دوال خاصة بالشعار
// ================================================================

/**
 * الحصول على شعار النظام
 * @returns {string|null} رابط الشعار أو null
 */
function getSystemLogo() {
    try {
        var settings = _systemSettings || getLocalSettings();
        if (settings && settings.logoUrl && settings.logoUrl.length > 100) {
            return settings.logoUrl;
        }
        var logo = localStorage.getItem('systemLogo');
        if (logo && logo.length > 100) {
            return logo;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * تطبيق شعار النظام على جميع عناصر الواجهة
 */
function applySystemLogo() {
    var logo = getSystemLogo();
    var logoElements = document.querySelectorAll('.brand-logo-img, .navbar-logo-img, #ledgerLogoImg, #logoPreview');
    
    logoElements.forEach(function(el) {
        if (logo) {
            el.src = logo;
            el.style.display = 'block';
            el.classList.add('visible');
        } else {
            el.style.display = 'none';
            el.classList.remove('visible');
        }
    });
    
    var fallbacks = document.querySelectorAll('.brand-mark, #sidebarLogoFallback, #ledgerPlaceholder, #logoPlaceholder');
    fallbacks.forEach(function(el) {
        if (logo) {
            el.style.display = 'none';
            el.classList.add('hidden');
        } else {
            el.style.display = 'flex';
            el.classList.remove('hidden');
        }
    });
    
    console.log('🖼️ تم تطبيق شعار النظام');
}

// ================================================================
// 8. دوال خاصة باسم النظام
// ================================================================

/**
 * الحصول على اسم النظام
 * @returns {string} اسم النظام
 */
function getSystemName() {
    var settings = _systemSettings || getLocalSettings();
    return settings.systemName || 'حراء للسياحة';
}

/**
 * الحصول على إعدادات النظام بالكامل
 * @returns {Object} كائن الإعدادات
 */
function getSystemSettings() {
    return _systemSettings || getLocalSettings();
}

/**
 * الحصول على العملة الحالية
 * @returns {string} رمز العملة
 */
function getCurrency() {
    return currentCurrency || 'SAR';
}

/**
 * الحصول على رمز العملة
 * @param {string} currencyCode - رمز العملة
 * @returns {string} رمز العملة للتنسيق
 */
function getCurrencySymbol(currencyCode) {
    var symbols = {
        'SAR': 'ر.س',
        'AED': 'د.إ',
        'EGP': 'ج.م',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'KWD': 'د.ك',
        'BHD': 'د.ب',
        'OMR': 'ر.ع',
        'QAR': 'ر.ق'
    };
    return symbols[currencyCode] || 'ر.س';
}

/**
 * تنسيق المبلغ بالعملة
 * @param {number} amount - المبلغ
 * @param {string} currencyCode - رمز العملة (اختياري)
 * @returns {string} المبلغ المنسق
 */
function formatCurrency(amount, currencyCode) {
    if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
    
    var code = currencyCode || currentCurrency || 'SAR';
    var symbol = getCurrencySymbol(code);
    var settings = _systemSettings || getLocalSettings();
    var numberFormat = settings.numberFormat || 'ar';
    
    var formatted = amount.toLocaleString(numberFormat === 'ar' ? 'ar-SA' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    
    return formatted + ' ' + symbol;
}

/**
 * تطبيق اسم النظام على جميع عناصر الواجهة
 */
function applySystemName() {
    var systemName = getSystemName();
    
    var currentTitle = document.title;
    if (currentTitle.includes(' - ')) {
        var pagePart = currentTitle.split(' - ')[0];
        document.title = pagePart + ' - ' + systemName;
    } else if (!currentTitle.includes(systemName)) {
        document.title = systemName + ' | ' + currentTitle;
    }
    
    var brandTexts = document.querySelectorAll('.brand-text');
    brandTexts.forEach(function(el) {
        var html = el.innerHTML;
        if (html.includes('قصر') || html.includes('حراء') || html.includes('النظام المحاسبي')) {
            el.innerHTML = systemName + ' <small>النظام المحاسبي المتكامل</small>';
        }
    });
    
    var navbarTexts = document.querySelectorAll('.navbar-logo-text');
    navbarTexts.forEach(function(el) {
        if (el.textContent.includes('قصر') || el.textContent.includes('حراء')) {
            el.innerHTML = systemName;
        }
    });
    
    var userRole = document.getElementById('userRole');
    if (userRole) {
        userRole.textContent = systemName;
    }
}

// ================================================================
// 9. دوال إدارة الثيم والمظهر
// ================================================================

/**
 * تطبيق الوضع المظلم أو الفاتح بناءً على الإعدادات
 * @param {boolean} forceDark - (اختياري) فرض الوضع المظلم
 * @returns {boolean} حالة الوضع المظلم بعد التطبيق
 */
function applyTheme(forceDark) {
    try {
        var settings = _systemSettings || getLocalSettings();
        var isDarkMode = false;
        
        if (forceDark !== undefined) {
            isDarkMode = forceDark;
        } else {
            isDarkMode = settings.darkMode !== undefined ? settings.darkMode : false;  // ✅ false افتراضياً
        }
        
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        var toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            var icon = toggle.querySelector('i');
            if (icon) {
                icon.className = isDarkMode ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
            }
        }
        
        localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
        console.log('🎨 تم تطبيق الثيم:', isDarkMode ? 'مظلم' : 'فاتح');
        return isDarkMode;
        
    } catch (error) {
        console.warn('⚠️ فشل تطبيق الثيم:', error);
        return false;
    }
}

/**
 * تبديل الوضع المظلم وحفظ الإعداد في قاعدة البيانات
 * @param {boolean} isDark - حالة الوضع المظلم
 * @returns {Promise<boolean>} النتيجة
 */
async function toggleTheme(isDark) {
    try {
        console.log('🎨 تبديل الثيم إلى:', isDark ? 'مظلم' : 'فاتح');
        
        var settings = await getUserSettings();
        settings.darkMode = isDark;
        
        await saveUserSettings(settings);
        
        _systemSettings = settings;
        applyTheme(isDark);
        
        console.log('✅ تم حفظ إعداد الثيم في قاعدة البيانات');
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تبديل الثيم:', error);
        applyTheme(isDark);
        localStorage.setItem('darkMode', isDark ? 'true' : 'false');
        return false;
    }
}

/**
 * الحصول على حالة الوضع المظلم الحالية
 * @returns {boolean} true إذا كان الوضع مظلماً
 */
function isDarkModeEnabled() {
    var settings = _systemSettings || getLocalSettings();
    return settings.darkMode !== undefined ? settings.darkMode : false;  // ✅ false افتراضياً
}

// ================================================================
// 10. الدوال الرئيسية عند تحميل أي صفحة
// ================================================================

/**
 * تهيئة النظام عند تحميل الصفحة
 * @returns {boolean} نجاح التهيئة
 */
function initSystem() {
    applySystemName();
    applySystemLogo();
    updateUserUI();
    
    // تطبيق الثيم من الإعدادات
    applyTheme();
    
    if (isLoggedIn() && !isTokenValid()) {
        console.warn('⚠️ التوكن غير صالح، محاولة التحديث...');
        refreshToken().then(function(success) {
            if (!success) {
                console.warn('⚠️ فشل تحديث التوكن، قد تحتاج لتسجيل الدخول مرة أخرى');
            }
        });
    }
    
    return true;
}

/**
 * تحديث واجهة المستخدم بمعلومات المستخدم الحالي
 */
function updateUserUI() {
    var user = getCurrentUser();
    if (!user) return;
    
    var userName = document.getElementById('userName');
    var userRole = document.getElementById('userRole');
    var userAvatar = document.getElementById('userAvatar');
    
    var name = user.user_metadata?.full_name || user.email || 'مستخدم';
    var role = user.user_metadata?.role || 'مستخدم';
    
    if (userName) userName.textContent = name;
    if (userRole) userRole.textContent = role;
    if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
}

// ================================================================
// 11. تحديث المتغيرات العامة عند التحميل
// ================================================================

(function initCurrency() {
    try {
        var settings = getLocalSettings();
        if (settings && settings.currency) {
            currentCurrency = settings.currency;
            currentCurrencySymbol = getCurrencySymbol(currentCurrency);
            localStorage.setItem('systemCurrency', currentCurrency);
            console.log('💰 العملة المحملة:', currentCurrency, currentCurrencySymbol);
        }
    } catch (e) {
        console.warn('⚠️ فشل تحميل العملة:', e);
    }
})();

// ================================================================
// 12. تصدير الدوال
// ================================================================

window.Supabase = {
    CONFIG: SUPABASE_CONFIG,
    
    // التوكن والجلسة
    getSession: getSession,
    saveSession: saveSession,
    getToken: getToken,
    isTokenValid: isTokenValid,
    refreshToken: refreshToken,
    isLoggedIn: isLoggedIn,
    getCurrentUser: getCurrentUser,
    logoutUser: logoutUser,
    isAdmin: isAdmin,
    loginUser: loginUser,
    
    // الإعدادات
    getSystemSettings: getSystemSettings,
    getSystemName: getSystemName,
    getCurrency: getCurrency,
    getCurrencySymbol: getCurrencySymbol,
    formatCurrency: formatCurrency,
    
    getUserSettings: getUserSettings,
    saveUserSettings: saveUserSettings,
    updateSystemSettings: updateSystemSettings,
    getLocalSettings: getLocalSettings,
    
    // الشعار
    getSystemLogo: getSystemLogo,
    applySystemLogo: applySystemLogo,
    uploadLogo: uploadLogo,
    removeLogo: removeLogo,
    
    // بيانات النظام
    resetSystem: resetSystem,
    exportAllData: exportAllData,
    clearAllData: clearAllData,
    
    // API
    getHeaders: getHeaders,
    fetchWithRetry: fetchWithRetry,
    fetchData: fetchData,
    addData: addData,
    updateData: updateData,
    deleteData: deleteData,
    
    // جداول
    getTransactions: getTransactions,
    getBanks: getBanks,
    getCars: getCars,
    getTrips: getTrips,
    getBookings: getBookings,
    getHotels: getHotels,
    getRepresentatives: getRepresentatives,
    getRepTransactions: getRepTransactions,
    getAgents: getAgents,
    getClients: getClients,
    getUsers: getUsers,
    getServices: getServices,
    
    // النظام
    initSystem: initSystem,
    updateUserUI: updateUserUI,
    applySystemName: applySystemName,
    
    // الثيم
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    isDarkModeEnabled: isDarkModeEnabled,
    
    // المتغيرات العامة
    currentCurrency: currentCurrency,
    currentCurrencySymbol: currentCurrencySymbol
};

// ================================================================
// 13. رسائل التهيئة
// ================================================================

console.log('📦 تم تحميل Supabase.js - نظام التوكن المتكامل');
console.log('📡 URL:', SUPABASE_CONFIG.URL);
console.log('🔑 التوكن:', getToken() ? 'موجود ✅' : 'غير موجود ❌');
console.log('💰 العملات المتاحة: SAR, AED, EGP, USD, EUR');
console.log('⚙️ الإعدادات محفوظة في جدول user_settings (بدون RPC)');
console.log('💰 العملة الحالية:', currentCurrency, currentCurrencySymbol);
console.log('🎨 الوضع المظلم:', isDarkModeEnabled() ? 'مفعل ✅' : 'غير مفعل ❌ (الوضع الفاتح افتراضي)');
