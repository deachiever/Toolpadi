import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { Order, Delivery } from '../types.js';

interface OrderConfirmationViewProps {
  order: Order;
  deliveries: Delivery[];
  onNavigateHome: () => void;
  onNavigateSupport: () => void;
  onRefreshOrder?: (ref: string) => Promise<void>;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  deliveries: initialDeliveries,
  onNavigateHome,
  onNavigateSupport,
  onRefreshOrder
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Sync state if props change
  useEffect(() => {
    setCurrentOrder(order);
    setDeliveries(initialDeliveries);
  }, [order, initialDeliveries]);

  // Persist confirmed order reference to localStorage for resilience
  useEffect(() => {
    if (order?.order_reference) {
      try {
        localStorage.setItem('toolpadi_last_order_ref', order.order_reference);
        localStorage.setItem('toolpadi_last_order_email', order.customer_email);
      } catch {}
    }
  }, [order]);

  // Auto-poll if order fulfilment is still processing
  useEffect(() => {
    if (currentOrder.fulfilment_status === 'processing' || deliveries.length === 0) {
      const pollTimer = setInterval(() => {
        handleManualSync(false);
      }, 5000);

      return () => clearInterval(pollTimer);
    }
  }, [currentOrder.fulfilment_status, deliveries.length]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleManualSync = async (showFeedback = true) => {
    if (isSyncing || !currentOrder?.order_reference) return;
    setIsSyncing(true);
    if (showFeedback) setSyncMessage('Querying supplier network...');

    try {
      const resp = await fetch(`/api/orders/${currentOrder.order_reference}/sync`, {
        method: 'POST'
      });
      const data = await resp.json();

      if (data.order) {
        setCurrentOrder(data.order);
      }
      if (Array.isArray(data.deliveries) && data.deliveries.length > 0) {
        setDeliveries(data.deliveries);
      }
      if (showFeedback && data.message) {
        setSyncMessage(data.message);
        setTimeout(() => setSyncMessage(null), 4000);
      }
      if (onRefreshOrder) {
        await onRefreshOrder(currentOrder.order_reference);
      }
    } catch (err: any) {
      if (showFeedback) {
        setSyncMessage('Status check completed.');
        setTimeout(() => setSyncMessage(null), 3000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const isDelivered = deliveries.length > 0 && currentOrder.fulfilment_status === 'fulfilled';
  const supplierRef = currentOrder.supplier_order_id || (deliveries[0]?.supplier_order_id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Success banner */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] rounded-full flex items-center justify-center mx-auto shadow-2xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]">
              Payment Verified
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              isDelivered
                ? 'bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]'
                : 'bg-[#fef9c3] text-[#854d0e] border border-[#fef08a]'
            }`}>
              {isDelivered ? 'Fulfilment Complete' : 'Fulfilment Processing'}
            </span>
          </div>

          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
            Thank you, {currentOrder.customer_name || 'Valued Customer'}!
          </h1>
          <p className="text-xs text-[#526058] mt-1 max-w-md mx-auto">
            Your payment has been reconciled. All digital credentials and invitations are saved permanently to your order account.
          </p>
        </div>

        {/* References Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2">
          <div className="inline-flex items-center gap-2 bg-[#f4f1ea] px-3.5 py-1.5 rounded-lg text-xs border border-[#e2ddd0]">
            <span className="text-[#65736b]">ToolPadi Order Ref:</span>
            <strong className="font-mono text-[#0e382b] font-bold">{currentOrder.order_reference}</strong>
          </div>

          {supplierRef && (
            <div className="inline-flex items-center gap-2 bg-[#f0f7f3] px-3.5 py-1.5 rounded-lg text-xs border border-[#cbe4d4]">
              <span className="text-[#134e3a]">Supplier Dispatch ID:</span>
              <strong className="font-mono text-[#0e382b] font-bold">#{supplierRef}</strong>
            </div>
          )}

          <div className="inline-flex items-center gap-2 bg-[#f4f1ea] px-3.5 py-1.5 rounded-lg text-xs border border-[#e2ddd0]">
            <span className="text-[#65736b]">Total Paid:</span>
            <strong className="text-[#0e382b] font-bold">
              {currentOrder.currency === 'USD' ? `$${currentOrder.total_amount}` : `₦${currentOrder.total_amount.toLocaleString()}`}
            </strong>
          </div>
        </div>
      </div>

      {/* Sync Status Banner if processing */}
      {!isDelivered && (
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 text-[#92400e]">
            <Clock className="w-4 h-4 shrink-0 animate-pulse text-[#d97706]" />
            <div>
              <p className="font-bold">Digital Invitation Processing</p>
              <p className="text-[11px] text-[#b45309]">The supplier is issuing your personalized access link. This usually takes 1-2 minutes.</p>
            </div>
          </div>

          <button
            onClick={() => handleManualSync(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d97706] hover:bg-[#b45309] text-white rounded-lg font-bold text-xs cursor-pointer transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Checking...' : 'Check Status Now'}</span>
          </button>
        </div>
      )}

      {syncMessage && (
        <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] rounded-lg text-xs text-center font-medium animate-fade-in">
          {syncMessage}
        </div>
      )}

      {/* Delivered Licenses and Digital Tokens Vault */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg text-[#08231b] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#16a34a]" />
            <span>Delivered Digital Access & Credentials</span>
          </h3>

          <span className="text-xs text-[#526058]">
            {deliveries.length} {deliveries.length === 1 ? 'asset delivered' : 'assets delivered'}
          </span>
        </div>

        {deliveries.length === 0 ? (
          <div className="bg-white border border-[#e6e2d6] rounded-xl p-8 text-center text-xs text-[#5a6860] space-y-3 shadow-2xs">
            <Clock className="w-8 h-8 text-[#d97706] mx-auto animate-pulse" />
            <h4 className="font-bold text-sm text-[#08231b]">Preparing Your Digital Asset</h4>
            <p className="max-w-md mx-auto text-[#627168]">
              Your payment has been verified. The supplier dispatch engine is currently generating your secure activation token or redemption URL.
            </p>
            <div className="pt-2">
              <button
                onClick={() => handleManualSync(true)}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0e382b] hover:bg-[#134e3a] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Refresh Delivery Status</span>
              </button>
            </div>
          </div>
        ) : (
          deliveries.map((del, idx) => {
            const isRevealed = revealedKeys[del.id] ?? false;
            const content = del.license_code_or_credential;
            const isUrl = content.startsWith('http://') || content.startsWith('https://');

            return (
              <div
                key={del.id || idx}
                className="bg-white border border-[#e6e2d6] rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#f0ece2]">
                  <div>
                    <span className="text-[11px] text-[#65736b]">Digital Asset #{idx + 1}</span>
                    <h4 className="font-heading font-bold text-base text-[#08231b]">
                      {isUrl ? 'Direct Activation & Redemption Link' : (del.delivery_type.replace(/_/g, ' ').toUpperCase())}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#16a34a]"></span>
                    <span className="text-[#166534] font-semibold bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
                      Active & Ready
                    </span>
                  </div>
                </div>

                {/* If it is an activation URL: show primary 1-click CTA button */}
                {isUrl ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-[#15803d] uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-[#16a34a]" />
                            <span>Instant Direct Access Portal</span>
                          </span>
                          <p className="text-xs text-[#166534]">
                            Click the button below to open your unique invitation and link your subscription immediately.
                          </p>
                        </div>

                        <a
                          href={content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                        >
                          <span>Open Activation Link</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Display URL and copy button */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#dcfce7]">
                        <input
                          type="text"
                          readOnly
                          value={content}
                          className="flex-1 bg-white border border-[#bbf7d0] rounded-lg px-3 py-2 font-mono text-xs text-[#08231b] select-all overflow-x-auto"
                        />
                        <button
                          onClick={() => handleCopy(content, del.id)}
                          className="py-2 px-3 bg-white hover:bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedKey === del.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard License Key Display */
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
                        {isRevealed ? content : '••••••••••••••••••••••••••••••••'}
                      </div>

                      <button
                        onClick={() => handleCopy(content, del.id)}
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
                )}

                {/* Instructions */}
                <div className="p-3.5 bg-[#faf8f2] border border-[#ded8c9] rounded-lg text-xs space-y-1">
                  <strong className="text-[#0e382b] block">Activation Guide:</strong>
                  <p className="text-[#4e5b53] leading-relaxed">
                    {del.instructions || 'Follow the on-screen steps to activate your digital license.'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 48-Hour Guarantee Note */}
      <div className="flex items-start gap-3 p-4 bg-[#f0f7f3] border border-[#cbe4d4] rounded-xl text-xs text-[#1e4a36]">
        <ShieldCheck className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[#0e382b]">ToolPadi 48-Hour Replacement Guarantee</p>
          <p className="mt-0.5 leading-relaxed text-[#2a5b46]">
            Every digital purchase is backed by our full replacement guarantee. If you face any difficulty redeeming access or linking your email, our operations team will immediately assist or issue a full refund.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-between">
        <button
          onClick={onNavigateHome}
          className="py-3 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
        >
          <span>Return to Marketplace Home</span>
          <ArrowRight className="w-4 h-4" />
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
