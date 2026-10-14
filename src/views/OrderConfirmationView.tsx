import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Eye, EyeOff, ShieldCheck, Download, ExternalLink, HelpCircle } from 'lucide-react';
import type { Order, Delivery } from '../types.js';

interface OrderConfirmationViewProps {
  order: Order;
  deliveries: Delivery[];
  onNavigateHome: () => void;
  onNavigateSupport: () => void;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  deliveries,
  onNavigateHome,
  onNavigateSupport
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Success banner */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 bg-[#f0f7f3] text-[#134e3a] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#65a30d]" />
        </div>

        <div>
          <span className="text-xs text-[#5a6760] font-semibold tracking-wider uppercase">
            Payment Verified & Order Fulfilled
          </span>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b] mt-1">
            Thank you, {order.customer_name}!
          </h1>
          <p className="text-xs text-[#526058] mt-1">
            Your digital licenses and access credentials have been issued and saved to your account.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 bg-[#f4f1ea] px-4 py-2 rounded-lg text-xs">
          <span className="text-[#65736b]">Order Reference:</span>
          <strong className="font-mono text-[#0e382b] text-sm">{order.order_reference}</strong>
        </div>
      </div>

      {/* Delivered Licenses and Digital Tokens Vault */}
      <div className="space-y-4">
        <h3 className="font-heading font-bold text-lg text-[#08231b] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#65a30d]" />
          <span>Your Delivered Access Keys & Invitations</span>
        </h3>

        {deliveries.length === 0 ? (
          <div className="bg-white border border-[#e6e2d6] rounded-xl p-6 text-center text-xs text-[#5a6860] space-y-2">
            <p>Your access invitation is currently being processed by the supplier queue.</p>
            <p className="text-[11px] text-[#78887f]">Check your email ({order.customer_email}) or refresh this screen in 2 minutes.</p>
          </div>
        ) : (
          deliveries.map((del, idx) => {
            const isRevealed = revealedKeys[del.id] ?? false;

            return (
              <div
                key={del.id}
                className="bg-white border border-[#e6e2d6] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#f0ece2]">
                  <div>
                    <span className="text-[11px] text-[#65736b]">Digital Asset #{idx + 1}</span>
                    <h4 className="font-heading font-bold text-base text-[#08231b]">
                      {del.delivery_type.replace(/_/g, ' ').toUpperCase()}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#84cc16]"></span>
                    <span className="text-[#1a634b] font-semibold">Active & Validated</span>
                  </div>
                </div>

                {/* Secret Key Display */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#2a3831] flex items-center justify-between">
                    <span>Activation Key / Access Token:</span>
                    <button
                      onClick={() => toggleReveal(del.id)}
                      className="text-xs text-[#0e382b] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isRevealed ? 'Mask' : 'Reveal'}</span>
                    </button>
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#f4f1ea] border border-[#dcd7cb] rounded-lg px-3.5 py-2.5 font-mono text-xs sm:text-sm text-[#0e382b] overflow-x-auto select-all">
                      {isRevealed ? del.license_code_or_credential : '••••••••••••••••••••••••••••••••'}
                    </div>

                    <button
                      onClick={() => handleCopy(del.license_code_or_credential, del.id)}
                      className="py-2.5 px-4 bg-[#0e382b] hover:bg-[#134e3a] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedKey === del.id ? (
                        <>
                          <Check className="w-4 h-4 text-[#a3e635]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Key</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-3.5 bg-[#faf8f2] border border-[#ded8c9] rounded-lg text-xs space-y-1">
                  <strong className="text-[#0e382b] block">Activation Guide:</strong>
                  <p className="text-[#4e5b53] leading-relaxed">{del.instructions}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-between">
        <button
          onClick={onNavigateHome}
          className="py-3 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
        >
          Return to Marketplace Home
        </button>

        <button
          onClick={onNavigateSupport}
          className="py-3 px-5 bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#0e382b] font-semibold text-xs rounded-lg transition-colors border border-[#dcd7cb] cursor-pointer flex items-center justify-center gap-2"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Need Help with Activation? Contact Support</span>
        </button>
      </div>
    </div>
  );
};
