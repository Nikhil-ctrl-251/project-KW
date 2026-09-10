import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Home, Truck } from 'lucide-react';

export function RoleSelection() {
  const { setRole } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSelectRole = async (role: 'household' | 'kabadiwala') => {
    try {
      setLoading(true);
      await setRole(role);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">How will you use the app?</h2>
        
        <div className="space-y-4">
          <button
            onClick={() => handleSelectRole('household')}
            disabled={loading}
            className="w-full flex items-center p-6 border-2 border-gray-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4 group-hover:bg-green-200 transition-colors">
              <Home className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Household</h3>
              <p className="text-sm text-gray-500">I want to sell scrap</p>
            </div>
          </button>

          <button
            onClick={() => handleSelectRole('kabadiwala')}
            disabled={loading}
            className="w-full flex items-center p-6 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Kabadiwala</h3>
              <p className="text-sm text-gray-500">I collect scrap</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
