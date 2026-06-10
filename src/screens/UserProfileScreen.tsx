import React, { useState, useRef, useCallback } from 'react';
import { LucideImagePlus } from 'lucide-react';
import { useApp } from '../context/AppContext';

const UserProfileScreen: React.FC = () => {
  const { userProfile, setUserProfile, setUserReferenceImage, addToast } = useApp();
  const [name, setName] = useState(userProfile.name);
  const [info, setInfo] = useState(userProfile.info);
  const [preferences, setPreferences] = useState(userProfile.preferences);
  const [appearance, setAppearance] = useState(userProfile.appearance);
  const [locationOverride, setLocationOverride] = useState(userProfile.locationOverride || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(userProfile.referenceImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload an image file.');
    }
  }, []);

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setUserReferenceImage(null);
  };

  const handleSave = async () => {
    addToast({ title: "User Profile", message: "Saving your profile changes...", type: "info" });
    await new Promise(resolve => setTimeout(resolve, 600));
    setUserProfile({
      ...userProfile,
      name,
      info,
      preferences,
      appearance,
      locationOverride,
    });

    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setUserReferenceImage(base64);
        addToast({ title: 'Profile Saved', message: 'User profile and reference image updated successfully!', type: 'success' });
      };
      reader.readAsDataURL(imageFile);
    } else if (userProfile.referenceImage && !imagePreviewUrl) {
      // Image was removed
      setUserReferenceImage(null);
      addToast({ title: 'Profile Saved', message: 'User profile updated and image removed successfully!', type: 'success' });
    } else {
      addToast({ title: 'Profile Saved', message: 'User profile updated successfully!', type: 'success' });
    }
  };

  return (
    <div className="p-6 bg-transparent transition-colors duration-500 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-indigo-600">User Profile</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">General Information & Background</label>
          <textarea
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Tell the AI about yourself..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preferences</label>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Communication style, likes, dislikes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appearance</label>
          <textarea
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="How do you look? (Used for image generation context)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location Override (Optional)</label>
          <input
            type="text"
            value={locationOverride}
            onChange={(e) => setLocationOverride(e.target.value)}
            placeholder="e.g. Detroit, MI (Overrides auto-detected location for weather and contextual awareness)"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Reference Image for AI</label>
          <div
            className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-indigo-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageUpload(e.dataTransfer.files[0]);
              }
            }}
          >
            {imagePreviewUrl ? (
              <div className="relative w-full h-48 group">
                <img src={imagePreviewUrl} alt="User Reference" className="h-full w-full object-contain rounded-md" referrerPolicy="no-referrer" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="space-y-1 text-center">
                <LucideImagePlus className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <p className="relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500">
                    Upload a file
                  </p>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
            <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors font-medium shadow-sm"
        >
          Save Profile
        </button>
      </div>
    </div>
  );
};

export default UserProfileScreen;
