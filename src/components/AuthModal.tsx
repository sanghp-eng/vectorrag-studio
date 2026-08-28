import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, Sparkles, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, loginDemo, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    try {
      await loginDemo();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate demo account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-[#141414] p-5 sm:p-6 shadow-2xl text-[#141414] font-mono">
        <button
          id="auth-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#666] hover:text-[#141414] p-1 hover:bg-[#E4E3E0] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-4 pb-3 border-b border-[#141414]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-[#141414] text-white flex items-center justify-center text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#141414]">
              {isRegister ? 'REGISTER_VECTOR_TENANT' : 'SYSTEM_AUTHENTICATION'}
            </h3>
          </div>
          <p className="text-[11px] font-mono text-[#666]">
            Multi-tenant JWT session isolation and cryptographic vector scoping
          </p>
        </div>

        {/* Quick 1-Click Demo Login */}
        <div className="mb-4 p-3 bg-[#F8F7F4] border border-[#141414]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#141414] flex items-center gap-1.5 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              1_CLICK_DEMO_ACCESS
            </span>
            <span className="text-[9px] px-1.5 py-0.2 bg-[#141414] text-white font-bold">
              PRELOADED_KB
            </span>
          </div>
          <p className="text-[10px] text-[#666] mb-2 leading-relaxed">
            Instant authentication with seeded documents, vector indexes, and sample queries.
          </p>
          <button
            id="demo-login-btn"
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-2 px-3 bg-[#141414] hover:bg-[#333] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>AUTHENTICATE AS DEMO USER</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-3">
          <div className="flex-grow border-t border-[#141414]/20"></div>
          <span className="flex-shrink mx-2 text-[10px] text-[#666] uppercase">
            OR CREDENTIAL SIGN IN
          </span>
          <div className="flex-grow border-t border-[#141414]/20"></div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-600 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-[#141414] mb-1 uppercase">FULL_NAME</label>
              <input
                id="auth-name-input"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Developer Name"
                className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[#141414] mb-1 uppercase">EMAIL_ADDRESS</label>
            <input
              id="auth-email-input"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@organization.ai"
              className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#141414] mb-1 uppercase">PASSWORD</label>
            <input
              id="auth-password-input"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#F8F7F4] border border-[#141414] px-3 py-2 text-xs font-mono text-[#141414] placeholder-[#888] focus:outline-none focus:bg-white"
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2 px-4 bg-white hover:bg-[#E4E3E0] border border-[#141414] text-[#141414] text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {isLoading
                ? 'PROCESSING...'
                : isRegister
                ? 'CREATE TENANT WORKSPACE'
                : 'VERIFY & SIGN IN'}
            </span>
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[#666]">
          {isRegister ? (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="text-[#141414] font-bold underline ml-1"
              >
                Sign in here
              </button>
            </span>
          ) : (
            <span>
              Need a workspace account?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="text-[#141414] font-bold underline ml-1"
              >
                Register workspace
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

