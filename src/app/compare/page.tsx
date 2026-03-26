import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import FundComparison from '@/components/FundComparison';

export const metadata = {
  title: 'Fund Comparison — Vijay Malik Financial Services',
  description: 'Compare mutual funds side by side with interactive charts and detailed performance metrics.',
};

export default function ComparePage() {
  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">
        <header className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Compare Funds
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Side-by-side performance, risk metrics, and holdings analysis across any two mutual fund schemes.
          </p>
        </header>

        <FundComparison />

        <p className="text-center text-xs text-[#3c4a3e] font-mono mt-10 max-w-2xl mx-auto leading-relaxed">
          Mutual fund investments are subject to market risks. Read all scheme related documents carefully.
          Past performance is not indicative of future results. Vijay Malik Financial Services is an AMFI-registered distributor · ARN-317605.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
