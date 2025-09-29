"use client";

import Link from 'next/link';
import Image from 'next/image';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';
import AnimatedElement from '@/components/ui/AnimatedElement';

// Team Member Type
type TeamMember = {
  name: string;
  role: string;
  description: string;
  certifications: string[];
  imagePath?: string;
};

// Team member card component
const TeamMemberCard = ({ member, index }: { member: TeamMember; index: number }) => {
  // Function to get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  return (
    <div className="bg-gradient-to-br from-white via-brand-pearl to-blue-50/30 rounded-2xl overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
      {/* Team member photo or initials */}
      <div className="h-60 relative overflow-hidden">
        {member.imagePath ? (
          <Image 
            src={member.imagePath} 
            alt={`${member.name}, ${member.role}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            priority={index === 0}
          />
        ) : (
          <div className="bg-gradient-to-br from-brand-royal to-brand-navy h-full w-full flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-gold to-yellow-400 flex items-center justify-center shadow-xl">
              <span className="text-4xl font-bold text-brand-navy">
                {getInitials(member.name)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <div className="flex items-center mb-2">
          <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse mr-3"></div>
          <h3 className="text-lg font-bold text-brand-navy">{member.name}</h3>
        </div>
        <p className="text-brand-royal font-medium text-sm mb-4">{member.role}</p>
        <p className="text-brand-navy/80 text-sm mb-4 leading-relaxed">{member.description}</p>
        
        {member.certifications.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {member.certifications.map((cert, index) => (
              <span key={index} className="bg-gradient-to-r from-brand-gold/20 to-yellow-100 text-brand-navy text-xs px-3 py-1.5 rounded-full font-medium border border-brand-gold/30">
                {cert}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Milestone component
const Milestone = ({ year, title, description, index }: { year: string; title: string; description: string; index: number }) => {
  return (
    <div className="flex mb-8">
      <div className="mr-6 text-center">
        <div className="h-10 w-10 rounded-full bg-olive text-white flex items-center justify-center font-semibold">
          {year}
        </div>
        <div className="h-full w-0.5 bg-sage mx-auto mt-2"></div>
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-lg font-semibold text-brand-navy mb-2">{title}</h3>
        <p className="text-sm text-brand-navy">{description}</p>
      </div>
    </div>
  );
};

// Values section component
const ValueCard = ({ title, description, index }: { title: string; description: string; index: number }) => {
  return (
    <div className="card-light rounded-2xl p-4 sm:p-6 h-full">
      <h3 className="text-lg font-semibold text-brand-navy mb-3">{title}</h3>
      <p className="text-sm text-brand-navy">{description}</p>
    </div>
  );
};

export default function AboutPage() {
  // Team members data
  const teamMembers: TeamMember[] = [
    {
      name: 'Vijay Malik',
      role: 'Founder & Chief Investment Officer(2021-2024)',
      description: 'With over 30 years Banking Industry, Vijay lead our investment research and client advisory services with a focus on long-term wealth creation.',
      certifications: ['AMFI Registered', 'NISM Certified','Retd. Canara Bank'],
      imagePath: '/About/CEO.jpg'
    },
    {
      name: 'Ojasvi Malik',
      role: 'AMFI Registered Mutual Fund Distributor (Sole Proprietorship)',
      description: 'Ojasvi ensures our clients receive personalized attention and clear communication about their investments, with expertise in goal-based financial planning.',
      certifications: ['NISM Certified', 'AMFI Registered']
      // No imagePath - will show initials
    }
  ];
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <h1 className="text-3xl font-bold text-brand-navy mb-4 heading-with-accent relative">
            <span className="relative z-10">About </span>
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold bg-clip-text text-transparent">Us</span>
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent animate-pulse"></span>
            </span>
          </h1>
          
          {/* Mission section */}
          <div className="mb-12 md:mb-16">
            <p className="text-xl text-brand-navy mb-6 md:mb-8">
              Vijay Malik Financial Services is a 
              <span className="relative inline-block mx-1">
                <span className="text-brand-gold font-semibold">mutual fund distribution</span>
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-brand-gold/50"></span>
              </span>
              firm focused on helping 
              <span className="bg-gradient-to-r from-brand-navy to-brand-royal bg-clip-text text-transparent font-semibold">Indian families</span>
              {' '}achieve{' '}
              <span className="text-brand-gold font-bold underline decoration-brand-gold/50 decoration-wavy">financial independence</span>
              {' '}through disciplined, goal-oriented investing.
            </p>
            
            <div className="card-light p-4 sm:p-8 rounded-2xl group hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-2xl font-semibold text-brand-navy mb-4 group-hover:text-brand-royal transition-colors">
                Our <span className="text-brand-gold">Mission</span>
              </h2>
              <p className="text-lg text-brand-navy">
                To <span className="font-semibold text-brand-gold">democratize access</span> to quality investment products and guidance, 
                empowering <span className="bg-brand-gold/10 px-1 py-0.5 rounded font-medium text-brand-navy">everyday Indians</span> to build wealth through 
                <span className="font-bold text-brand-royal">transparency</span>, 
                <span className="font-bold text-brand-royal">education</span>, and 
                <span className="font-bold text-brand-royal">disciplined investing</span>.
              </p>
            </div>
          </div>
            
            {/* Journey section */}
            <div className="mb-16">
              <h2 className="text-2xl font-semibold text-brand-navy mb-6 heading-with-accent">Our Journey</h2>
              
              <Milestone 
                year="2021"
                title="Founded in Chandigarh"
                description="Vijay Malik established the firm with a focus on personalized mutual fund advice for families and young professionals."
                index={0}
              />
              
              <Milestone 
                year="2025"
                title="Expanded to Digital Services"
                description="Launched our online platform to reach investors across India, especially in tier-2 and tier-3 cities with limited access to financial guidance."
                index={1}
              />
              
              <Milestone 
                year="2025"
                title="Introduced Goal Planning Tools"
                description="Developed specialized calculators and planning frameworks to help clients align investments with specific life goals."
                index={2}
              />
              
              <Milestone 
                year="2025"
                title="Reached 1000+ Families"
                description="Achieved the milestone of guiding 10,000 families on their investment journey with a focus on long-term SIPs."
                index={3}
              />
              
              <Milestone 
                year="2025"
                title="Launched Educational Content"
                description="Expanded our commitment to investor education through webinars, workshops, and our comprehensive financial literacy blog."
                index={4}
              />
            </div>
            
            {/* Values section */}
            <div className="mb-16">
              <h2 className="text-2xl font-semibold text-brand-navy mb-6">Our Values</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ValueCard 
                  title="Transparency" 
                  description="We believe in clear communication about product features, risks, costs, and our compensation structure." 
                  index={0}
                />
                
                <ValueCard 
                  title="Education" 
                  description="We empower clients with knowledge, ensuring they understand their investments rather than just following recommendations." 
                  index={1}
                />
                
                <ValueCard 
                  title="Client Focus" 
                  description="Every recommendation starts with understanding client goals, risk comfort, and time horizons." 
                  index={2}
                />
                
                <ValueCard 
                  title="Long-term Perspective" 
                  description="We promote disciplined investing for wealth creation rather than market timing or speculative approaches." 
                  index={3}
                />
              </div>
            </div>
            
            {/* Team section */}
            <div className="mb-16">
              <h2 className="text-2xl font-semibold text-brand-navy mb-6 heading-with-accent">Our Team</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {teamMembers.map((member, index) => (
                  <TeamMemberCard key={index} member={member} index={index} />
                ))}
              </div>
            </div>
            
            {/* Registration section */}
            <div className="mb-12 md:mb-16 bg-gray-100 p-4 sm:p-6 rounded-2xl">
              <h2 className="text-xl font-semibold text-brand-navy mb-4">Registration & Compliance</h2>
              
              <div className="space-y-4 text-brand-navy">
                <div className="bg-gray-200 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    Vijay Malik Financial Services (Sole Proprietorship) is an AMFI Registered Mutual Fund Distributor (ARN-317605). All mutual fund investments are subject to market risks, read all scheme related documents carefully before investing.
                  </p>
                </div>
                <p>
                  <span className="font-medium">AMFI Registration:</span> 317605
                </p>
                <p>
                  <span className="font-medium">EUIN:</span> E601818
                </p>
                <p>
                  <span className="font-medium">NISM Certification:</span>&nbsp;Ojasvi Malik holds valid NISM Series V-A certification as required by SEBI
                </p>
                <p>
                  <span className="font-medium">KYC Registration:</span> Registered with CVL KRA
                </p>
                <p>
                  <span className="font-medium">Grievance Handling:</span> <Link href="/disclosures" className="text-teal hover:underline">View our grievance handling procedure</Link>
                </p>
              </div>
            </div>
            
            {/* Compliance notice */}
            <div className="mb-8 md:mb-12">
              <ComplianceNotice type="standard" />
            </div>
            
            {/* CTA section */}
            <div className="text-center">
              <h2 className="text-xl font-semibold text-brand-navy mb-4">Ready to Start Your Investment Journey?</h2>
              <p className="text-sm text-brand-navy mb-2">
                Schedule a complimentary 20-minute consultation to discuss your financial goals.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/goal-planning#lead-form" className="btn-primary">
                  Schedule a Call
                </Link>
                <Link href="/partners" className="btn-secondary">
                  View Our Partners
                </Link>
              </div>
            </div>
          </ResponsiveContainer>
        </Section>
    </>
  );
}
