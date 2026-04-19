import { useEffect, useState } from 'react'
import {
  Link2, CreditCard, Loader2, Check, Phone, Key, Eye, EyeOff, Hash
} from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

export default function SettingsPage() {
  const {
    ownerData, subscription, error,
    whatsappForm, showToken, setShowToken, savingWhatsapp,
    whatsappAccount, whatsappConnectionStatus,
    handleWhatsappFormChange, handleSaveWhatsapp, handleSaveReceptionPhone,
    formatAmount, hasWhatsappCreds,
  } = useDashboard()

  const [receptionPhone, setReceptionPhone] = useState(ownerData?.reception_phone ?? '')

  useEffect(() => {
    setReceptionPhone(ownerData?.reception_phone ?? '')
  }, [ownerData?.reception_phone])

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm'
  const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'

  return (
    <div className="max-w-2xl space-y-6">
      <div id="whatsapp" className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Link2 size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-lg text-foreground">WhatsApp Connection</h3>
              <p className="text-muted-foreground text-[11px] mt-0.5">Connect your WhatsApp Business number</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              hasWhatsappCreds ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-warning/10 text-warning border border-warning/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasWhatsappCreds ? 'bg-primary animate-pulse' : 'bg-warning'}`} />
              {hasWhatsappCreds ? 'Connected' : 'Not Connected'}
            </div>
          </div>
        </div>
        <form onSubmit={handleSaveWhatsapp} className="p-6 space-y-5">
          <div className="rounded-xl border border-border bg-surface-raised/40 p-3 text-xs text-muted-foreground space-y-1.5">
            <p><span className="font-semibold text-foreground">Status:</span> {String(whatsappConnectionStatus || 'disconnected').replace(/_/g, ' ')}</p>
            {whatsappAccount?.phone_number_id && <p><span className="font-semibold text-foreground">Phone Number ID:</span> {whatsappAccount.phone_number_id}</p>}
            {whatsappAccount?.quality_rating && <p><span className="font-semibold text-foreground">Quality:</span> {whatsappAccount.quality_rating}</p>}
            {whatsappAccount?.messaging_limit_tier && <p><span className="font-semibold text-foreground">Daily limit tier:</span> {whatsappAccount.messaging_limit_tier}</p>}
            {whatsappAccount?.token_last_verified_at && <p><span className="font-semibold text-foreground">Token verified:</span> {new Date(whatsappAccount.token_last_verified_at).toLocaleString()}</p>}
            {whatsappAccount?.throttled && <p className="text-warning">Dispatch paused: account is throttled.</p>}
            {whatsappConnectionStatus === 'reauth_required' && (
              <p className="text-warning">Reconnect required: Meta rejected the token. Save fresh credentials to resume sending.</p>
            )}
            {whatsappAccount?.disconnect_reason && (
              <p className="text-destructive">Last issue: {whatsappAccount.disconnect_reason}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>WhatsApp Business Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type="text" name="whatsapp_business_number" value={whatsappForm.whatsapp_business_number}
                onChange={handleWhatsappFormChange} className={inputCls + ' pl-10'} placeholder="e.g., 919876543210" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Enter your WhatsApp Business phone number with country code (no + or spaces)</p>
          </div>
          <div>
            <label className={labelCls}>WhatsApp Phone Number ID</label>
            <div className="relative">
              <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type="text" name="whatsapp_phone_number_id" value={whatsappForm.whatsapp_phone_number_id}
                onChange={handleWhatsappFormChange} className={inputCls + ' pl-10'} placeholder="e.g., 123456789012345" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Find this in Meta Developer Portal → WhatsApp → API Setup → Phone Number ID</p>
          </div>
          <div>
            <label className={labelCls}>WhatsApp Access Token</label>
            <div className="relative">
              <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type={showToken ? 'text' : 'password'} name="whatsapp_api_token" value={whatsappForm.whatsapp_api_token}
                onChange={handleWhatsappFormChange} className={inputCls + ' pl-10 pr-10'} placeholder="Paste your access token here" />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Get this from <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Meta Developer Portal</a> - WhatsApp - API Setup
            </p>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button type="submit" disabled={savingWhatsapp}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {savingWhatsapp ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> Save WhatsApp Config</>}
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Phone size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Reception Number</h3>
              <p className="text-muted-foreground text-[11px] mt-0.5">Number that receives booking and handoff alerts</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div>
            <label htmlFor="reception-phone" className={labelCls}>
              Reception WhatsApp Number
            </label>
            <input
              id="reception-phone"
              type="text"
              value={receptionPhone}
              onChange={e => setReceptionPhone(e.target.value)}
              placeholder="919876543210 (country code, no +)"
              aria-label="Reception phone"
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Booking and handoff alerts are sent to this number
            </p>
            <button
              type="button"
              onClick={() => handleSaveReceptionPhone(receptionPhone)}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Save Reception Number
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-secondary/8 via-secondary/3 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
              <CreditCard size={18} className="text-secondary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Subscription</h3>
              <p className="text-muted-foreground text-[11px] mt-0.5">Manage your plan and billing</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {subscription ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                subscription.status === 'active' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
              }`}>
                <span className={`w-2 h-2 rounded-full ${subscription.status === 'active' ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                {subscription.status === 'active' ? 'Active' : subscription.status}
              </span>
              <span className="text-muted-foreground text-sm font-medium">{formatAmount(subscription.amount)}/month</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No active subscription. Build and publish a flow to activate.</p>
          )}
        </div>
      </div>
    </div>
  )
}
