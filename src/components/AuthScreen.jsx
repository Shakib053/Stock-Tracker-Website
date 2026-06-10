function AuthScreen({ authError, isSigningIn, onSignIn, configError }) {
  const message = configError
    ? 'Firebase is not configured yet. Add the required Vite environment variables before deploying or running the app.'
    : authError

  return (
    <div className="app-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 px-6 py-8 shadow-glow sm:px-8 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-400/10 via-transparent to-emerald-400/10" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                Private Admin Dashboard
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Keep your stock records private behind your own Google sign-in.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                This app now uses Firebase Authentication and Firestore so your entries stay tied
                to your own account and are not shown to other visitors. After sign-in, search DSE
                trading codes directly instead of memorizing them.
              </p>
            </div>

            <div className="glass-panel p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-white">Sign in to continue</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Only authenticated users can open the tracker or load private stock data.
              </p>

              {message ? (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
                  {message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn || Boolean(configError)}
                className="action-button mt-6 w-full bg-accent py-3 text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {isSigningIn ? 'Signing In...' : 'Continue with Google'}
              </button>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Firebase Auth protects access. Firestore security rules ensure each account can
                only read and write its own documents.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AuthScreen
