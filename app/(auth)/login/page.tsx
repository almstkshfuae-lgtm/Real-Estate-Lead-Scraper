"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, ShieldCheck, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t, i18n } = useTranslation('common');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Login response was not valid JSON:', text);
        data = {
          error: 'Unexpected server response',
          details: text,
        };
      }

      if (res.ok) {
        router.push("/leads");
      } else {
        setError(data.details ? `${data.error}: ${data.details}` : (data.error || "Login failed"));
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(nextLang);
  };

  const isRtl = i18n.language === "ar";

  return (
    <div 
      className={`min-h-screen flex flex-col md:flex-row bg-[var(--color-bg-base)] transition-all duration-300 ${isRtl ? 'font-cairo' : 'font-inter'}`}
    >
      {/* Brand Section */}
      <div className="hidden md:flex md:w-1/2 bg-[var(--color-primary)] p-12 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        </div>
        
        <div className="z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-[var(--color-primary)] w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Brilliance</h1>
        </div>

        <div className="z-10">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
            {isRtl ? "اعثر على المشتري المناسب بشكل أسرع." : "Find the right buyer, faster."}
          </h2>
          <p className="text-xl text-blue-100 max-w-md">
            {t('auth.loginDesc', 'AI-powered real estate lead intelligence platform for UAE agents.')}
          </p>
        </div>

        <div className="z-10 text-sm text-blue-200">
          © 2026 Brilliance. All rights reserved.
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-[var(--color-bg-card)]">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center gap-3 mb-12">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Brilliance</h1>
          </div>

          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">{t('auth.welcome')}</h2>
              <p className="text-[var(--color-text-secondary)]">{t('auth.desc')}</p>
            </div>
            <button 
              onClick={toggleLanguage}
              className="p-3 rounded-2xl bg-[var(--color-bg-surface)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] transition-all flex items-center gap-2 border border-[var(--color-border)] font-bold text-sm"
            >
              <Globe className="w-4 h-4" />
              {i18n.language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-[var(--color-danger)] p-4 mb-6 rounded-md">
              <p className="text-[var(--color-danger)] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all outline-none"
                placeholder="name@company.ae"
                required
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  {t('auth.password')}
                </label>
                <a href="#" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                  {t('auth.forgot', 'Forgot password?')}
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('auth.signIn')}
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center">
            <p className="text-[var(--color-text-secondary)] text-sm">
              {t('auth.noAccount', "Don't have an account?")} <a href="#" className="text-[var(--color-primary)] font-bold hover:underline">{t('auth.contactAdmin', 'Contact Administrator')}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
