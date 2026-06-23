import React, { useState } from 'react';
import { authService } from '../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const response = await authService.forgotPassword(email);
        if (response.code === 1000) {
          setSubmitted(true);
        }
    } catch (error) {
        console.log(error);
        setLoading(false);
        setSubmitted(false);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        {!submitted ? (
          <>
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Quên mật khẩu?
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Đừng lo, nhập email của bạn vào đây và chúng tôi sẽ gửi hướng dẫn khôi phục.
              </p>
            </div>
            
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email-address" className="sr-only">Email address</label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Địa chỉ Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                    loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors`}
                >
                  {loading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Kiểm tra Email</h2>
            <p className="mt-2 text-sm text-gray-600">
              Chúng tôi đã gửi hướng dẫn đổi mật khẩu tới <strong>{email}</strong>.
            </p>
            <button 
              onClick={() => setSubmitted(false)}
              className="mt-6 text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Thử lại với email khác
            </button>
          </div>
        )}

        <div className="text-center mt-4">
          <a href="/login" className="text-sm font-medium text-gray-600 hover:text-indigo-500">
            ← Quay lại đăng nhập
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
