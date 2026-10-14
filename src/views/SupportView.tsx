import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Send, CheckCircle2, ShieldCheck, AlertCircle, MessageSquare } from 'lucide-react';

interface SupportViewProps {
  initialOrderRef?: string;
}

export const SupportView: React.FC<SupportViewProps> = ({ initialOrderRef = '' }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Ticket form
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderRef, setOrderRef] = useState(initialOrderRef);
  const [category, setCategory] = useState<'delivery' | 'activation' | 'billing' | 'question'>('activation');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const faqs = [
    {
      q: 'How does digital delivery work on ToolPadi?',
      a: 'All purchases are fulfilled through verified wholesale allocations. Once your payment is verified by our server, license keys and team invitation tokens are immediately generated on your screen and saved in your customer order lookup dashboard. You do not have to wait for manual email forwarding.'
    },
    {
      q: 'What is the 48-Hour Replacement or Refund Warranty?',
      a: 'If any delivered license key fails to activate or a team invitation is not recognized within 48 hours of purchase, our support desk will either re-issue fresh working credentials within 2 business hours or issue a 100% full refund.'
    },
    {
      q: 'Why are prices so much lower than retail subscription billing?',
      a: 'ToolPadi works with authorized wholesale suppliers (such as InsightXPro) who license developer and SME seat allocations in bulk. We apply a transparent, modest markup rather than charging standard individual retail pricing.'
    },
    {
      q: 'How are benchmark reference prices calculated?',
      a: 'We strictly refuse to fabricate fake original prices or discount percentages. Reference prices are only displayed if they cite an official public pricing portal URL, compare identical durations, and were confirmed within the past 30 days. Stale benchmarks are automatically removed by our pricing engine.'
    },
    {
      q: 'What payment methods do you accept in Nigeria?',
      a: 'We support local Nigerian bank transfers (via simulated dedicated virtual accounts) as well as cards (Mastercard, Visa, Verve). All transactions are confirmed server-side.'
    },
    {
      q: 'What happens if a product is marked "Pending Reseller Verification"?',
      a: 'To protect consumers, our platform gates all products until an authorized reseller agreement is verified. Products without confirmed reseller distribution terms cannot be purchased.'
    }
  ];

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setTicketResult(null);

    try {
      const resp = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail,
          customer_name: customerName,
          order_reference: orderRef || null,
          category,
          subject,
          message
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to submit ticket.');

      setTicketResult(data);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#08231b]">
          Help Center & Support Desk
        </h1>
        <p className="text-xs sm:text-sm text-[#59665f] mt-1">
          Instant answers to common activation questions and dedicated 2-hour resolution tickets.
        </p>
      </div>

      {/* FAQs Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-xl text-[#08231b] flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#0e382b]" />
          <span>Frequently Asked Questions</span>
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="bg-white border border-[#e6e2d6] rounded-xl overflow-hidden transition-all shadow-2xs"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#08231b] hover:bg-[#faf9f5] cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#0e382b] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8a968f] shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-[#526058] leading-relaxed border-t border-[#f4f0e6]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Ticket Form */}
      <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading font-bold text-xl text-[#08231b] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#0e382b]" />
              <span>Submit a Support Inquiry</span>
            </h2>
            <p className="text-xs text-[#59665f] mt-1">
              Need help with a key or invite? Our technical operations desk responds within 2 business hours.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-[#1a634b] font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Warranty Coverage Active</span>
            </span>
          </div>
        </div>

        {ticketResult ? (
          <div className="p-6 bg-[#f0f7f3] border border-[#cbe4d4] rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#65a30d] mx-auto" />
            <h3 className="font-heading font-bold text-base text-[#08231b]">Ticket Registered</h3>
            <p className="text-xs text-[#1e4a36]">
              Ticket Reference: <strong className="font-mono text-sm">{ticketResult.ticket_reference}</strong>
            </p>
            <p className="text-xs text-[#4f6057] max-w-md mx-auto">
              {ticketResult.message}
            </p>
            <button
              onClick={() => setTicketResult(null)}
              className="mt-3 py-2 px-4 bg-[#0e382b] text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Submit Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-[#fef2f2] text-xs text-[#991b1b] rounded-lg border border-[#fecaca]">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Your Full Name <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Adebayo Ogunlesi"
                  className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Email Address <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Related Order Reference (Optional)
                </label>
                <input
                  type="text"
                  value={orderRef}
                  onChange={(e) => setOrderRef(e.target.value)}
                  placeholder="e.g. TP-2026-4819"
                  className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Category <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a] cursor-pointer"
                >
                  <option value="activation">Activation / Key Issue</option>
                  <option value="delivery">Delivery Status Query</option>
                  <option value="billing">Payment / Bank Transfer Clarification</option>
                  <option value="question">Pre-Sale Tool Inquiries</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#2f3d35] mb-1">
                Subject <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2f3d35] mb-1">
                Detailed Message <span className="text-[#b91c1c]">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what occurred or paste any error message from the vendor..."
                className="w-full px-3.5 py-2.5 bg-[#faf9f5] border border-[#d8d3c5] rounded-lg text-sm text-[#141f1a]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-3 px-6 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-[#a3e635]" />
              <span>{isSubmitting ? 'Submitting...' : 'Dispatch Ticket to Support Desk'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
