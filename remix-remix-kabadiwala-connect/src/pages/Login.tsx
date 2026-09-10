import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Recycle } from 'lucide-react';

export function Login() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Recycle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Kabadiwala Connect</h1>
        <p className="text-gray-500 mb-8">Smart waste management & pickup</p>
        
        <button
          onClick={loginWithGoogle}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition-colors shadow-sm"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
