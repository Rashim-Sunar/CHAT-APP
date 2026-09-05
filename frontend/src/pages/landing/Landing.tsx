import LandingNav from "./sections/LandingNav";
import Hero from "./sections/Hero";
import TechStrip from "./sections/TechStrip";
import Pillars from "./sections/Pillars";
import PersonalChatSection from "./sections/PersonalChatSection";
import GroupChatSection from "./sections/GroupChatSection";
import SecurityExplainer from "./sections/SecurityExplainer";
import HowItWorks from "./sections/HowItWorks";
import Faq from "./sections/Faq";
import FinalCta from "./sections/FinalCta";
import LandingFooter from "./sections/LandingFooter";

const Landing = () => (
  <div className="landing-page min-h-screen bg-white font-body text-ink antialiased">
    <LandingNav />
    <main>
      <Hero />
      <TechStrip />
      <Pillars />
      <PersonalChatSection />
      <GroupChatSection />
      <SecurityExplainer />
      <HowItWorks />
      <Faq />
      <FinalCta />
    </main>
    <LandingFooter />
  </div>
);

export default Landing;
