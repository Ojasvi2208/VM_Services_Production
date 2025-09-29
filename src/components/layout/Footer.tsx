import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white">
      <div className="container-padding py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Vijay Malik Financial Services</h3>
            <p className="text-sm text-mist">AMFI Registered MFD (ARN-317605), NISM-Certified</p>
            <p className="text-sm text-mist">Chandigarh • WhatsApp: 9417334348</p>
            <p className="text-sm text-mist">Email: ojasvi_vijaymalik@outlook.com</p>
          </div>
          
          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/verify-arn" className="text-sm text-mist hover:text-white transition">
                  Verify ARN
                </Link>
              </li>
              <li>
                <Link href="/disclosures" className="text-sm text-mist hover:text-white transition">
                  Disclosures
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-mist hover:text-white transition">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/partners" className="text-sm text-mist hover:text-white transition">
                  Partners
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-lg font-medium mb-4">Connect With Us</h4>
            <Link 
              href="https://wa.me/919417334348"
              target="_blank"
              rel="noopener noreferrer" 
              className="inline-block bg-teal text-white px-4 py-2 rounded-md font-medium hover:bg-teal-deep transition"
            >
              WhatsApp Us
            </Link>
            <p className="mt-4 text-sm text-mist">
              Questions? Send us a WhatsApp at 9417334348
            </p>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs text-mist mb-4 md:mb-0">
              © {new Date().getFullYear()} Vijay Malik Financial Services. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <Link href="/privacy" className="text-xs text-mist hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-xs text-mist hover:text-white">
                Terms of Use
              </Link>
              <Link href="/disclosures" className="text-xs text-mist hover:text-white">
                Disclosures
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Risk Disclaimer */}
      <div className="bg-brick text-white py-3 text-center text-xs">
        Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
      </div>
    </footer>
  );
}
