import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Floating WhatsApp bubble animation ───────────────────────────────────────
const FloatingBubble = ({ style, delay, text }) => (
  <div
    className="absolute rounded-2xl px-4 py-2 text-sm font-medium shadow-lg pointer-events-none select-none"
    style={{
      ...style,
      animation: `floatBubble 6s ease-in-out ${delay}s infinite`,
      opacity: 0.85,
    }}
  >
    {text}
  </div>
)

// ─── Step card ─────────────────────────────────────────────────────────────────
const StepCard = ({ number, title, desc, icon, delay }) => (
  <div
    className="step-card relative p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-black font-black text-lg shadow-lg shadow-[#25D366]/30">
      {number}
    </div>
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{desc}</p>
  </div>
)

// ─── Feature pill ──────────────────────────────────────────────────────────────
const Feature = ({ icon, text }) => (
  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-3">
    <span className="text-xl">{icon}</span>
    <span className="text-gray-300 text-sm font-medium">{text}</span>
  </div>
)

// ─── Industry chip ─────────────────────────────────────────────────────────────
const Industry = ({ emoji, name }) => (
  <div className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#25D366]/40 hover:bg-[#25D366]/5 transition-all duration-300 cursor-default">
    <span className="text-3xl">{emoji}</span>
    <span className="text-sm text-gray-400 font-medium">{name}</span>
  </div>
)

export default function Landing() {
  const navigate = useNavigate()
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing-root min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">

      {/* ── Global Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .landing-root { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Syne', sans-serif; }

        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-18px) rotate(1deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.4); }
          50%       { box-shadow: 0 0 0 20px rgba(37,211,102,0); }
        }
        @keyframes scrollTicker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .fade-up { animation: fadeUp 0.7s ease both; }
        .fade-up-1 { animation: fadeUp 0.7s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.2s ease both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.4s ease both; }

        .btn-primary {
          background: #25D366;
          color: #000;
          font-weight: 700;
          padding: 14px 36px;
          border-radius: 100px;
          font-size: 16px;
          transition: all 0.2s;
          animation: pulseGreen 2.5s infinite;
          font-family: 'Syne', sans-serif;
          letter-spacing: -0.2px;
        }
        .btn-primary:hover {
          background: #1fb855;
          transform: scale(1.04);
          box-shadow: 0 8px 32px rgba(37,211,102,0.35);
        }
        .btn-secondary {
          background: transparent;
          color: white;
          font-weight: 600;
          padding: 14px 36px;
          border-radius: 100px;
          font-size: 16px;
          border: 1.5px solid rgba(255,255,255,0.2);
          transition: all 0.2s;
          font-family: 'Syne', sans-serif;
        }
        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.05);
        }

        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }

        .step-card {
          animation: fadeUp 0.6s ease both;
        }

        .ticker-wrap {
          overflow: hidden;
          white-space: nowrap;
        }
        .ticker-inner {
          display: inline-block;
          animation: scrollTicker 20s linear infinite;
        }

        .phone-mockup {
          background: #1a1a1a;
          border-radius: 40px;
          border: 2px solid rgba(255,255,255,0.1);
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
        }
        .chat-bubble-in {
          background: #262626;
          border-radius: 18px 18px 18px 4px;
          padding: 10px 14px;
          max-width: 75%;
          margin-bottom: 8px;
        }
        .chat-bubble-btn {
          background: #1a3a2a;
          border: 1px solid #25D366;
          color: #25D366;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
          width: 100%;
          text-align: center;
        }

        .pricing-card {
          background: linear-gradient(135deg, rgba(37,211,102,0.08) 0%, rgba(37,211,102,0.02) 100%);
          border: 1.5px solid rgba(37,211,102,0.3);
          border-radius: 32px;
          position: relative;
          overflow: hidden;
        }
        .pricing-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #25D366, transparent);
        }
      `}</style>

      {/* ── NAV ───────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: scrollY > 40 ? 'rgba(10,10,10,0.9)' : 'transparent', backdropFilter: scrollY > 40 ? 'blur(12px)' : 'none', borderBottom: scrollY > 40 ? '1px solid rgba(255,255,255,0.06)' : 'none', transition: 'all 0.3s' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center text-black font-black text-sm">W</div>
          <span className="font-display font-bold text-xl tracking-tight">YourBrand</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="btn-secondary text-sm px-6 py-2.5">
            Login
          </button>
          <button onClick={() => navigate('/signup')} className="btn-primary text-sm px-6 py-2.5" style={{ animation: 'none' }}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-20 overflow-hidden">

        {/* Background orbs */}
        <div className="glow-orb w-[600px] h-[600px] bg-[#25D366] opacity-[0.06] top-[-100px] left-[-200px]" />
        <div className="glow-orb w-[400px] h-[400px] bg-[#128C7E] opacity-[0.08] bottom-[0] right-[-100px]" />

        {/* Floating chat bubbles */}
        <FloatingBubble style={{ top: '22%', right: '8%', background: '#1a3a2a', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)' }} delay={0} text="📋 View our menu" />
        <FloatingBubble style={{ top: '60%', right: '14%', background: '#262626', color: '#e5e5e5', fontSize: '13px' }} delay={1.5} text="🕐 Business hours?" />
        <FloatingBubble style={{ top: '38%', right: '3%', background: '#1a2a3a', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', fontSize: '12px' }} delay={3} text="📞 Book appointment" />

        <div className="relative max-w-6xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">

          {/* Left — Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full px-4 py-2 mb-8 fade-up">
              <div className="w-2 h-2 bg-[#25D366] rounded-full" style={{ animation: 'pulseGreen 1.5s infinite' }} />
              <span className="text-[#25D366] text-sm font-medium">WhatsApp Automation for Indian Businesses</span>
            </div>

            <h1 className="font-display text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6 fade-up-1">
              Your business,<br />
              <span style={{ color: '#25D366' }}>always</span> answering<br />
              on WhatsApp
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-10 fade-up-2 max-w-lg">
              Build a smart button-based chatbot for your WhatsApp Business number — no coding needed. Customers get instant answers, you get more time to run your business.
            </p>

            <div className="flex flex-wrap gap-4 mb-12 fade-up-3">
              <button onClick={() => navigate('/signup')} className="btn-primary">
                Start Building Free →
              </button>
              <button onClick={() => navigate('/login')} className="btn-secondary">
                I have an account
              </button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 fade-up-4">
              {['No coding required', 'Live in minutes', '₹500/month flat'].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-[#25D366]">✓</span> {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Phone mockup */}
          <div className="flex justify-center lg:justify-end fade-up-2">
            <div className="phone-mockup w-[280px]">
              {/* Status bar */}
              <div className="bg-[#111] px-5 pt-4 pb-2 flex justify-between items-center text-xs text-gray-500">
                <span>9:41</span>
                <span>●●●</span>
              </div>
              {/* WA header */}
              <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-bold">M</div>
                <div>
                  <div className="text-white text-sm font-semibold">Maya's Clinic</div>
                  <div className="text-white/60 text-xs">Online</div>
                </div>
              </div>
              {/* Chat */}
              <div className="bg-[#0d1117] px-3 py-4 min-h-[340px]">
                <div className="chat-bubble-in mb-4">
                  <p className="text-gray-200 text-sm">👋 Welcome to Maya's Clinic!</p>
                  <p className="text-gray-400 text-xs mt-1">How can I help you?</p>
                </div>
                <div className="space-y-2 mb-4">
                  {['📅 Book Appointment', '💊 Services & Fees', '🕐 Clinic Hours'].map(b => (
                    <div key={b} className="chat-bubble-btn">{b}</div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#25D366]/20 rounded-2xl rounded-br-md px-3 py-2">
                    <p className="text-[#25D366] text-sm">📅 Book Appointment</p>
                  </div>
                </div>
                <div className="chat-bubble-in mt-3">
                  <p className="text-gray-200 text-sm">📅 To book, call us at<br/><span className="text-[#25D366] font-semibold">+91-98765-43210</span></p>
                  <p className="text-gray-400 text-xs mt-1">Mon–Sat, 9AM–6PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ────────────────────────────────────────────────────────────── */}
      <div className="ticker-wrap py-5 border-y border-white/5 bg-white/[0.02]">
        <div className="ticker-inner">
          {[...Array(2)].map((_, i) => (
            <span key={i}>
              {['🍽️ Restaurants', '🏥 Clinics', '🛒 Retail Shops', '🏠 Real Estate', '💈 Salons', '🎓 Coaching Centers', '🚗 Service Centers', '💊 Pharmacies', '🏋️ Gyms', '📦 Delivery Services'].map(item => (
                <span key={item} className="inline-block mx-8 text-gray-500 text-sm font-medium">{item}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="relative py-28 px-8">
        <div className="glow-orb w-[500px] h-[500px] bg-[#25D366] opacity-[0.04] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">Simple Setup</p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">Live in 3 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard number="1" icon="📝" title="Sign up & describe your business" desc="Create your account and tell us about your business. Takes less than 2 minutes." delay={0.1} />
            <StepCard number="2" icon="🔧" title="Build your chatbot menu" desc="Add your services, prices, hours — everything your customers ask about. No coding at all." delay={0.2} />
            <StepCard number="3" icon="🚀" title="Go Live on WhatsApp" desc="Pay ₹500/month and your chatbot starts responding to customers instantly, 24/7." delay={0.3} />
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-8 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight mb-3">Works for every business</h2>
            <p className="text-gray-500">If customers ask the same questions on WhatsApp, you need this.</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-4">
            {[
              ['🍽️','Restaurant'], ['🏥','Clinic'], ['🛒','Shop'], ['🏠','Real Estate'],
              ['💈','Salon'], ['🎓','Coaching'], ['🚗','Garage'], ['💊','Pharmacy'],
              ['🏋️','Gym'], ['📦','Delivery']
            ].map(([emoji, name]) => (
              <Industry key={name} emoji={emoji} name={name} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────────── */}
      <section className="py-28 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tight mb-4">Everything you need.<br />Nothing you don't.</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Built for Indian small business owners who want results without complexity.</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              ['💬','Button-based menus — no AI errors'],
              ['🌐','Works on any WhatsApp Business number'],
              ['⚡','Responds instantly, 24 hours a day'],
              ['🔧','Build & edit from a simple dashboard'],
              ['🔒','Secure multi-tenant platform'],
              ['📱','No app download needed for customers'],
              ['♾️','Unlimited nested menu levels'],
              ['🇮🇳','UPI, Cards & Net Banking via Razorpay'],
              ['📊','One chatbot per subscription'],
              ['🛑','Cancel anytime, no lock-in'],
            ].map(([icon, text]) => <Feature key={text} icon={icon} text={text} />)}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-3">Simple Pricing</p>
            <h2 className="font-display text-4xl font-bold tracking-tight">One plan. One price.</h2>
          </div>
          <div className="pricing-card p-10">
            <div className="text-center mb-8">
              <p className="text-gray-400 mb-4 text-lg">Per chatbot, per month</p>
              <div className="flex items-end justify-center gap-2 mb-2">
                <span className="font-display text-7xl font-extrabold text-white">₹500</span>
                <span className="text-gray-400 mb-3 text-lg">/month</span>
              </div>
              <p className="text-[#25D366] text-sm">Billed monthly. Cancel anytime.</p>
            </div>

            <div className="space-y-4 mb-10">
              {[
                'Your own WhatsApp Business number',
                'Unlimited button menu levels',
                'Instant customer responses 24/7',
                'Simple dashboard to manage everything',
                'Monthly auto-renewal via Razorpay',
                'Pause or cancel anytime',
              ].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-[#25D366]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#25D366] text-xs">✓</span>
                  </div>
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/signup')} className="btn-primary w-full text-center text-lg">
              Start Free — Activate When Ready
            </button>
            <p className="text-center text-gray-600 text-xs mt-4">Build your chatbot for free. Pay only when you go live.</p>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-8">
        <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl p-16 text-center"
          style={{ background: 'linear-gradient(135deg, #0d2b1a 0%, #0a1a0f 100%)', border: '1px solid rgba(37,211,102,0.2)' }}>
          <div className="glow-orb w-80 h-80 bg-[#25D366] opacity-[0.12] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          <p className="relative text-[#25D366] text-sm font-semibold tracking-widest uppercase mb-4">Ready to get started?</p>
          <h2 className="relative font-display text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
            Set up your chatbot<br />in under 10 minutes
          </h2>
          <p className="relative text-gray-400 text-lg mb-10 max-w-lg mx-auto">
            Join businesses already using our platform to automate their WhatsApp customer service.
          </p>
          <button onClick={() => navigate('/signup')} className="btn-primary text-lg px-12 py-4">
            Create Your Free Account →
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center text-black font-black text-xs">W</div>
            <span className="font-display font-bold text-lg">YourBrand</span>
          </div>
          <p className="text-gray-600 text-sm">© 2026 YourBrand. Built for Indian small businesses.</p>
          <div className="flex gap-6 text-sm text-gray-600">
            <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Login</button>
            <button onClick={() => navigate('/signup')} className="hover:text-white transition-colors">Sign Up</button>
          </div>
        </div>
      </footer>

    </div>
  )
}