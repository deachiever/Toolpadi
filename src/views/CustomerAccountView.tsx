import React, { useState } from 'react';
import { Search, ShieldCheck, Copy, Check, Eye, EyeOff, Package, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import type { Order, Delivery } from '../types.js';

interface CustomerAccountViewProps {
  onNavigateSupportWithOrder?: (orderRef: string) => void;
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  onNavigateSupportWithOrder
}) => {
  const [lookupType, setLookupType] = useState<'reference' | 'email'>('reference');
  const [orderReference, setOrderReference] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [singleOrderResult, setSingleOrderResult] = useState<{
    order: Order;
    items: any[];
    deliveries: Delivery[];
  } | null>(null);

  const [emailOrdersResult, setEmailOrdersResult] = useState<Order[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSingleOrderResult(null);
    setEmailOrdersResult([]);

    try {
      if (lookupType === 'reference') {
        const ref = orderReference.trim();
        if (!ref) throw new Error('Please enter a valid order reference (e.g. TP-2026-XXXX).');
        const em = email.trim();
        const url = em
          ? `/api/orders/${encodeURIComponent(ref)}?email=${encodeURIComponent(em)}`
          : `/api/orders/${encodeURIComponent(ref)}`;

        const resp = await fetch(url);
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || 'Order not found or authorization failed.');
        }

        setSingleOrderResult(data);
      } else {
        const em = email.trim();
        if (!em) throw new Error('Please enter your account email.');

        const resp = await fetch(`/api/customer/orders?email=${encodeURIComponent(em)}`);
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || 'Failed to retrieve orders.');
        }

        if (data.orders.length === 0) {
          throw new Error(`No orders found matching email ${em}.`);
        }

        setEmailOrdersResult(data.orders);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmailOrder = async (ref: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const resp = await fetch(`/api/orders/${encodeURIComponent(ref)}?email=${encodeURIComponent(email.trim())}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Order lookup failed.');
      setSingleOrderResult(data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
          Order & License Lookup
        </h1>
        <p className="text-xs sm:text-sm text-[#59665f] mt-1">
          Retrieve your digital license keys, team invitations, and receipt history without needing a complex password.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xs">
        {/* Toggle Lookup Mode (Zero-pill button selector) */}
        <div className="flex items-center gap-2 p-1 bg-[#f4f1ea] rounded-lg border border-[#e2ddd0] max-w-sm">
          <button
            onClick={() => setLookupType('reference')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              lookupType === 'reference'
                ? 'bg-white text-[#0e382b] shadow-2xs'
                : 'text-[#596860] hover:text-[#0e382b]'
            }`}
          >
            By Order Reference
          </button>
          <button
            onClick={() => setLookupType('email')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              lookupType === 'email'
                ? 'bg-white text-[#0e382b] shadow-2xs'
                : 'text-[#596860] hover:text-[#0e382b]'
            }`}
          >
            By Customer Email
          </button>
        </div>

        <form onSubmit={handleLookup} className="space-y-4">
          {lookupType === 'reference' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2f3d35] mb-1">
                  Order Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TP-2026-3924"
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm font-mono text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2f3d35] mb-1">
                  Purchaser Email Address <span className="text-[#65736b] font-normal">(Security verification)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="e.g. your-email@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="py-2.5 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {isLoading ? 'Searching...' : 'Find Order'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#2f3d35] mb-1">
                Purchasing Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2.5 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {isLoading ? 'Searching...' : 'Find All Orders'}
                </button>
              </div>
            </div>
          )}
        </form>

        {errorMessage && (
          <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Multiple Orders Found List */}
      {emailOrdersResult.length > 0 && !singleOrderResult && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-bold text-base text-[#08231b]">
            Orders Found for {email} ({emailOrdersResult.length})
          </h3>
          <div className="divide-y divide-[#f0ece2]">
            {emailOrdersResult.map(ord => (
              <div key={ord.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <strong className="font-mono text-sm text-[#0e382b]">{ord.order_reference}</strong>
                  <p className="text-[#65736b] mt-0.5">
                    {new Date(ord.created_at).toLocaleDateString()} · ₦{ord.total_amount.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${ord.payment_status === 'paid' ? 'text-[#1a634b]' : 'text-[#b45309]'}`}>
                    {ord.payment_status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleSelectEmailOrder(ord.order_reference)}
                    className="py-1.5 px-3 bg-[#f4f1ea] hover:bg-[#eae5d8] text-[#0e382b] font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    View Licenses →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Order Detail Result */}
      {singleOrderResult && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f0ece2]">
            <div>
              <span className="text-xs text-[#627068]">Order Reference</span>
              <h3 className="font-heading font-extrabold text-2xl text-[#0e382b]">
                {singleOrderResult.order.order_reference}
              </h3>
              <p className="text-xs text-[#627068] mt-0.5">
                Placed on {new Date(singleOrderResult.order.created_at).toLocaleString()}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-[#627068]">Payment Status</span>
              <div className="font-bold text-sm text-[#1a634b]">
                {singleOrderResult.order.payment_status.toUpperCase()}
              </div>
              <p className="text-xs text-[#141f1a] font-extrabold mt-0.5">
                ₦{singleOrderResult.order.total_amount.toLocaleString()} ({singleOrderResult.order.currency})
              </p>
            </div>
          </div>

          {/* Purchased Items */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-sm text-[#08231b]">Purchased Items:</h4>
            <div className="bg-[#faf8f2] border border-[#e6e2d6] rounded-xl p-4 divide-y divide-[#f0ece2] text-xs">
              {singleOrderResult.items.map(item => (
                <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex justify-between">
                  <div>
                    <strong className="text-[#141f1a]">{item.product_title}</strong>
                    <p className="text-[11px] text-[#65736b]">
                      Qty: {item.quantity} · {item.duration} · {item.access_type}
                    </p>
                  </div>
                  <span className="font-bold text-[#0e382b]">
                    ₦{(item.unit_price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivered Licenses */}
          <div className="space-y-4 pt-2">
            <h4 className="font-heading font-bold text-sm text-[#08231b] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#65a30d]" />
              <span>Delivered Licenses & Credentials</span>
            </h4>

            {singleOrderResult.deliveries.length === 0 ? (
              <div className="p-4 bg-[#fbfaf6] border border-[#e6e2d6] rounded-xl text-xs text-[#616f67]">
                No digital delivery records found for this order. If your payment was completed, please allow up to 10 minutes or contact support below.
              </div>
            ) : (
              singleOrderResult.deliveries.map((del, i) => {
                const isRevealed = revealedKeys[del.id] ?? false;
                const content = del.license_code_or_credential;
                const isUrl = content.startsWith('http://') || content.startsWith('https://');

                return (
                  <div key={del.id} className="p-5 border border-[#e0dacb] rounded-xl bg-[#fdfdfb] space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0e382b]">
                          Asset #{i + 1} ({isUrl ? 'Redemption Link' : del.delivery_type.replace(/_/g, ' ')})
                        </span>
                        {del.supplier_order_id && (
                          <span className="text-[10px] bg-[#f4f1ea] px-2 py-0.5 rounded font-mono text-[#526058] border border-[#e2ddd0]">
                            Supplier #{del.supplier_order_id}
                          </span>
                        )}
                      </div>
                      <span className="text-[#1a634b] font-medium bg-[#f0fdf4] px-2 py-0.5 rounded border border-[#bbf7d0]">
                        Status: {del.delivery_status}
                      </span>
                    </div>

                    {isUrl ? (
                      <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#15803d]">Unique Activation URL:</span>
                          <a
                            href={content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 bg-[#16a34a] hover:bg-[#15803d] text-white rounded text-xs font-bold inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Open Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={content}
                            className="flex-1 bg-white border border-[#bbf7d0] rounded px-2.5 py-1.5 font-mono text-xs text-[#0e382b] select-all"
                          />
                          <button
                            onClick={() => handleCopy(content, del.id)}
                            className="py-1.5 px-3 bg-white border border-[#bbf7d0] text-[#166534] rounded text-xs font-semibold hover:bg-[#f0fdf4]"
                          >
                            {copiedKey === del.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#65736b]">Credential / Key:</span>
                          <button
                            onClick={() => toggleReveal(del.id)}
                            className="text-[#0e382b] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#f4f1ea] border border-[#dcd7cb] rounded-lg px-3 py-2 font-mono text-xs text-[#0e382b] overflow-x-auto select-all">
                            {isRevealed ? content : '••••••••••••••••••••••••••••••••'}
                          </div>
                          <button
                            onClick={() => handleCopy(content, del.id)}
                            className="py-2 px-3 bg-[#0e382b] text-white rounded-lg text-xs font-semibold hover:bg-[#134e3a] cursor-pointer flex items-center gap-1"
                          >
                            {copiedKey === del.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedKey === del.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-[#faf8f2] rounded-lg border border-[#e8e2d4] text-[11px] text-[#4f5c54]">
                      <strong>Instructions: </strong> {del.instructions}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Need help button */}
          {onNavigateSupportWithOrder && (
            <div className="pt-2 text-right">
              <button
                onClick={() => onNavigateSupportWithOrder(singleOrderResult.order.order_reference)}
                className="text-xs text-[#0e382b] font-semibold hover:underline cursor-pointer"
              >
                Having trouble activating this order? Open support ticket →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
