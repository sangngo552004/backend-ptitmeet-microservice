
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authService } from '../services/authService';

const SignUpPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const handleSignUp = async () => {
    setErrors({});
    setServerError('');
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Mật khẩu không khớp' });
      return;
    }
    try {
      const response = await authService.register(formData);
      if (response.code === 1000) {
        navigate('/login');
      }
    } catch (error) {
      console.error(error);
      if (error.response && error.response.data) {
        const { code, message, data } = error.response.data;

        if (error.response.status === 400 && data) {
          setServerError(message);
          setErrors(data);
        } else {
          setServerError(message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
      } else {
        setServerError("Không thể kết nối đến server.");
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { credential } = credentialResponse;
      const response = await authService.loginWithGoogle(credential);
      console.log(response);
      if (response.code === 1000) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Google Login Error", error);
      setServerError("Đăng nhập Google thất bại. Vui lòng thử lại.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full relative">
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to home
          </button>
        </div>
        <div className="text-center mb-8">
          <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl">person_add</span>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">Create your account</h2>
          <p className="text-gray-400">Create an account to host meetings and keep ownership of your meeting data.</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSignUp(); }}>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-500 ml-1 uppercase tracking-wider text-[10px]">Full Name</label>
            <div className="relative group">
              <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.fullName ? 'text-red-500' : 'text-gray-500 group-focus-within:text-primary'}`}>badge</span>
              <input
                type="text"
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                value={formData.fullName}
                className={`w-full h-14 pl-12 pr-4 rounded-xl bg-surface border focus:ring-2 focus:outline-none transition-all placeholder:text-gray-600 ${errors.fullName
                  ? 'border-red-500/50 focus:ring-red-500'
                  : 'border-white/10 focus:ring-primary'
                  }`}
                placeholder="Alex Morgan"
              />
            </div>
            {errors.fullName && <p className="text-red-500 text-xs ml-1 mt-1">{errors.fullName}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-500 ml-1 uppercase tracking-wider text-[10px]">Email Address</label>
            <div className="relative group">
              <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.email ? 'text-red-500' : 'text-gray-500 group-focus-within:text-primary'}`}>mail</span>
              <input
                type="email"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                value={formData.email}
                className={`w-full h-14 pl-12 pr-4 rounded-xl bg-surface border focus:ring-2 focus:outline-none transition-all placeholder:text-gray-600 ${errors.email
                  ? 'border-red-500/50 focus:ring-red-500'
                  : 'border-white/10 focus:ring-primary'
                  }`}
                placeholder="name@company.com"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs ml-1 mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider text-[10px]">Password</label>
              <input
                type="password"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                value={formData.password}
                className={`w-full h-14 px-4 rounded-xl bg-surface border focus:ring-2 focus:outline-none transition-all placeholder:text-gray-600 ${errors.password
                  ? 'border-red-500/50 focus:ring-red-500'
                  : 'border-white/10 focus:ring-primary'
                  }`}
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-xs ml-1 mt-1">{errors.password}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-wider text-[10px]">Confirm</label>
              <input
                type="password"
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                value={formData.confirmPassword}
                className={`w-full h-14 px-4 rounded-xl bg-surface border focus:ring-2 focus:outline-none transition-all placeholder:text-gray-600 ${errors.confirmPassword
                  ? 'border-red-500/50 focus:ring-red-500'
                  : 'border-white/10 focus:ring-primary'
                  }`}
                placeholder="••••••••"
              />

              {errors.confirmPassword && <p className="text-red-500 text-xs ml-1 mt-1">{errors.confirmPassword}</p>}
            </div>
            {serverError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium text-center">
                {serverError}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-1 py-2">
            <input type="checkbox" id="terms" className="size-4 rounded border-white/10 bg-surface text-primary focus:ring-primary" required />
            <label htmlFor="terms" className="text-xs text-gray-400">I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a></label>
          </div>

          <button
            type="submit"
            className="w-full h-14 bg-primary hover:bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2"
          >
            Create Account
          </button>
        </form>

        {/* <div className="relative my-8 flex items-center">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Or sign up with</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div> */}



        <p className="mt-8 text-center text-gray-400 text-sm">
          Already have an account? <button onClick={() => navigate('/login')} className="font-bold text-primary hover:underline">Sign In</button>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
