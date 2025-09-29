'use client';

import { useState } from 'react';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// Contact form component
const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'general',
    message: '',
  });
  
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send this data to a server
    console.log('Form submitted:', formData);
    setFormSubmitted(true);
  };
  
  if (formSubmitted) {
    return (
      <div className="bg-gradient-to-br from-white via-brand-pearl to-green-50/30 rounded-lg p-6 shadow-lg border border-green-200/50 animate-fadeInUp">
        <div className="text-center py-8">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-brand-navy mb-3">Message <span className="text-brand-gold">Sent!</span></h3>
          <p className="text-brand-navy/80 mb-6 leading-relaxed">
            Thank you for contacting Vijay Malik Financial Services. We&apos;ll respond to your message within <span className="text-brand-royal font-semibold">24-48 hours</span>.
          </p>
          <button 
            onClick={() => setFormSubmitted(false)}
            className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-6 py-3 rounded-lg font-medium hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-200"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-lg p-6 shadow-lg animate-fadeInUp animation-delay-300">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse mr-3"></div>
        <h3 className="text-xl font-bold text-brand-navy">Send Us a <span className="text-brand-royal">Message</span></h3>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          <div className="transform hover:scale-[1.02] transition-all duration-200">
            <label htmlFor="name" className="block text-sm font-medium text-brand-navy mb-1">
              Your Name <span className="text-brand-gold">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal transition-all duration-200 hover:border-brand-gold/50"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy mb-1">
              Email Address <span className="text-brand-gold">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-olive"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-navy mb-1">
              Phone Number <span className="text-brand-gold">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-olive"
            />
          </div>
          
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-navy mb-1">
              Subject
            </label>
            <select
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-olive"
            >
              <option value="general">General Inquiry</option>
              <option value="investment">Investment Related</option>
              <option value="service">Service Issue</option>
              <option value="partnership">Partnership Opportunity</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-navy mb-1">
              Your Message*
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              value={formData.message}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-olive"
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="btn-primary w-full"
        >
          Send Message
        </button>
        
        <p className="text-xs text-center text-navy/70 mt-4">
          We typically respond to all inquiries within 1-2 business days.
        </p>
      </form>
    </div>
  );
};

// Contact information card
const ContactInfo = ({
  icon, 
  title, 
  details,
  link,
  linkText
}: {
  icon: React.ReactNode;
  title: string;
  details: string;
  link?: string;
  linkText?: string;
}) => {
  return (
    <div className="card-light p-4 sm:p-6 rounded-lg flex flex-col h-full">
      <div className="h-12 w-12 rounded-full bg-olive/10 flex items-center justify-center text-olive mb-4">
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold text-olive mb-2">{title}</h3>
      <p className="text-navy mb-4">{details}</p>
      
      {link && linkText && (
        <a 
          href={link} 
          className="text-olive font-medium hover:underline mt-auto"
          target={link.startsWith('http') ? '_blank' : undefined}
          rel={link.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {linkText}
        </a>
      )}
    </div>
  );
};

export default function ContactPage() {
  // Icons (simplified SVG for this example)
  const phoneIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
  
  const emailIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
  
  const locationIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  
  const whatsappIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <h1 className="text-3xl font-bold text-brand-navy mb-4 heading-with-accent">Contact Us</h1>
          <p className="text-lg text-brand-navy mb-8 max-w-3xl">
            Have questions about investing or need help with your financial journey? We're here to help. Reach out to our team using any of the methods below.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Contact Form */}
            <div>
              <ContactForm />
            </div>
            
            {/* Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <ContactInfo 
                icon={phoneIcon}
                title="Call Us"
                details="Mon-Fri, 10:00 AM - 6:00 PM"
                link="tel:+919417334348"
                linkText="+91 94173 34348"
              />
              
              <ContactInfo 
                icon={emailIcon}
                title="Email Us"
                details="We usually respond within 4 business hours"
                link="mailto:info@vmfinancialservices.com"
                linkText="info@vmfinancialservices.com"
              />
              
              <ContactInfo 
                icon={locationIcon}
                title="Visit Our Office"
                details="Motia Royal City, Zirakpur, 140603, India"
                link="https://maps.google.com"
                linkText="View on Map"
              />
              
              <ContactInfo 
                icon={whatsappIcon}
                title="WhatsApp Support"
                details="Quick responses for simple queries"
                link="https://wa.me/919417334348"
                linkText="Chat on WhatsApp"
              />
            </div>
          </div>
          
          {/* Map placeholder */}
          <div className="mt-10 md:mt-12 bg-sage/30 h-60 sm:h-80 rounded-lg flex items-center justify-center">
            <div className="text-navy/50">
              Map Placeholder - In a real application, this would be an embedded Google Map
            </div>
          </div>
          
          {/* Business hours */}
          <div className="mt-6 md:mt-8 card-light p-4 sm:p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-olive mb-4 heading-with-accent">Business Hours</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-olive mb-2">Office Hours</h3>
                <table className="w-full text-navy">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-4">Monday - Friday</td>
                      <td>10:00 AM - 6:00 PM</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4">Saturday</td>
                      <td>By Appointment Only</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4">Sunday</td>
                      <td>Closed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div>
                <h3 className="font-medium text-olive mb-2">Phone Support</h3>
                <table className="w-full text-navy">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-4">Monday - Friday</td>
                      <td>10:00 AM - 6:00 PM</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4">Saturday</td>
                      <td>11:00 AM - 3:00 PM</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4">Sunday</td>
                      <td>Closed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Compliance notice */}
          <div className="mt-8">
            <ComplianceNotice type="minimal" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
