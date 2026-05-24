import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <div className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-yellow-400 font-semibold hover:text-yellow-300 transition">
          <ArrowBackIcon sx={{ fontSize: 20 }} />
          Back to Home
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Left Side */}
          <div className="flex flex-col justify-center text-white hidden lg:flex">
            <h1 className="text-6xl font-bold mb-6">Get Started</h1>
            <p className="text-lg mb-8">Already have an account?</p>
            <Link href="/login" className="border-2 border-white rounded-full px-8 py-3 w-fit text-lg font-semibold hover:bg-white hover:text-slate-900 transition">
              Log in
            </Link>
          </div>

          {/* Right Side - Form Card */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-lg p-8 shadow-2xl border border-slate-700/50">
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-blue-400 mb-2">Create account</h2>
              </div>

              <form className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Email</label>
                  <input 
                    type="email" 
                    placeholder="you@example.com" 
                    className="w-full px-4 py-3 border-2 border-slate-600 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full px-4 py-3 border-2 border-slate-600 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Your name" 
                    className="w-full px-4 py-3 border-2 border-slate-600 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    className="w-5 h-5 rounded border-slate-600 cursor-pointer accent-blue-500"
                  />
                  <label htmlFor="terms" className="text-slate-300 text-sm cursor-pointer">
                    I accept the terms of the agreement
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition mt-6"
                >
                  Sign up
                </button>
              </form>

              <p className="text-center text-sm text-slate-400 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
