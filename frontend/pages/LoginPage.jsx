import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { authService } from '../services/authService';

const LoginPage = ({ setUser }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);


  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { credential } = credentialResponse;
      const response = await authService.loginWithGoogle(credential);

      if (response.code === 1000) {
        setUser(response.data.user);
        navigate('/');
      }
    } catch (error) {
      console.error("Google Login Error", error);
    }
  };
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const loginRes = await authService.login(email, password);

      if (loginRes.code === 1000) {
        setUser(loginRes.data.user);
        navigate('/');
      } else {
        setError(loginRes.message || "Đăng nhập thất bại.");
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Email hoặc mật khẩu không chính xác.");
      } else {
        setError("Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại mạng.");
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
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
        <div className="text-center mb-10">
          <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl">videocam</span>
          </div>
          <h2 className="text-3xl font-black mb-2">Welcome back</h2>
          <p className="text-gray-400">Join your team in a few simple steps.</p>
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-400 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-surface border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              placeholder="name@company.com"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-bold text-gray-400">Password</label>
              <button type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm font-bold text-primary hover:underline">Forgot?</button>
            </div>
            <input
              type="password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-surface border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-primary hover:bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {isLoading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Sign In'}
          </button>
        </form>

        <div className="relative my-10 flex items-center">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink-0 mx-4 text-xs font-bold text-gray-600 uppercase tracking-widest">Or continue with</span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>
        <div className="w-full flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError("Đăng nhập Google thất bại");
            }}
            theme="outline"
            size="large"
            text="continue_with"
            width="900"
            shape="pill"
          />
        </div>

        <p className="mt-10 text-center text-gray-400 text-sm">
          Don't have an account? <button onClick={() => navigate('/signup')} className="font-bold text-primary hover:underline">Sign up for free</button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
