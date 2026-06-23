import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
const ResetPassword = () => {
    const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const navigate = useNavigate();
    const [searchParam] = useSearchParams();
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert("Mật khẩu không khớp!");
            return;
        }

        const token = searchParam.get('token');
        setStatus('loading');
        try {
            const response = await authService.resetPassword(token, formData.password);
            console.log(response);
            if (response.code === 1000) {
                setStatus('success');
            }
        } catch (error) {
            console.log(error);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-xl">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Thành công!</h2>
                    <p className="text-gray-600 mt-2">Mật khẩu của bạn đã được cập nhật. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
                        Đăng nhập ngay
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
                <h2 className="text-2xl font-bold text-gray-900 text-center">Thiết lập mật khẩu mới</h2>
                <p className="text-gray-500 text-center mt-2 text-sm">Vui lòng nhập mật khẩu mới và xác nhận lại.</p>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    {/* Mật khẩu mới */}
                    <div>
                        <label className="block text-sm font-medium text-black">Mật khẩu mới</label>
                        <div className="relative mt-1">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                placeholder="••••••••"
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? "Ẩn" : "Hiện"}
                            </button>
                        </div>
                    </div>

                    {/* Xác nhận mật khẩu */}
                    <div>
                        <label className="block text-sm font-medium text-black">Xác nhận mật khẩu</label>
                        <input
                            name="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            required
                            className={`w-full text-black mt-1 px-4 py-3 border rounded-lg outline-none transition ${formData.confirmPassword && formData.password !== formData.confirmPassword
                                ? 'border-red-500 focus:ring-red-200'
                                : 'border-gray-300 focus:ring-indigo-500'
                                }`}
                            placeholder="••••••••"
                            onChange={handleChange}
                        />
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                            <p className="text-red-500 text-xs mt-1">Mật khẩu xác nhận không khớp.</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className={`w-full py-3 rounded-lg font-semibold text-white transition ${status === 'loading' ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
                            }`}
                    >
                        {status === 'loading' ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
