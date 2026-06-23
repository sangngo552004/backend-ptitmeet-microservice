import { useState, useRef } from 'react';
import { Camera, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';

const UserProfile = () => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await userService.uploadAvatar(file);
      if (response.code === 1000) {
        setSuccessMessage('Cập nhật ảnh đại diện thành công!');
        setFormData(prev => ({ ...prev, avatarUrl: response.data.avatarUrl }));
        setUser(response.data);
      } else {
        setErrorMessage(response.message || 'Tải ảnh lên thất bại');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setErrorMessage(error.response?.data?.message || 'Có lỗi xảy ra khi tải ảnh lên');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload = {
        fullName: formData.fullName,
        avatarUrl: formData.avatarUrl
      };

      const response = await userService.updateProfile(payload);

      if (response.code === 1000) {
        setSuccessMessage('Cập nhật thông tin thành công!');
        setUser(response.data);
      } else {
        setErrorMessage(response.message || 'Cập nhật thất bại');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* --- Avatar Section --- */}
      <div className="flex items-center gap-6 mb-8">
        <div className="relative shrink-0">
          <img
            src={formData.avatarUrl || 'https://picsum.photos/100'}
            alt="Avatar"
            className="w-24 h-24 rounded-full border-4 border-surface-dark shadow-xl object-cover bg-slate-700"
          />
          <button
            type="button"
            onClick={triggerFileInput}
            className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full hover:bg-blue-600 transition shadow-lg ring-4 ring-surface-dark"
          >
            <Camera size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{formData.fullName || 'User'}</h2>
          <p className="text-sm text-gray-400">{formData.email}</p>
        </div>
      </div>

      {/* --- Form Section --- */}
      <div className="mt-8 space-y-6">

        {/* Public Profile Group */}
        <div className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
              <div className="relative group focus-within:text-primary">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full h-10 pl-10 pr-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group focus-within:text-primary">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full h-10 pl-10 pr-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
