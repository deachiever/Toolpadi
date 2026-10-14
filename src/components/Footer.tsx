import React from 'react';
import { ShieldCheck, CheckCircle2, RefreshCw, Lock } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#08231b] text-[#cbd3cc] border-t border-[#134e3a] mt-20">
      {/* Trust Markers Bar */}
      <div className="border-b border-[#143d30] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#a3e635] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">Reseller Authorization Gate</p>
              <p className="text-xs text-[#a0ada5] mt-0.5">Every tool undergoes strict license distribution compliance checks before public sale.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-[#a3e635] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">48-Hour Replacement Warranty</p>
              <p className="text-xs text-[#a0ada5] mt-0.5">Prompt replacement or full refund if any activation issue cannot be resolved immediately.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#a3e635] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">Transparent Benchmark Rules</p>
              <p className="text-xs text-[#a0ada5] mt-0.5">No fabricated discounts or false scarcity. Verified against official public sources only.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#a3e635] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">Encrypted Digital Vault</p>
              <p className="text-xs text-[#a0ada5] mt-0.5">License codes and access tokens stored securely with idempotency and audit logs.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-[#134e3a] flex items-center justify-center text-white">
                <span className="font-heading font-black text-sm text-[#a3e635]">TP</span>
              </div>
              <span className="font-heading font-bold text-xl text-white">ToolPadi</span>
            </div>
            <p className="text-xs text-[#a3b3aa] max-w-sm leading-relaxed mb-4">
              Your digital tools, within reach. Africa-first marketplace making essential creative, developer, and productivity software accessible through competitive, transparent pricing.
            </p>
            <p className="text-xs text-[#829288] italic">
              Powerful tools. Prices that work for you.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Marketplace</h4>
            <ul className="space-y-2 text-xs text-[#cbd3cc]">
              <li>
                <button onClick={() => onNavigate('catalogue')} className="hover:text-white transition-colors cursor-pointer">
                  Browse All Tools
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('account')} className="hover:text-white transition-colors cursor-pointer">
                  Order & License Lookup
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('support')} className="hover:text-white transition-colors cursor-pointer">
                  Help Center & FAQs
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Governance</h4>
            <ul className="space-y-2 text-xs text-[#cbd3cc]">
              <li>
                <button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors cursor-pointer">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('refunds')} className="hover:text-white transition-colors cursor-pointer">
                  48h Refund & Warranty Policy
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('privacy')} className="hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Operations</h4>
            <ul className="space-y-2 text-xs text-[#cbd3cc]">
              <li>
                <button onClick={() => onNavigate('admin')} className="hover:text-[#a3e635] transition-colors cursor-pointer font-medium">
                  Admin Console
                </button>
              </li>
              <li>
                <span className="text-[#849289]">Currencies: NGN (₦) / USD ($)</span>
              </li>
              <li>
                <span className="text-[#849289]">Rate: ₦1,450 / $1 (Wholesale Fixed)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footnote Disclosures */}
        <div className="pt-8 mt-8 border-t border-[#133d30] text-[11px] text-[#78887e] leading-relaxed flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="max-w-3xl">
            <strong>Disclosure:</strong> ToolPadi is a proposed project name pending business-name, trademark, domain, and social-handle validation. Demonstration catalogue items are explicitly identified. Reseller authorization status is recorded and enforced on every product. Payments in sandbox mode do not debit actual currency.
          </p>
          <p className="shrink-0 text-[#a4b2a8]">
            © {new Date().getFullYear()} ToolPadi Marketplace.
          </p>
        </div>
      </div>
    </footer>
  );
};
