// ================================================================
// SUPABASE CONFIGURATION - نظام التوكن المتكامل
// ================================================================

// ================================================================
// 1. الإعدادات الأساسية
// ================================================================
var SUPABASE_CONFIG = {
    URL: 'https://brorzaovgdleimkpddge.supabase.co',
    KEY: 'sb_publishable_vI-TlaFqvgyi_pryplScAg_L_nqubuQ'
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
 * ملاحظة أمان: لا يجب الاعتماد على user_metadata من التوكن لأن
 * المستخدم نفسه يقدر يعدّلها عبر Auth API مباشرة. المصدر الموثوق
 * الوحيد هو عمود role في جدول public.users (محمي بـ RLS: كل مستخدم
 * يقرأ صفّه فقط)، لذلك الدالة async وبتستعلم القيمة من القاعدة كل مرة.
 */
/**
 * التحقق من صلاحية المدير.
 * ملاحظة مهمة: بترجع true / false لو التحقق تم بنجاح فعليًا،
 * وبترجع null لو تعذر التحقق (خطأ شبكة، انقطاع، جدول غير موجود... إلخ) —
 * الفرق ده مهم عشان الصفحات اللي بتمنع الوصول متطردش المستخدم بسبب
 * خطأ مؤقت وهي أصلًا معندهاش قرار نهائي بعد.
 */
async function isAdmin() {
    var session = getSession();
    var user = getCurrentUser();
    if (!user || !session || !session.access_token) return false;

    try {
        var response = await fetch(
            SUPABASE_CONFIG.URL + '/rest/v1/users?id=eq.' + user.id + '&select=role',
            {
                headers: {
                    'apikey': SUPABASE_CONFIG.KEY,
                    'Authorization': 'Bearer ' + session.access_token
                }
            }
        );
        if (!response.ok) {
            console.warn('⚠️ تعذر التحقق من صلاحية المدير (استجابة غير ناجحة):', response.status);
            return null; // تعذر التحقق — مش "مش مدير"
        }
        var rows = await response.json();
        if (!rows || !rows[0]) {
            console.warn('⚠️ لم يتم العثور على سجل المستخدم في users');
            return null; // تعذر التحقق
        }
        return rows[0].role === 'admin';
    } catch (e) {
        console.error('❌ خطأ في التحقق من صلاحية المدير:', e);
        return null; // تعذر التحقق — خطأ شبكة/اتصال
    }
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

/**
 * تحديث بيانات الملف الشخصي (الاسم ورقم الهاتف) للمستخدم الحالي
 * يحدّث user_metadata في Auth وأيضاً جدول public.users للتوافق مع صفحة المستخدمين
 */
async function updateUserProfile(fullName, phone) {
    try {
        var session = getSession();
        if (!session || !session.access_token) {
            return { error: { message: 'يجب تسجيل الدخول أولاً' } };
        }

        var response = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/user', {
            method: 'PUT',
            headers: {
                'apikey': SUPABASE_CONFIG.KEY,
                'Authorization': 'Bearer ' + session.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: { full_name: fullName, phone: phone } })
        });

        var data = await response.json();

        if (!response.ok) {
            return { error: { message: data.error_description || data.msg || data.message || 'فشل تحديث الملف الشخصي' } };
        }

        // تحديث الجلسة المحلية بالبيانات الجديدة
        session.user = data;
        saveSession(session);

        // تحديث جدول public.users أيضاً (لصفحة إدارة المستخدمين)
        try {
            await fetch(SUPABASE_CONFIG.URL + '/rest/v1/users?id=eq.' + data.id, {
                method: 'PATCH',
                headers: getHeaders(true),
                body: JSON.stringify({ full_name: fullName })
            });
        } catch (e) {
            console.warn('⚠️ تعذّر تحديث جدول public.users:', e);
        }

        return { error: null, user: data };

    } catch (error) {
        console.error('❌ خطأ في تحديث الملف الشخصي:', error);
        return { error: { message: error.message || 'فشل تحديث الملف الشخصي' } };
    }
}

/**
 * تغيير كلمة مرور المستخدم الحالي (بعد التحقق من كلمة المرور الحالية)
 */
async function changePassword(currentPassword, newPassword) {
    try {
        var session = getSession();
        if (!session || !session.user || !session.user.email) {
            return { error: { message: 'يجب تسجيل الدخول أولاً' } };
        }

        // التحقق من كلمة المرور الحالية عبر محاولة تسجيل دخول
        var verifyResponse = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { 'apikey': SUPABASE_CONFIG.KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: session.user.email, password: currentPassword })
        });

        if (!verifyResponse.ok) {
            return { error: { message: 'كلمة المرور الحالية غير صحيحة' } };
        }

        // تحديث كلمة المرور
        var response = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/user', {
            method: 'PUT',
            headers: {
                'apikey': SUPABASE_CONFIG.KEY,
                'Authorization': 'Bearer ' + session.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPassword })
        });

        var data = await response.json();

        if (!response.ok) {
            return { error: { message: data.error_description || data.msg || data.message || 'فشل تغيير كلمة المرور' } };
        }

        return { error: null };

    } catch (error) {
        console.error('❌ خطأ في تغيير كلمة المرور:', error);
        return { error: { message: error.message || 'فشل تغيير كلمة المرور' } };
    }
}

/**
 * إضافة مستخدم جديد (تُستخدم من صفحة إدارة المستخدمين users.html)
 *
 * ملاحظة مهمة: التطبيق ده front-end بحت وماعندوش مفتاح Service Role، فمفيش
 * طريقة "إدارية" حقيقية لإنشاء مستخدمين في Supabase Auth. اللي بيحصل فعليًا
 * هو نفس اللي بيحصل في register.html بالظبط: بنستخدم مسار التسجيل العام
 * (auth/v1/signup) لإنشاء حساب Auth حقيقي، وبعدين نضيف صف مقابل له في جدول
 * public.users ببيانات الاسم/الدور — باستخدام جلسة المدير الحالي (مسموح
 * بالإضافة لأي مستخدم مسجّل دخول حسب سياسة users_insert).
 *
 * تنبيه: لو إعدادات المشروع في Supabase مفعّل فيها "تأكيد البريد الإلكتروني"،
 * الحساب الجديد هيتطلب من صاحبه يفتح إيميله ويأكّد قبل ما يقدر يسجّل دخول —
 * ده سلوك Supabase نفسه ومش حاجة نقدر نتخطاها من غير مفتاح إداري.
 */
async function addUser(email, password, fullName, role) {
    try {
        if (!email || !password) {
            return { error: { message: 'البريد الإلكتروني وكلمة المرور مطلوبان' } };
        }

        var signupResponse = await fetch(SUPABASE_CONFIG.URL + '/auth/v1/signup', {
            method: 'POST',
            headers: { 'apikey': SUPABASE_CONFIG.KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        var signupData = await signupResponse.json();

        if (!signupResponse.ok) {
            var msg = signupData.error_description || signupData.msg || signupData.message || 'فشل إنشاء حساب المستخدم';
            if (String(msg).toLowerCase().includes('already registered')) {
                msg = 'هذا البريد الإلكتروني مسجل بالفعل';
            }
            return { error: { message: msg } };
        }

        var newUserId = signupData.id || (signupData.user && signupData.user.id);
        if (!newUserId) {
            return { error: { message: 'تم إنشاء الحساب لكن لم يتم استلام رقم المستخدم' } };
        }

        var profileResult = await addData('users', {
            id: newUserId,
            full_name: fullName,
            email: email,
            role: role || 'user',
            is_active: true
        });

        return { error: null, data: profileResult };

    } catch (error) {
        console.error('❌ خطأ في إضافة المستخدم:', error);
        return { error: { message: error.message || 'فشل إضافة المستخدم' } };
    }
}

/**
 * نداء Edge Function الإدارية (admin-users) — الغرض الوحيد منها تنفيذ
 * عمليات محتاجة Service Role Key (تغيير كلمة مرور مستخدم آخر، حذف حساب
 * Auth فعليًا) في مكان آمن على السيرفر. راجع STEP11_README.md لخطوات
 * نشرها على Supabase.
 * لازم تكون الدالة منشورة (supabase functions deploy admin-users) قبل
 * ما أي من العمليتين دول تشتغل، وإلا هترجع رسالة خطأ واضحة.
 */
async function callAdminUsersFunction(action, payload) {
    var session = getSession();
    if (!session || !session.access_token) {
        return { error: { message: 'الجلسة منتهية — سجّل دخول تاني' } };
    }

    try {
        var response = await fetch(SUPABASE_CONFIG.URL + '/functions/v1/admin-users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_CONFIG.KEY,
                'Authorization': 'Bearer ' + session.access_token
            },
            body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        });

        var data = await response.json().catch(function() { return {}; });

        if (!response.ok) {
            var msg = (data && data.error) || 'فشل تنفيذ العملية';
            if (response.status === 404) {
                msg = 'دالة admin-users مش منشورة على Supabase بعد — راجع STEP11_README.md';
            }
            return { error: { message: msg } };
        }

        return { error: null, data: data };
    } catch (error) {
        console.error('❌ خطأ في نداء admin-users:', error);
        return { error: { message: 'تعذر الوصول لدالة admin-users — تأكد من نشرها ومن اتصال الشبكة' } };
    }
}

/**
 * تحديث بيانات مستخدم (الاسم/الدور/حالة التفعيل) من جدول public.users،
 * وتغيير كلمة المرور (اختياري) عبر Edge Function الإدارية admin-users.
 */
async function updateUser(id, data) {
    if (data && data.password) {
        var pwResult = await callAdminUsersFunction('set_password', {
            userId: id,
            newPassword: data.password
        });
        if (pwResult.error) return pwResult;
    }

    try {
        var payload = {};
        if (data.full_name !== undefined) payload.full_name = data.full_name;
        if (data.role !== undefined) payload.role = data.role;
        if (data.is_active !== undefined) payload.is_active = data.is_active;

        var result = (Object.keys(payload).length > 0) ? await updateData('users', id, payload) : null;
        return { error: null, data: result };
    } catch (error) {
        console.error('❌ خطأ في تحديث المستخدم:', error);
        return { error: { message: error.message || 'فشل تحديث المستخدم' } };
    }
}

/**
 * حذف مستخدم — حذف حقيقي وكامل لحساب الـ Auth عبر Edge Function
 * الإدارية admin-users. صف public.users بيتحذف تلقائيًا معاه بسبب
 * "on delete cascade" في database_schema.sql، فمفيش داعي لنداء منفصل.
 */
async function deleteUser(id) {
    return await callAdminUsersFunction('delete_user', { userId: id });
}

// ================================================================
// 3. إعدادات النظام (باستخدام الجدول المباشر - الحل 1)
// ================================================================

// متغير عام لتخزين العملة الحالية
var currentCurrency = 'SAR';
var currentCurrencySymbol = 'ر.س';
var _systemSettings = null;

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
        darkMode: false,
        hideCurrencySymbol: false
    };
}

/**
 * الحصول على الإعدادات المحلية من localStorage
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
            var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?user_id=eq.' + user.id + '&select=*', {
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
                        darkMode: settings.dark_mode !== undefined ? settings.dark_mode : false,
                        hideCurrencySymbol: settings.hide_currency_symbol !== undefined ? settings.hide_currency_symbol : false
                    };
                    
                    // تحديث المتغيرات العامة
                    _systemSettings = result;
                    currentCurrency = result.currency;
                    currentCurrencySymbol = getCurrencySymbol(currentCurrency);
                    localStorage.setItem('systemSettings', JSON.stringify(result));
                    localStorage.setItem('systemCurrency', currentCurrency);
                    // مزامنة صامتة لمفتاح الثيم فقط (بدون لمس الـDOM) — يستخدمه سكريبت منع الوميض في التحميل القادم
                    localStorage.setItem('darkMode', result.darkMode ? 'true' : 'false');
                    
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
 * @param {Object} settings كائن الإعدادات
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
            dark_mode: settings.darkMode !== undefined ? settings.darkMode : false,
            hide_currency_symbol: settings.hideCurrencySymbol !== undefined ? settings.hideCurrencySymbol : false,
            updated_at: new Date().toISOString()
        };

        // Upsert حقيقي عبر PostgREST: POST واحد بـ on_conflict + Prefer: resolution=merge-duplicates
        // (الطريقة القديمة كانت بتجرب PUT بفلتر على user_id، لكن PostgREST مايقبلش PUT إلا بفلتر
        // على المفتاح الأساسي (id)، فكان بيرجع 405 دايمًا، وبعدين POST كان بيفشل بـ409 لو السجل موجود
        // بالفعل بسبب قيد unique على user_id)
        var headers = getHeaders(true);
        headers['Prefer'] = 'resolution=merge-duplicates,return=representation';

        var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?on_conflict=user_id', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(dbData)
        });

        if (!response.ok) {
            var errorText = await response.text();
            throw new Error('فشل حفظ الإعدادات: ' + errorText);
        }
        console.log('✅ تم حفظ الإعدادات (upsert)');

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
                var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?user_id=eq.' + user.id, {
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
            await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/user_settings?user_id=eq.' + user.id, {
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
                var response = await fetchWithRetry(SUPABASE_CONFIG.URL + '/rest/v1/' + table + '?user_id=eq.' + user.id, {
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
 */
async function addData(table, data) {
    try {
        var headers = getHeaders(true);
        // لازم نطلب Prefer: return=representation صراحةً، لأن Supabase (PostgREST)
        // افتراضيًا (من غير الطلب ده) بيرجّع رد فاضي بعد الإضافة، فمكناش قادرين
        // ناخد id الصف الجديد فورًا — وده كان بيكسر ربط القيود المحاسبية ببنودها
        // (journal_entry_lines.entry_id) وربط السندات بقيودها (vouchers.journal_entry_id)
        headers['Prefer'] = 'return=representation';

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

async function getTransactions(limit) {
    return await fetchData('transactions', {
        order: 'date',
        limit: limit || 200
    });
}

async function getBanks() {
    return await fetchData('banks');
}

async function getCars() {
    return await fetchData('cars');
}

async function getClients() {
    return await fetchData('clients');
}

async function getUsers() {
    return await fetchData('users');
}

async function getServices() {
    return await fetchData('services');
}

// ---- وحدات السياحة الدينية ----
async function getTrips() {
    return await fetchData('trips', { order: 'departure_date' });
}

async function getBookings(tripId) {
    var opts = {};
    if (tripId) opts.filter = { trip_id: tripId };
    return await fetchData('bookings', opts);
}

async function getHotels() {
    return await fetchData('hotels');
}

async function getRepresentatives() {
    return await fetchData('representatives');
}

async function getRepTransactions(repId) {
    var opts = {};
    if (repId) opts.filter = { rep_id: repId };
    return await fetchData('rep_transactions', opts);
}

async function getAgents() {
    return await fetchData('agents');
}

// ================================================================
// 6ب) المحرك المحاسبي — دليل الحسابات / القيود / السندات / القوائم المالية
// ================================================================

/** جلب كل الحسابات (دليل الحسابات) */
async function getAccounts() {
    return await fetchData('chart_of_accounts', { order: 'code' });
}

/** إضافة حساب جديد لدليل الحسابات */
async function addAccount(data) {
    var result = await addData('chart_of_accounts', data);
    return result[0] || result;
}

/**
 * يتأكد أن هناك حسابًا محاسبيًا مستقلاً (في دليل الحسابات) مرتبطًا بهذا
 * البنك/الصندوق تحديدًا (عبر linked_bank_id) — لو مش موجود، يُنشئه تلقائيًا
 * تحت المجموعة "1200 البنوك" بكود جديد. بدون ده، كل البنوك كانت بتتشارك
 * حسابًا محاسبيًا واحدًا عامًا، فمفيش طريقة نعرف السند ده بيخص أي بنك بالظبط.
 * تُستدعى تلقائيًا عند إضافة بنك جديد، وأيضًا آمنة الاستدعاء لبنك قديم بالفعل
 * له حساب (هترجعه من غير ما تكرره).
 */
async function ensureBankAccount(bank) {
    if (!bank || !bank.id) throw new Error('بيانات البنك غير صالحة');

    var accounts = await getAccounts();
    var existing = accounts.find(function(a) { return a.linked_bank_id === bank.id; });
    if (existing) return existing;

    var usedNumbers = accounts
        .map(function(a) { return a.code; })
        .filter(function(c) { return /^12\d{2}$/.test(c); })
        .map(function(c) { return parseInt(c.substring(2), 10); });
    var nextNum = (usedNumbers.length ? Math.max.apply(null, usedNumbers) : 0) + 1;
    var newCode = '12' + String(nextNum).padStart(2, '0');

    return await addAccount({
        code: newCode,
        name: bank.name,
        account_type: 'asset',
        parent_code: '1200',
        is_default: false,
        linked_bank_id: bank.id
    });
}

/**
 * لو الحساب المحاسبي ده مرتبط ببنك حقيقي (عبر linked_bank_id)، يحدّث banks.balance
 * بمقدار delta (موجب = زيادة الرصيد، سالب = نقصان). لو الحساب مش مرتبط ببنك
 * (زي حساب "الصندوق النقدي" العام أو أي حساب تاني)، الدالة متعملش حاجة بهدوء.
 */
async function adjustLinkedBankBalance(accountId, delta) {
    if (!accountId || !delta) return;
    try {
        var accounts = await getAccounts();
        var account = accounts.find(function(a) { return a.id === accountId; });
        if (!account || !account.linked_bank_id) return;

        var banks = await getBanks();
        var bank = banks.find(function(b) { return b.id === account.linked_bank_id; });
        if (!bank) return;

        var newBalance = parseFloat(bank.balance || 0) + parseFloat(delta);
        await updateData('banks', bank.id, { balance: newBalance });
    } catch (e) {
        // ما نوقفش العملية الأساسية (السند/المصروف) بسبب فشل تحديث رصيد البنك،
        // لكن نسجل التحذير عشان يبان في الـ console لو حصل خطأ
        console.warn('⚠️ فشل تحديث رصيد البنك المرتبط:', e);
    }
}

/**
 * يحسب رصيد الحساب المحاسبي المرتبط ببنك معيّن مباشرة من قيود اليومية
 * (journal_entry_lines) — مش من جدول transactions القديم. ده المصدر
 * الوحيد الموثوق فيه رصيد البنك الحقيقي، لأنه بياخد في الاعتبار كل حاجة
 * أثّرت على الحساب (سندات قبض/صرف، تحويلات صندوق↔بنك، رصيد افتتاحي)
 * بدل ما يعتمد بس على صفوف transactions فئة "بنك" اللي ممكن متعرفش
 * بأثر السندات أو الرصيد الافتتاحي أصلًا.
 */
async function getBankAccountBalance(bankId) {
    var accounts = await getAccounts();
    var account = accounts.find(function(a) { return a.linked_bank_id === bankId; });
    if (!account) return 0;

    var lines = await getJournalEntryLines();
    var totalDebit = 0, totalCredit = 0;
    lines.forEach(function(l) {
        if (l.account_id === account.id) {
            totalDebit += parseFloat(l.debit) || 0;
            totalCredit += parseFloat(l.credit) || 0;
        }
    });
    return totalDebit - totalCredit; // حساب أصل (Asset) — الرصيد = مدين - دائن
}

/** توليد رقم سند تلقائي متسلسل حسب نوع السند */
async function generateVoucherNo(voucherType) {
    try {
        var all = await fetchData('vouchers', { order: 'created_at', limit: 500 });
        var sameType = all.filter(function(v) { return v.voucher_type === voucherType; });
        var prefix = (voucherType === 'قبض') ? 'RV' : (voucherType === 'صرف') ? 'PV' : 'V';
        return prefix + '-' + String(sameType.length + 1).padStart(5, '0');
    } catch (e) {
        return 'V-' + Date.now();
    }
}

/**
 * إنشاء قيد يومية كامل (رأس + بنود مدين/دائن)
 * lines: [{ account_id, debit, credit, description }, ...]
 * شرط أساسي: مجموع المدين = مجموع الدائن (توازن القيد)
 */
async function addJournalEntry(entryHeader, lines) {
    var totalDebit = lines.reduce(function(s, l) { return s + (parseFloat(l.debit) || 0); }, 0);
    var totalCredit = lines.reduce(function(s, l) { return s + (parseFloat(l.credit) || 0); }, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('القيد غير متوازن: المدين (' + totalDebit + ') لا يساوي الدائن (' + totalCredit + ')');
    }

    var entryResult = await addData('journal_entries', entryHeader);
    var entry = entryResult[0] || entryResult;

    var linesWithEntry = lines.map(function(l) {
        return {
            entry_id: entry.id,
            account_id: l.account_id,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
            description: l.description || entryHeader.description || ''
        };
    });

    await addData('journal_entry_lines', linesWithEntry);
    return entry;
}

/** جلب قيود اليومية (اختياريًا بحدود تاريخ) */
async function getJournalEntries(dateFrom, dateTo) {
    var opts = { order: 'entry_date', limit: 1000 };
    var entries = await fetchData('journal_entries', opts);
    if (dateFrom) entries = entries.filter(function(e) { return e.entry_date >= dateFrom; });
    if (dateTo) entries = entries.filter(function(e) { return e.entry_date <= dateTo; });
    return entries;
}

/** جلب كل بنود القيود (تُستخدم لحساب ميزان المراجعة والقوائم المالية) */
async function getJournalEntryLines() {
    return await fetchData('journal_entry_lines', { limit: 5000 });
}

/** جلب كل السندات (اختياريًا بحدود تاريخ ونوع) */
async function getVouchers(options) {
    var vouchers = await fetchData('vouchers', { order: 'voucher_date', limit: 1000 });
    if (options) {
        if (options.dateFrom) vouchers = vouchers.filter(function(v) { return v.voucher_date >= options.dateFrom; });
        if (options.dateTo) vouchers = vouchers.filter(function(v) { return v.voucher_date <= options.dateTo; });
        if (options.type && options.type !== 'all') vouchers = vouchers.filter(function(v) { return v.voucher_type === options.type; });
    }
    return vouchers;
}

/**
 * إضافة سند (قبض أو صرف) — ينشئ تلقائيًا القيد المحاسبي المزدوج المرتبط به.
 * سند قبض: مدين = حساب الصندوق/البنك ، دائن = الحساب المقابل (عميل/إيراد/مندوب)
 * سند صرف: مدين = الحساب المقابل (مصروف/مورد/مندوب) ، دائن = حساب الصندوق/البنك
 */
async function addVoucher(v) {
    if (!v.voucher_no) {
        v.voucher_no = await generateVoucherNo(v.voucher_type);
    }

    var lines;
    if (v.voucher_type === 'قبض') {
        lines = [
            { account_id: v.cash_account_id, debit: v.amount, credit: 0 },
            { account_id: v.counter_account_id, debit: 0, credit: v.amount }
        ];
    } else {
        lines = [
            { account_id: v.counter_account_id, debit: v.amount, credit: 0 },
            { account_id: v.cash_account_id, debit: 0, credit: v.amount }
        ];
    }

    var entry = await addJournalEntry({
        entry_no: v.voucher_no,
        entry_date: v.voucher_date,
        description: 'سند ' + v.voucher_type + ' رقم ' + v.voucher_no + (v.description ? ' — ' + v.description : ''),
        source_type: 'voucher'
    }, lines);

    var voucherResult = await addData('vouchers', {
        voucher_no: v.voucher_no,
        voucher_type: v.voucher_type,
        voucher_date: v.voucher_date,
        cash_account_id: v.cash_account_id,
        counter_account_id: v.counter_account_id,
        party_type: v.party_type || null,
        party_id: v.party_id || null,
        party_name: v.party_name || null,
        amount: v.amount,
        description: v.description || null,
        journal_entry_id: entry.id
    });

    // سند قبض: الفلوس دخلت الصندوق/البنك (زيادة) — سند صرف: خرجت (نقصان)
    var balanceDelta = (v.voucher_type === 'قبض') ? parseFloat(v.amount) : -parseFloat(v.amount);
    await adjustLinkedBankBalance(v.cash_account_id, balanceDelta);

    return voucherResult[0] || voucherResult;
}

/** حذف سند + القيد المرتبط به (البنود تُحذف تلقائيًا عبر cascade) — وإرجاع رصيد البنك المرتبط لما كان عليه */
async function deleteVoucher(voucher) {
    if (voucher.journal_entry_id) {
        try { await deleteData('journal_entries', voucher.journal_entry_id); } catch (e) { console.warn(e); }
    }

    // نعكس بالظبط الأثر اللي حصل وقت الإضافة
    var balanceDelta = (voucher.voucher_type === 'قبض') ? -parseFloat(voucher.amount) : parseFloat(voucher.amount);
    await adjustLinkedBankBalance(voucher.cash_account_id, balanceDelta);

    return await deleteData('vouchers', voucher.id);
}

/**
 * حساب ميزان المراجعة: لكل حساب — إجمالي مدين، إجمالي دائن، الرصيد
 * (فلترة اختيارية بفترة زمنية عبر ربط entry_id بتاريخ journal_entries)
 */
async function getTrialBalance(dateFrom, dateTo) {
    var accounts = await getAccounts();
    var entries = await getJournalEntries(dateFrom, dateTo);
    var entryIds = {};
    entries.forEach(function(e) { entryIds[e.id] = true; });

    var lines = await getJournalEntryLines();
    if (dateFrom || dateTo) {
        lines = lines.filter(function(l) { return entryIds[l.entry_id]; });
    }

    var totals = {};
    lines.forEach(function(l) {
        if (!totals[l.account_id]) totals[l.account_id] = { debit: 0, credit: 0 };
        totals[l.account_id].debit += parseFloat(l.debit) || 0;
        totals[l.account_id].credit += parseFloat(l.credit) || 0;
    });

    return accounts.map(function(a) {
        var t = totals[a.id] || { debit: 0, credit: 0 };
        return {
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            debit: t.debit,
            credit: t.credit,
            balance: t.debit - t.credit
        };
    }).filter(function(row) { return row.debit !== 0 || row.credit !== 0; });
}

/** حساب قائمة الأرباح والخسائر لفترة معينة */
async function getIncomeStatement(dateFrom, dateTo) {
    var trialBalance = await getTrialBalance(dateFrom, dateTo);
    var revenues = trialBalance.filter(function(r) { return r.account_type === 'revenue'; })
        .map(function(r) { return { code: r.code, name: r.name, amount: r.credit - r.debit }; });
    var expenses = trialBalance.filter(function(r) { return r.account_type === 'expense'; })
        .map(function(r) { return { code: r.code, name: r.name, amount: r.debit - r.credit }; });

    var totalRevenue = revenues.reduce(function(s, r) { return s + r.amount; }, 0);
    var totalExpense = expenses.reduce(function(s, e) { return s + e.amount; }, 0);

    return {
        revenues: revenues,
        expenses: expenses,
        totalRevenue: totalRevenue,
        totalExpense: totalExpense,
        netProfit: totalRevenue - totalExpense
    };
}

/** حساب قائمة المركز المالي (الميزانية) كما في تاريخ معين */
async function getBalanceSheet(asOfDate) {
    var trialBalance = await getTrialBalance(null, asOfDate);
    var income = await getIncomeStatement(null, asOfDate);

    var assets = trialBalance.filter(function(r) { return r.account_type === 'asset'; })
        .map(function(r) { return { code: r.code, name: r.name, amount: r.debit - r.credit }; });
    var liabilities = trialBalance.filter(function(r) { return r.account_type === 'liability'; })
        .map(function(r) { return { code: r.code, name: r.name, amount: r.credit - r.debit }; });
    var equity = trialBalance.filter(function(r) { return r.account_type === 'equity'; })
        .map(function(r) { return { code: r.code, name: r.name, amount: r.credit - r.debit }; });

    equity.push({ code: '3900', name: 'صافي أرباح الفترة الحالية', amount: income.netProfit });

    var totalAssets = assets.reduce(function(s, a) { return s + a.amount; }, 0);
    var totalLiabilities = liabilities.reduce(function(s, l) { return s + l.amount; }, 0);
    var totalEquity = equity.reduce(function(s, e) { return s + e.amount; }, 0);

    return {
        assets: assets,
        liabilities: liabilities,
        equity: equity,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        totalEquity: totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.5
    };
}

// ================================================================
// 6ج) الخطوة 2 — الموردين + مصروفات الرحلة المُصنّفة + ربط الحجوزات بالمحاسبة
// ================================================================

/** جلب كل الموردين */
async function getSuppliers() {
    return await fetchData('suppliers');
}

/** إضافة مورد جديد */
async function addSupplier(data) {
    var result = await addData('suppliers', data);
    return result[0] || result;
}

/** تحديث بيانات مورد */
async function updateSupplier(id, data) {
    return await updateData('suppliers', id, data);
}

/** حذف مورد */
async function deleteSupplier(id) {
    return await deleteData('suppliers', id);
}

/** جلب كل مصروفات الرحلات (اختياريًا لرحلة معينة) */
async function getTripExpenses(tripId) {
    var opts = { order: 'expense_date' };
    if (tripId) opts.filter = { trip_id: tripId };
    return await fetchData('trip_expenses', opts);
}

/**
 * إضافة مصروف رحلة مُصنّف (انتقالات/فنادق/طيران/تأشيرات/باركود/أوفر باركود/باركود الغرفة)
 * ينشئ تلقائيًا قيد يومية مزدوج:
 *   - دفع نقدي فوري: مدين = حساب المصروف (حسب التصنيف)  ، دائن = الصندوق/البنك المختار
 *   - دفع آجل لمورد:  مدين = حساب المصروف (حسب التصنيف)  ، دائن = حساب الموردون (دائنون)
 * exp = { trip_id, category_account_id, amount, description, expense_date,
 *         payment_method: 'نقدي'|'آجل', cash_account_id (لو نقدي), supplier_id (لو آجل) }
 */
async function addTripExpense(exp) {
    var supplierAccounts = await getAccounts();
    var payableAccount = supplierAccounts.find(function(a) { return a.code === '2100'; }); // الموردون (دائنون)

    var lines;
    if (exp.payment_method === 'آجل') {
        if (!payableAccount) throw new Error('حساب الموردون (2100) غير موجود في دليل الحسابات');
        lines = [
            { account_id: exp.category_account_id, debit: exp.amount, credit: 0 },
            { account_id: payableAccount.id, debit: 0, credit: exp.amount }
        ];
    } else {
        if (!exp.cash_account_id) throw new Error('الرجاء اختيار حساب الصندوق/البنك للدفع النقدي');
        lines = [
            { account_id: exp.category_account_id, debit: exp.amount, credit: 0 },
            { account_id: exp.cash_account_id, debit: 0, credit: exp.amount }
        ];
    }

    var entry = await addJournalEntry({
        entry_date: exp.expense_date,
        description: 'مصروف رحلة — ' + (exp.description || ''),
        source_type: 'trip_expense'
    }, lines);

    var result = await addData('trip_expenses', {
        trip_id: exp.trip_id,
        category_account_id: exp.category_account_id,
        supplier_id: exp.supplier_id || null,
        payment_method: exp.payment_method || 'نقدي',
        cash_account_id: exp.payment_method === 'آجل' ? null : exp.cash_account_id,
        amount: exp.amount,
        description: exp.description || null,
        expense_date: exp.expense_date,
        journal_entry_id: entry.id
    });

    // مصروف رحلة مدفوع نقدي فورًا (مش آجل لمورد) بيقلل رصيد الصندوق/البنك المختار
    if (exp.payment_method !== 'آجل' && exp.cash_account_id) {
        await adjustLinkedBankBalance(exp.cash_account_id, -parseFloat(exp.amount));
    }

    return result[0] || result;
}

/** حذف مصروف رحلة + القيد المرتبط به — وإرجاع رصيد البنك المرتبط لو كان دفع نقدي */
async function deleteTripExpense(expense) {
    if (expense.journal_entry_id) {
        try { await deleteData('journal_entries', expense.journal_entry_id); } catch (e) { console.warn(e); }
    }

    if (expense.payment_method !== 'آجل' && expense.cash_account_id) {
        await adjustLinkedBankBalance(expense.cash_account_id, parseFloat(expense.amount));
    }

    return await deleteData('trip_expenses', expense.id);
}

/**
 * تسجيل دفعة حجز (من عميل) — تنشئ سند قبض تلقائيًا يترحّل للمحرك المحاسبي:
 *   مدين = الصندوق/البنك المختار  ،  دائن = إيرادات الرحلات (4100)
 * وتزيد paid_amount في الحجز نفسه بنفس القيمة.
 */
async function recordBookingPayment(booking, amount, cashAccountId, client, trip) {
    var accounts = await getAccounts();
    var revenueAccount = accounts.find(function(a) { return a.code === '4100'; }); // إيرادات الرحلات
    if (!revenueAccount) throw new Error('حساب إيرادات الرحلات (4100) غير موجود في دليل الحسابات');

    var voucher = await addVoucher({
        voucher_type: 'قبض',
        voucher_date: new Date().toISOString().split('T')[0],
        cash_account_id: cashAccountId,
        counter_account_id: revenueAccount.id,
        party_type: 'client',
        party_id: booking.client_id,
        party_name: client ? client.name : '',
        amount: amount,
        description: 'دفعة حجز ' + (booking.booking_code || '') + (trip ? (' — ' + (trip.trip_code || trip.trip_name || '')) : ''),
        trip_id: booking.trip_id,
        booking_id: booking.id
    });

    var newPaid = parseFloat(booking.paid_amount || 0) + parseFloat(amount);
    await updateData('bookings', booking.id, { paid_amount: newPaid });

    return voucher;
}

/** جلب سندات مورد معين (لكشف حساب المورد) */
async function getSupplierVouchers(supplierId) {
    var all = await getVouchers();
    return all.filter(function(v) { return v.party_type === 'supplier' && String(v.party_id) === String(supplierId); });
}

/**
 * تحويل نقدي من "الصندوق" (خزينة الشركة النقدية العامة، حساب 1100) إلى بنك
 * معيّن — ده كان بيتعمل قبل كده بتعديل banks.balance مباشرة من غير أي قيد
 * محاسبي، فكان بيخلي رصيد البنك ينفصل عن ميزان المراجعة بصمت. دلوقتي:
 *   1) بيعمل قيد يومية حقيقي متوازن: مدين = حساب البنك المرتبط، دائن = حساب
 *      الصندوق (1100) — فيبان في getTrialBalance() بشكل صحيح.
 *   2) بيحدّث banks.balance فعليًا عبر adjustLinkedBankBalance (بيتأكد إن
 *      البنك مرتبط بحساب محاسبي، وينشئه تلقائيًا لو مش موجود).
 * بيرجّع القيد المُنشأ عشان صفحة treasury.html تقدر تسجّله كمان في جدول
 * transactions القديم (عشان أرقام "رصيد الخزينة النقدية" المعروضة هناك
 * تفضل صحيحة، لحد ما نوحّد الصفحة دي بالكامل مع المحرك المحاسبي).
 */
async function transferCashToBank(bank, amount, description) {
    if (!bank || !bank.id) throw new Error('بيانات البنك غير صالحة');
    if (!amount || amount <= 0) throw new Error('المبلغ غير صالح');

    var accounts = await getAccounts();
    var cashAccount = accounts.find(function(a) { return a.code === '1100'; }); // الصندوق
    if (!cashAccount) throw new Error('حساب الصندوق (1100) غير موجود في دليل الحسابات');

    var bankAccount = await ensureBankAccount(bank);

    var entry = await addJournalEntry({
        entry_date: new Date().toISOString().split('T')[0],
        description: 'تحويل من الصندوق إلى ' + bank.name + (description ? ' — ' + description : ''),
        source_type: 'cash_transfer'
    }, [
        { account_id: bankAccount.id, debit: amount, credit: 0 },
        { account_id: cashAccount.id, debit: 0, credit: amount }
    ]);

    await adjustLinkedBankBalance(bankAccount.id, amount);

    // نرجّع id الحساب المحاسبي المرتبط بالبنك كمان (مش بس القيد) عشان
    // الصفحة اللي بتنادي الدالة دي تقدر تخزّنه وتستخدمه لاحقًا لو حبت
    // تعكس التحويل (حذف/تعديل) عن طريق reverseCashToBankTransfer
    entry.bank_account_id = bankAccount.id;
    return entry;
}

/**
 * يعكس تحويلاً نقديًا من الصندوق إلى بنك كان اتعمل عبر transferCashToBank —
 * بيحذف القيد المحاسبي المرتبط وبيرجّع رصيد البنك لما كان عليه قبل التحويل.
 * تُستخدم من treasury.html عند حذف/تعديل صف معاملة "تحويل إلى بنك".
 */
async function reverseCashToBankTransfer(journalEntryId, bankAccountId, amount) {
    if (journalEntryId) {
        try { await deleteData('journal_entries', journalEntryId); } catch (e) { console.warn(e); }
    }
    await adjustLinkedBankBalance(bankAccountId, -parseFloat(amount));
}

/**
 * عكس transferCashToBank: سحب نقدي من بنك معيّن ورجوعه للصندوق (1100) —
 * قيد يومية حقيقي متوازن: مدين = الصندوق (1100)، دائن = حساب البنك المرتبط.
 * تُستخدم لتنفيذ "سحب من البنك" في banks.html بدل تعديل banks.balance مباشرة.
 */
async function transferBankToCash(bank, amount, description) {
    if (!bank || !bank.id) throw new Error('بيانات البنك غير صالحة');
    if (!amount || amount <= 0) throw new Error('المبلغ غير صالح');

    var accounts = await getAccounts();
    var cashAccount = accounts.find(function(a) { return a.code === '1100'; }); // الصندوق
    if (!cashAccount) throw new Error('حساب الصندوق (1100) غير موجود في دليل الحسابات');

    var bankAccount = await ensureBankAccount(bank);

    var entry = await addJournalEntry({
        entry_date: new Date().toISOString().split('T')[0],
        description: 'سحب من ' + bank.name + ' إلى الصندوق' + (description ? ' — ' + description : ''),
        source_type: 'cash_transfer'
    }, [
        { account_id: cashAccount.id, debit: amount, credit: 0 },
        { account_id: bankAccount.id, debit: 0, credit: amount }
    ]);

    await adjustLinkedBankBalance(bankAccount.id, -amount);

    entry.bank_account_id = bankAccount.id;
    return entry;
}

/**
 * يعكس سحبًا نقديًا كان اتعمل عبر transferBankToCash — بيحذف القيد
 * ويرجّع رصيد البنك لما كان عليه قبل السحب (عكس اتجاه reverseCashToBankTransfer
 * بالظبط، لأن الأثر الأصلي كان إنقاص رصيد البنك مش زيادته).
 */
async function reverseBankToCashTransfer(journalEntryId, bankAccountId, amount) {
    if (journalEntryId) {
        try { await deleteData('journal_entries', journalEntryId); } catch (e) { console.warn(e); }
    }
    await adjustLinkedBankBalance(bankAccountId, parseFloat(amount));
}

/**
 * حساب ملخص أرباح الرحلة المُصنّف: إيراد الحجوزات (المحصّل) مقابل كل بند تكلفة على حدة
 * (الانتقالات / الفنادق / الطيران / تأشيرات الوكيل / الباركود / أوفر باركود / باركود الغرفة)
 */
async function getTripFinancials(tripId) {
    var results = await Promise.all([
        getBookings(tripId),
        getTripExpenses(tripId),
        getAccounts(),
        getRepresentatives()
    ]);
    var bookings = results[0] || [];
    var expenses = results[1] || [];
    var accounts = results[2] || [];
    var representatives = results[3] || [];

    var totalBookingValue = bookings.reduce(function(s, b) { return s + (parseFloat(b.booking_value) || 0); }, 0);
    var totalCollected = bookings.reduce(function(s, b) { return s + (parseFloat(b.paid_amount) || 0); }, 0);

    var byCategory = {};
    expenses.forEach(function(e) {
        var acc = accounts.find(function(a) { return a.id === e.category_account_id; });
        var key = acc ? acc.name : 'غير مصنّف';
        byCategory[key] = (byCategory[key] || 0) + (parseFloat(e.amount) || 0);
    });

    var totalExpense = expenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);

    // عمولة المناديب: بند مصروف حقيقي كان ناقصًا من حساب الربح — كل حجز له مندوب
    // (booking.rep_id) بياخد عمولة % من قيمة الحجز (booking_value) حسب commission_rate
    // المسجلة في بطاقة المندوب. بنجمعها لكل مندوب على حدة عشان تبان في كشف الرحلة.
    var byRepresentative = {};
    var totalCommission = 0;
    bookings.forEach(function(b) {
        if (!b.rep_id) return;
        var rep = representatives.find(function(r) { return r.id === b.rep_id; });
        if (!rep) return;
        var rate = parseFloat(rep.commission_rate) || 0;
        if (!rate) return;
        var commission = (parseFloat(b.booking_value) || 0) * rate / 100;
        if (!commission) return;
        var key = rep.rep_name || 'مندوب';
        byRepresentative[key] = (byRepresentative[key] || 0) + commission;
        totalCommission += commission;
    });

    var netProfit = totalCollected - totalExpense - totalCommission;
    var profitMargin = totalCollected ? (netProfit / totalCollected) * 100 : 0;

    return {
        bookings: bookings,
        expenses: expenses,
        totalBookingValue: totalBookingValue,
        totalCollected: totalCollected,
        totalExpense: totalExpense,
        totalCommission: totalCommission,
        byRepresentative: byRepresentative,
        netProfit: netProfit,
        profitMargin: profitMargin,
        byCategory: byCategory
    };
}

// ================================================================
// 7. دوال خاصة بالشعار
// ================================================================

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

function getSystemName() {
    var settings = _systemSettings || getLocalSettings();
    return settings.systemName || 'حراء للسياحة';
}

function getSystemSettings() {
    return _systemSettings || getLocalSettings();
}

function getCurrency() {
    return currentCurrency || 'SAR';
}

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

function formatCurrency(amount, currencyCode) {
    if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
    
    var code = currencyCode || currentCurrency || 'SAR';
    var settings = _systemSettings || getLocalSettings();
    var numberFormat = settings.numberFormat || 'ar';
    
    var formatted = amount.toLocaleString(numberFormat === 'ar' ? 'ar-SA' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    // خيار "لا تظهر رمز العملة" من الإعدادات — لو مفعّل، يرجع الرقم بدون
    // أي رمز/كود عملة جنبه.
    if (settings.hideCurrencySymbol) {
        return formatted;
    }

    var symbol = getCurrencySymbol(code);
    return formatted + ' ' + symbol;
}

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
 */
function applyTheme(forceDark) {
    try {
        var settings = _systemSettings || getLocalSettings();
        var isDarkMode = false;
        
        if (forceDark !== undefined) {
            isDarkMode = forceDark;
        } else {
            isDarkMode = settings.darkMode !== undefined ? settings.darkMode : false;
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
    try {
        var flat = localStorage.getItem('darkMode');
        if (flat !== null) return flat === 'true';
    } catch (e) {}
    var settings = _systemSettings || getLocalSettings();
    return settings.darkMode !== undefined ? settings.darkMode : false;
}

// ================================================================
// 10. الدوال الرئيسية عند تحميل أي صفحة
// ================================================================

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
                console.warn('⚠️ فشل تحديث التوكن، سيتم تسجيل الخروج تلقائيًا');
                logoutUser();
            }
        });
    }
    
    return true;
}

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

(async function initCurrency() {
    try {
        var settings = await getUserSettings();
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
    updateUserProfile: updateUserProfile,
    changePassword: changePassword,
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    
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

    // المحرك المحاسبي (دليل حسابات / قيود / سندات / قوائم مالية)
    getAccounts: getAccounts,
    addAccount: addAccount,
    ensureBankAccount: ensureBankAccount,
    adjustLinkedBankBalance: adjustLinkedBankBalance,
    getBankAccountBalance: getBankAccountBalance,
    generateVoucherNo: generateVoucherNo,
    addJournalEntry: addJournalEntry,
    getJournalEntries: getJournalEntries,
    getJournalEntryLines: getJournalEntryLines,
    getVouchers: getVouchers,
    addVoucher: addVoucher,
    deleteVoucher: deleteVoucher,
    getTrialBalance: getTrialBalance,
    getIncomeStatement: getIncomeStatement,
    getBalanceSheet: getBalanceSheet,

    // الخطوة 2 — الموردين / مصروفات الرحلة المُصنّفة / ربط الحجوزات بالمحاسبة
    getSuppliers: getSuppliers,
    addSupplier: addSupplier,
    updateSupplier: updateSupplier,
    deleteSupplier: deleteSupplier,
    getTripExpenses: getTripExpenses,
    addTripExpense: addTripExpense,
    deleteTripExpense: deleteTripExpense,
    recordBookingPayment: recordBookingPayment,
    getSupplierVouchers: getSupplierVouchers,
    getTripFinancials: getTripFinancials,
    transferCashToBank: transferCashToBank,
    reverseCashToBankTransfer: reverseCashToBankTransfer,
    transferBankToCash: transferBankToCash,
    reverseBankToCashTransfer: reverseBankToCashTransfer,

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

console.log('📦 تم تحميل Supabase.js - نظام التوكن المتكامل');
console.log('📡 URL:', SUPABASE_CONFIG.URL);
console.log('🔑 التوكن:', getToken() ? 'موجود ✅' : 'غير موجود ❌');
console.log('💰 العملات المتاحة: SAR, AED, EGP, USD, EUR');
console.log('⚙️ الإعدادات محفوظة في جدول user_settings (بدون RPC)');
console.log('💰 العملة الحالية:', currentCurrency, currentCurrencySymbol);
console.log('🎨 الوضع المظلم:', isDarkModeEnabled() ? 'مفعل ✅' : 'غير مفعل ❌');

// ================================================================
// 13. حارس الدخول التلقائي (Auth Guard)
// يشتغل فور تحميل هذا الملف في أي صفحة، قبل تحميل أي بيانات من
// الصفحة نفسها. أي صفحة غير login.html/register.html بدون جلسة
// صالحة يتم تحويلها فورًا لصفحة تسجيل الدخول.
// ================================================================
(function requireAuthGuard() {
    var path = window.location.pathname.toLowerCase();
    var isPublicPage = /\/(login|register)(\.html)?\/?(\?.*)?$/.test(path) ||
                        /^(login|register)(\.html)?$/.test(path.replace(/^\//, ''));

    if (isPublicPage) return;

    if (!isLoggedIn()) {
        console.warn('⚠️ لا توجد جلسة نشطة، جاري التحويل لصفحة تسجيل الدخول');
        window.location.href = 'login.html';
    }
})();
