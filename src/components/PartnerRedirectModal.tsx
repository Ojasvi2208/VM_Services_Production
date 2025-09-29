'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Link from 'next/link';

type PartnerRedirectModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  partnerName: string;
  partnerUrl: string;
  partnerCode?: string;
};

export default function PartnerRedirectModal({
  isOpen,
  closeModal,
  partnerName,
  partnerUrl,
  partnerCode
}: PartnerRedirectModalProps) {
  // State for countdown timer
  const [countdown, setCountdown] = useState(5);
  
  // Effect to handle countdown and redirect
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset countdown when modal opens
    setCountdown(5);
    
    // Set up countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect happens after countdown finishes using noreferrer pattern
          const link = document.createElement('a');
          link.href = partnerUrl + (partnerCode ? `?code=${partnerCode}` : '');
          link.target = '_blank';
          link.rel = 'noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          closeModal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isOpen, partnerUrl, partnerCode, closeModal]);
  
  // Function to handle immediate redirect
  const handleRedirectNow = () => {
    // Create a special anchor with noreferrer and open it
    const link = document.createElement('a');
    link.href = partnerUrl + (partnerCode ? `?code=${partnerCode}` : '');
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    closeModal();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="text-right mb-2">
                  <button 
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-charcoal"
                >
                  Redirecting to {partnerName}
                </Dialog.Title>
                
                <div className="mt-3 border-t border-b border-mist py-4">
                  <p className="text-sm text-charcoal/80">
                    You are being redirected to {partnerName}&apos;s platform in <span className="font-bold text-teal">{countdown} seconds</span>.
                  </p>
                  
                  <div className="mt-4 mb-2 bg-mist/50 p-3 rounded text-xs text-charcoal/70">
                    <p className="font-medium text-sm text-charcoal mb-1">Important Disclosures:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Vijay Malik Financial Services is a Mutual Fund Distributor (MFD) registered with AMFI.</li>
                      <li>Investments made on partner platforms may result in commissions to us, which are built into the product expenses.</li>
                      <li>Market investments involve risks. Read all scheme related documents carefully before investing.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={handleRedirectNow}
                  >
                    Redirect Now
                  </button>
                </div>
                
                <p className="mt-4 text-xs text-center text-charcoal/60">
                  By proceeding, you acknowledge that you have read and understood our <Link href="/disclosures" className="text-teal hover:underline">disclosures</Link>.
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
