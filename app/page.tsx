import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { numberToArabicWords } from '@/lib/utils';

// ==========================================================
// هذا السطر يمنع حدوث خطأ "Prerender Error" في Vercel
// ويجعل الصفحة تعمل كـ Dynamic Server Component
// ==========================================================
export const dynamic = 'force-dynamic';

// أيقونات SVG مدمجة لتصميم احترافي بدون مكتبات خارجية
const Icons = {
  Wallet: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12h.01"/></svg>
  ),
  Clock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  CheckCircle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  TrendingUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  )
};

export default async function Home() {
  // 1. جلب البيانات من قاعدة البيانات
  let loans = [];
  let stats = { total: 0, active: 0, settled: 0, totalAmount: 0 };

  try {
    loans = await prisma.loan.findMany({ 
      orderBy: { createdAt: 'desc' },
      take: 5 
    });

    stats = {
      total: loans.length,
      active: loans.filter(l => !l.isSettled).length,
      settled: loans.filter(l => l.isSettled).length,
      totalAmount: loans.reduce((sum, l) => sum + l.amount, 0),
    };
  } catch (error) {
    console.error("Database Connection Error:", error);
    // في حال فشل الاتصال، ستبقى المصفوفات فارغة ولن يتعطل الموقع
  }

  const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800">
      
      {/* --- الهيدر العلوي --- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">نظام السلف النقدية</h1>
            <p className="text-sm text-slate-500 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/loans/new" 
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              <Icons.Plus /> طلب سلفة جديدة
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- بطاقات الإحصائيات (Stats Grid) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* بطاقة إجمالي السلف */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-start justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">إجمالي السلف</p>
              <h3 className="text-3xl font-bold text-slate-800">{stats.total}</h3>
              <p className="text-xs text-slate-400 mt-2">سلفة مسجلة</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Icons.Wallet />
            </div>
          </div>

          {/* بطاقة السلف الفعالة */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-start justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">سلف فعالة</p>
              <h3 className="text-3xl font-bold text-warning">{stats.active}</h3>
              <p className="text-xs text-slate-400 mt-2">بانتظار التسوية</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <Icons.Clock />
            </div>
          </div>

          {/* بطاقة المسواة */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-start justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">تمت تسويتها</p>
              <h3 className="text-3xl font-bold text-success">{stats.settled}</h3>
              <p className="text-xs text-slate-400 mt-2">مبرأة الذمة</p>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <Icons.CheckCircle />
            </div>
          </div>

          {/* بطاقة إجمالي المبالغ */}
          <div className="bg-gradient-to-br from-primary to-teal-700 rounded-2xl p-6 shadow-lg shadow-primary/20 text-white flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80 mb-1">إجمالي المبالغ</p>
              <h3 className="text-2xl font-bold">{stats.totalAmount.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3>
              <p className="text-xs text-white/60 mt-2">{numberToArabicWords(stats.totalAmount)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Icons.TrendingUp />
            </div>
          </div>
        </div>

        {/* --- قسم الإجراءات السريعة والسجل --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* عمود اليسار: سجل آخر السلف */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-lg text-slate-700">آخر السلف المسجلة</h2>
              <Link href="/loans" className="text-sm text-primary hover:underline">عرض الكل</Link>
            </div>
            
            {loans.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Icons.FileText />
                </div>
                <p className="text-slate-500 font-medium">لا توجد سلف مسجلة حالياً</p>
                <p className="text-slate-400 text-sm mt-1">ابدأ بإنشاء طلب سلفة جديد</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <Link 
                    key={loan.id} 
                    href={`/loans/${loan.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${loan.isSettled ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                        {loan.isSettled ? '✓' : loan.refNumber.split('/')[2]?.substring(0,1)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-700 group-hover:text-primary">{loan.employee}</p>
                        <p className="text-xs text-slate-400">{loan.activity}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">{loan.amount.toLocaleString()} ر.س</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${loan.isSettled ? 'bg-success/10 text-success' : 'bg-orange-100 text-orange-700'}`}>
                        {loan.isSettled ? 'مسواة' : 'فعالة'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* عمود اليمين: إجراءات سريعة */}
          <div className="space-y-6">
            
            {/* بطاقة التسوية */}
            <div className="bg-gradient-to-br from-secondary/10 to-orange-50 border border-secondary/20 rounded-2xl p-6">
              <h3 className="font-bold text-secondary mb-2">تسوية سلفة</h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                هل لديك سلفة فعالة تريد تسويتها؟ اضغط أدناه للبحث والبدء.
              </p>
              <Link 
                href="/loans" 
                className="block w-full text-center bg-secondary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-secondary/90 transition-colors shadow-sm"
              >
                البحث عن سلفة
              </Link>
            </div>

            {/* بطاقة التنبيهات */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-700 mb-4">تنبيهات هامة</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-xl">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">تذكير نظامي</p>
                    <p className="text-xs text-blue-700">يجب تسوية السلف خلال 15 يوم عمل من تاريخ انتهاء النشاط.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-green-50 p-3 rounded-xl">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-green-900">تحديثات</p>
                    <p className="text-xs text-green-700">تم إضافة دعم العملات الأجنبية في نموذج التسوية.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}