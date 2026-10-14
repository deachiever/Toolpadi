import React, { useState } from 'react';
import { ShieldCheck, FileText, RefreshCw, Lock } from 'lucide-react';

interface LegalViewProps {
  initialTab?: 'terms' | 'refunds' | 'privacy';
}

export const LegalView: React.FC<LegalViewProps> = ({ initialTab = 'terms' }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'refunds' | 'privacy'>(initialTab);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Tab Switcher (Zero-pill button segmented bar) */}
      <div className="flex items-center gap-1 p-1 bg-[#ede9de] rounded-lg border border-[#ded8c9] max-w-md text-xs">
        <button
          onClick={() => setActiveTab('terms')}
          className={`flex-1 py-2 px-3 font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'terms' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#5a6760]'
          }`}
        >
          Terms of Service
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`flex-1 py-2 px-3 font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'refunds' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#5a6760]'
          }`}
        >
          48h Refund & Warranty
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex-1 py-2 px-3 font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'privacy' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#5a6760]'
          }`}
        >
          Privacy Policy
        </button>
      </div>

      {/* TERMS OF SERVICE */}
      {activeTab === 'terms' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-10 space-y-6 text-xs text-[#4a574f] leading-relaxed shadow-2xs">
          <div className="border-b border-[#f0ece2] pb-4">
            <span className="text-[11px] font-semibold uppercase text-[#1a634b]">Compliance & Governance</span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b] mt-1">
              ToolPadi Terms of Service
            </h1>
            <p className="text-[11px] text-[#6b7971] mt-1">
              Effective Date: October 2026 · Governing Law: Federal Republic of Nigeria
            </p>
          </div>

          <div className="p-4 bg-[#fbfaf6] border border-[#e6e2d6] rounded-xl text-[11px] text-[#55635b]">
            <strong>Entity Disclosure:</strong> ToolPadi is a proposed project name pending business-name, trademark, domain, and social-handle validation. Operating as an Africa-first digital tools marketplace connecting creators and developers with verified wholesale access.
          </div>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">1. Authorized Wholesale Allocation Model</h3>
            <p>
              ToolPadi does not generate, crack, or alter third-party proprietary software. All licenses, team invitations, and vouchers listed on this platform are acquired through authorized bulk distributor channels (including certified wholesale API suppliers such as InsightXPro). Every tool is categorized by its precise access method: team workspace seat, direct account invitation, license activation string, or voucher code.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">2. Reseller Authorization Gate</h3>
            <p>
              Any product listed in the catalogue without verified commercial distribution rights and clear supplier terms is quarantined under <code className="bg-[#f4f1ea] px-1 py-0.5 rounded font-mono">pending_verification</code> or <code className="bg-[#f4f1ea] px-1 py-0.5 rounded font-mono">restricted</code> status. Under no circumstance may unauthorized items be checked out by customers.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">3. Pricing Transparency & Anti-Slop Charter</h3>
            <p>
              ToolPadi calculates prices with transparent fixed markups or percentage margins. We strictly prohibit fake countdown timers, artificial scarcity tickers, and fabricated original prices. Reference benchmarks are only presented when verified against official public vendor pricing within the preceding 30 days. Stale claims are systematically suppressed by server rules.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">4. Digital Delivery & Turnaround</h3>
            <p>
              Upon verified payment confirmation via our server-side adapter, activation credentials are delivered to the customer’s secure order dashboard. Most deliveries are instantaneous; however, certain enterprise team invitations may require up to 2 hours during normal business hours.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">5. Acceptable Use</h3>
            <p>
              Customers agree to use assigned seats and license strings in accordance with vendor acceptable use guidelines. Attempting to reverse engineer, duplicate, or re-sell individual tokens purchased on ToolPadi is strictly prohibited and subject to immediate revocation without refund.
            </p>
          </section>
        </div>
      )}

      {/* 48-HOUR REFUND POLICY */}
      {activeTab === 'refunds' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-10 space-y-6 text-xs text-[#4a574f] leading-relaxed shadow-2xs">
          <div className="border-b border-[#f0ece2] pb-4">
            <span className="text-[11px] font-semibold uppercase text-[#1a634b]">Customer Assurance Guarantee</span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b] mt-1">
              48-Hour Replacement & Refund Warranty
            </h1>
            <p className="text-[11px] text-[#6b7971] mt-1">
              Transparent, guaranteed coverage for all digital purchases.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#f0f7f3] border border-[#cbe4d4] rounded-xl text-[#1e4a36]">
            <ShieldCheck className="w-5 h-5 text-[#1a634b] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#08231b]">100% Activation Guarantee</p>
              <p className="mt-0.5">
                Every software license, activation key, and team invite sold through ToolPadi is guaranteed to work as specified, or we replace it or refund your full payment.
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">1. Covered Conditions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>License key invalid, expired, or rejected upon redemption during initial setup.</li>
              <li>Workspace invite email not received or link inactive within 48 hours of payment.</li>
              <li>Delivered access does not match the stated duration or plan tier.</li>
              <li>Supplier allocation revocation occurring within the warranty window.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">2. Resolution Procedure</h3>
            <p>
              Step 1: Open a support ticket via our Support Desk or order tracking panel providing your order reference (e.g. <code className="bg-[#f4f1ea] px-1 py-0.5 rounded font-mono">TP-2026-XXXX</code>).
            </p>
            <p>
              Step 2: Our operations desk will re-verify the supplier allocation and attempt immediate re-issuance of a fresh working key or invite within 2 business hours.
            </p>
            <p>
              Step 3: If replacement cannot be delivered within 4 business hours, an automatic 100% refund is initiated back to your original payment channel.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">3. Exclusions</h3>
            <p>
              The warranty does not cover change-of-mind cancellations after successful activation has taken place, or vendor account suspensions resulting from customer violations of third-party platform rules.
            </p>
          </section>
        </div>
      )}

      {/* PRIVACY POLICY */}
      {activeTab === 'privacy' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-10 space-y-6 text-xs text-[#4a574f] leading-relaxed shadow-2xs">
          <div className="border-b border-[#f0ece2] pb-4">
            <span className="text-[11px] font-semibold uppercase text-[#1a634b]">Data Protection</span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b] mt-1">
              ToolPadi Privacy Policy
            </h1>
            <p className="text-[11px] text-[#6b7971] mt-1">
              Compliant with the Nigeria Data Protection Act (NDPA) and international standards.
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">1. Information We Collect</h3>
            <p>
              We collect minimal information necessary to deliver your digital purchases: recipient email address, full name, and optional phone number for WhatsApp activation notifications. We never store credit card numbers or banking passwords on our servers.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">2. Supplier Secrets & Key Protection</h3>
            <p>
              Supplier API keys (<code className="bg-[#f4f1ea] px-1 py-0.5 rounded font-mono">INSIGHT_API_KEY</code>) are stored in encrypted server-side environments and are never transmitted to client browsers, network inspection tabs, or telemetry trackers.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-[#08231b]">3. Zero Unsolicited Marketing</h3>
            <p>
              Your contact details are solely used for digital delivery fulfillment, receipts, and order support. We never sell, rent, or share customer data with third-party advertising brokers.
            </p>
          </section>
        </div>
      )}
    </div>
  );
};
