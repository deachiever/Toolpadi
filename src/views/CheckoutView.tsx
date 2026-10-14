import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building,
  CreditCard,
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import type { Order } from '../types.js';

interface CheckoutViewProps {
  onSuccess: (order: Order, deliveries: any[]) => void;
  onBack: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({ onSuccess, onBack }) => {
  const {
    cart,
    clearCart,
    currency,
    setCurrency,
    totalNgn,
    totalUsd,
    totalSavingsNgn,
    totalSavingsUsd,
    formatPrice,
    exchangeRate,
    getItemPrice
  } = useCart();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'bank_transfer' | 'card'>('bank_transfer');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment simulation state
  const [activePaymentSession, setActivePaymentSession] = useState<any | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const currentTotal = currency === 'USD' ? totalUsd : totalNgn;

  const handleInitiateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setErrorMessage('Please accept the ToolPadi marketplace terms and 48-hour warranty conditions to proceed.');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const payload = {
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        currency,
        channel,
        idempotency_key: idempotencyKey,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      };

      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to initialize checkout.');
      }

      // Received created order and payment initialization info
      setActivePaymentSession({
        order_reference: data.order_reference,
        order: data.order,
        payment: data.payment
      });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulatePaymentCompletion = async () => {
    if (!activePaymentSession) return;

    setIsVerifyingPayment(true);
    setErrorMessage(null);

    try {
      // Call server verification endpoint (server handles fulfilment and atomic transactions)
      const resp = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_reference: activePaymentSession.order_reference,
          payment_reference: activePaymentSession.payment?.payment_reference,
          simulation_channel: channel
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Payment verification failed.');
      }

      // Fetch the full order details including delivered licenses
      const orderResp = await fetch(`/api/orders/${activePaymentSession.order_reference}`);
      const orderData = await orderResp.json();

      clearCart();
      onSuccess(orderData.order, orderData.deliveries || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  if (cart.length === 0 && !activePaymentSession) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="font-heading font-bold text-2xl text-[#08231b]">Your cart is empty</h2>
        <p className="text-xs text-[#5e6d65]">Please add items from the catalogue before proceeding to checkout.</p>
        <button
          onClick={onBack}
          className="py-2.5 px-5 bg-[#0e382b] text-white rounded-lg text-xs font-semibold hover:bg-[#134e3a] cursor-pointer"
        >
          Return to Catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
          Secure Checkout
        </h1>
        <p className="text-xs sm:text-sm text-[#59665f] mt-1">
          Final currency confirmation, recipient details, and encrypted delivery setup.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* If waiting for payment simulation */}
      {activePaymentSession ? (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <span className="text-xs text-[#5e6d65]">Order Reference:</span>
              <h3 className="font-heading font-bold text-xl text-[#0e382b]">
                {activePaymentSession.order_reference}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#5e6d65]">Total Due:</span>
              <div className="font-heading font-extrabold text-xl text-[#08231b]">
                {formatPrice(
                  activePaymentSession.payment?.amount || currentTotal,
                  (activePaymentSession.payment?.amount || currentTotal) / exchangeRate
                )}
              </div>
            </div>
          </div>

          {/* Sandbox Payment Simulator Notice */}
          <div className="bg-[#f0f7f3] border border-[#cbe4d4] rounded-xl p-4 text-xs text-[#1e4a36] space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1a634b]" />
              <span>Sandbox Payment Mode Active</span>
            </p>
            <p className="leading-relaxed">
              In accordance with project launch regulations, live checkout is held until formal merchant processing approval. You can simulate the full end-to-end payment and instant supplier fulfilment flow below.
            </p>
          </div>

          {channel === 'bank_transfer' ? (
            <div className="space-y-4">
              <h4 className="font-heading font-bold text-sm text-[#08231b] flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0e382b]" />
                <span>Simulated Nigerian Bank Transfer Account</span>
              </h4>

              <div className="bg-[#faf8f2] border border-[#dcd7cb] rounded-xl p-5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#65736b]">Bank Name:</span>
                    <p className="font-bold text-[#141f1a]">
                      {activePaymentSession.payment?.bank_details?.bank_name || 'ToolPadi Test Bank (Providus Simulator)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#65736b]">Account Number:</span>
                    <p className="font-mono font-extrabold text-base text-[#0e382b]">
                      {activePaymentSession.payment?.bank_details?.account_number || '9920194821'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#65736b]">Beneficiary:</span>
                    <p className="font-semibold text-[#141f1a]">
                      {activePaymentSession.payment?.bank_details?.account_name || `TOOLPADI / ${activePaymentSession.order_reference}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#65736b]">Validity:</span>
                    <p className="font-medium text-[#141f1a]">30 Minutes</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e8e2d4] text-[11px] text-[#637269]">
                  Send exact amount from your mobile banking app. Click button below to simulate server-side bank webhook receipt.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-heading font-bold text-sm text-[#08231b] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#0e382b]" />
                <span>Simulated Secure Card Gateway</span>
              </h4>
              <div className="p-4 bg-[#faf8f2] border border-[#dcd7cb] rounded-xl text-xs space-y-2">
                <p className="text-[#3c4a43]">
                  Simulated 3DS test card gateway for <strong>{formatPrice(currentTotal, currentTotal / exchangeRate)}</strong>.
                </p>
                <p className="text-[11px] text-[#65736b]">
                  Card networks: Mastercard, Visa, Verve (Nigeria). Test transactions generate instant webhook events.
                </p>
              </div>
            </div>
          )}

          {/* Action Simulation Trigger */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSimulatePaymentCompletion}
              disabled={isVerifyingPayment}
              className="flex-1 py-3 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isVerifyingPayment ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#a3e635]" />
                  <span>Verifying Transaction & Fulfilling Supplier Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#a3e635]" />
                  <span>
                    {channel === 'bank_transfer'
                      ? 'Simulate Transfer Received (Verify & Fulfill)'
                      : 'Simulate 3DS Card Approval (Verify & Fulfill)'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => setActivePaymentSession(null)}
              disabled={isVerifyingPayment}
              className="py-3 px-4 bg-[#f4f1ea] hover:bg-[#eae5d8] text-[#0e382b] font-semibold text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Form view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customer Details & Payment Form (2 cols) */}
          <form onSubmit={handleInitiateOrder} className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-5 shadow-2xs">
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                1. Delivery & Recipient Contact
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-[#2f3c35] mb-1">
                    Email Address <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com or personal email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#6b7971] mt-1">
                    Team invitations, license strings, and receipt details will be sent directly here.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-[#2f3c35] mb-1">
                    Full Name <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Olusegun Adekunle"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#2f3c35] mb-1">
                    Phone / WhatsApp Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +234 801 234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] focus:ring-2 focus:ring-[#0e382b] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#6b7971] mt-1">
                    Used strictly for emergency WhatsApp activation support if supplier email is delayed.
                  </p>
                </div>
              </div>
            </div>

            {/* Currency Confirmation Box */}
            <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-[#08231b]">
                  2. Final Currency & Rounding Policy
                </h3>
                <div className="flex items-center bg-[#f0ece2] p-0.5 rounded border border-[#dfdbce]">
                  <button
                    type="button"
                    onClick={() => setCurrency('NGN')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                      currency === 'NGN' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#64726a]'
                    }`}
                  >
                    ₦ NGN
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                      currency === 'USD' ? 'bg-white text-[#0e382b] shadow-2xs' : 'text-[#64726a]'
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#faf8f2] border border-[#ded8c9] rounded-lg text-xs text-[#49564e] leading-relaxed">
                <p>
                  <strong>Confirmed Checkout Currency:</strong> {currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}.
                  Wholesale rate benchmark: ₦{exchangeRate.toLocaleString()} / $1. NGN amounts are rounded to the nearest ₦50 or ₦100 to ensure clear bank transfer reconciliation without fractional kobo errors.
                </p>
              </div>
            </div>

            {/* Payment Channel Selection */}
            <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4 shadow-2xs">
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                3. Payment Method (Sandbox Simulator)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label
                  onClick={() => setChannel('bank_transfer')}
                  className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                    channel === 'bank_transfer'
                      ? 'border-[#0e382b] bg-[#f7f5ed] ring-1 ring-[#0e382b]'
                      : 'border-[#e6e2d6] bg-white hover:border-[#cbd3cc]'
                  }`}
                >
                  <Building className="w-5 h-5 text-[#0e382b] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#08231b]">Nigerian Bank Transfer</p>
                    <p className="text-[#65736b] text-[11px] mt-0.5">
                      Dedicated virtual test account (Providus/Wema). Instant automated verification.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setChannel('card')}
                  className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                    channel === 'card'
                      ? 'border-[#0e382b] bg-[#f7f5ed] ring-1 ring-[#0e382b]'
                      : 'border-[#e6e2d6] bg-white hover:border-[#cbd3cc]'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#0e382b] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#08231b]">Debit Card (Test Gateway)</p>
                    <p className="text-[#65736b] text-[11px] mt-0.5">
                      Mastercard, Visa, Verve test cards with simulated OTP verification.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Agreement & Submit */}
            <div className="space-y-4 pt-2">
              <label className="flex items-start gap-2.5 text-xs text-[#3f4d45] cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="rounded text-[#0e382b] focus:ring-[#0e382b] mt-0.5"
                />
                <span>
                  I understand that ToolPadi operates an authorized wholesale allocation model. I agree to the{' '}
                  <span className="font-semibold text-[#0e382b] underline">Marketplace Terms</span> and the 48-Hour Replacement/Refund Warranty.
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#a3e635]" />
                    <span>Creating Order & Initializing Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Simulated Payment</span>
                    <ArrowRight className="w-4 h-4 text-[#a3e635]" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Column: Order Summary (1 col) */}
          <div className="space-y-6">
            <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4 sticky top-24 shadow-2xs">
              <h3 className="font-heading font-bold text-base text-[#08231b] pb-3 border-b border-[#f0ece2]">
                Order Summary
              </h3>

              <div className="space-y-3 text-xs divide-y divide-[#f5f2e9]">
                {cart.map(item => {
                  const priceInfo = getItemPrice(item);
                  return (
                    <div key={item.product.id} className="pt-2 first:pt-0 flex justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[#141f1a] line-clamp-1">
                          {item.product.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-[#637269]">
                            Qty: {item.quantity} · {item.product.duration.replace('_', ' ')}
                          </p>
                          {priceInfo.isBulkApplied && (
                            <span className="text-[9px] font-bold text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-1.5 py-0.2 rounded">
                              {priceInfo.tierLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#0e382b] block">
                          {formatPrice(priceInfo.totalNgn, priceInfo.totalUsd)}
                        </span>
                        {priceInfo.isBulkApplied && priceInfo.totalSavingsNgn > 0 && (
                          <span className="text-[10px] text-[#16a34a] font-medium block">
                            Saved {formatPrice(priceInfo.totalSavingsNgn, priceInfo.totalSavingsUsd)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#f0ece2] space-y-2 text-xs">
                <div className="flex justify-between text-[#5f6d65]">
                  <span>Subtotal:</span>
                  <span>{formatPrice(totalNgn, totalUsd)}</span>
                </div>
                {totalSavingsNgn > 0 && (
                  <div className="flex justify-between text-[#166534] font-semibold">
                    <span>Volume Bulk Savings:</span>
                    <span>- {formatPrice(totalSavingsNgn, totalSavingsUsd)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#5f6d65]">
                  <span>Digital Delivery:</span>
                  <span className="text-[#1a634b] font-medium">Free (Instant Online)</span>
                </div>
                <div className="flex justify-between text-[#5f6d65]">
                  <span>Processing Fee:</span>
                  <span className="text-[#1a634b] font-medium">₦0 (Covered)</span>
                </div>
                <div className="pt-2 border-t border-[#f0ece2] flex justify-between items-baseline">
                  <span className="font-bold text-sm text-[#141f1a]">Final Amount:</span>
                  <span className="font-heading font-black text-2xl text-[#08231b]">
                    {formatPrice(totalNgn, totalUsd)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#fbfaf6] border border-[#e6e2d6] rounded-lg text-[11px] text-[#606e66] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#65a30d] shrink-0 mt-0.5" />
                <span>
                  Protected by 48-hour replacement warranty and encrypted digital credentials vault.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
