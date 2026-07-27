import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, FileText, Shield, RefreshCw, AlertTriangle } from 'lucide-react';

const sections = [
  {
    id: 'terms',
    label: 'Terms & Conditions',
    icon: FileText,
    color: 'text-primary',
    bg: 'bg-primary/10',
    content: [
      {
        title: '1. About Rentora',
        body: `Rentora is a student-focused property listing, inspection facilitation, and rent payment platform operating in Ogbomosho, Nigeria. Rentora connects property seekers with verified property agents.\n\nRentora does NOT:\n• Own properties listed on the platform\n• Act as a landlord\n• Guarantee rental approval\n• Guarantee property availability at all times\n\nRentora DOES facilitate rent payments between renters and agents, holding funds in escrow as described in Section 5 below. Rentora operates strictly as a digital intermediary and escrow holder — it does not own or manage any listed property.`
      },
      {
        title: '2. User Accounts',
        body: `To access certain features, users must create an account.\n\nBy registering, you agree to:\n• Provide accurate and truthful information\n• Keep login credentials secure\n• Accept responsibility for all activities under your account\n\nRentora reserves the right to suspend accounts involved in fraudulent, abusive, or illegal behavior.`
      },
      {
        title: '3. Inspection Bookings',
        body: `Each listing has its own inspection fee, set by the agent (minimum ₦1,000).\n\nImportant Conditions:\n• Payment confirms inspection scheduling\n• If the assigned agent fails to attend, a refund may be issued\n• If the user fails to attend, the inspection is considered completed\n• Rentora is not responsible for rental negotiations or final rental agreements`
      },
      {
        title: '4. Rent Payments & Escrow',
        body: `When a renter pays rent for a property through Rentora, the payment includes:\n• The rent amount set by the agent\n• An agent fee, automatically calculated as 10% of the rent\n• A service fee, Rentora's own fee for facilitating the transaction\n\nRentora holds the rent and agent fee in escrow — not released to the agent — until the renter confirms they have moved in, or for a maximum of 5 days after payment, whichever comes first.\n\nOnce released, the agent receives the rent and agent fee in full. Rentora's only revenue from a rent transaction is the service fee; Rentora does not take any share of the rent or agent fee itself.\n\nOnce a rent payment is held for a property, that property is marked unavailable to other renters until the payment is resolved.`
      },
      {
        title: '5. Property Information Disclaimer',
        body: `While agents are required to upload verified and physically inspected properties, Rentora does not guarantee:\n• Property availability\n• Final rental price\n• Landlord approval\n• Accuracy of third-party information beyond agent submission\n\nUsers are advised to conduct independent verification before making rental payments.`
      },
      {
        title: '6. Prohibited Activities',
        body: `Users must NOT:\n• Attempt to bypass the platform for fraudulent purposes\n• Misuse agent or owner contact information\n• Harass agents or property owners\n• Attempt chargebacks after services have been delivered\n• Engage in illegal or abusive conduct\n\nViolation may result in suspension or termination.`
      },
      {
        title: '7. Limitation of Liability',
        body: `Rentora acts strictly as an intermediary and escrow holder between users and property agents.\n\nRentora shall not be liable for:\n• Rental disputes\n• Agreements between landlord and tenant\n• Off-platform payments\n• Financial losses resulting from rental decisions\n\nAll final agreements are strictly between the tenant and landlord.`
      },
      {
        title: '8. Governing Law',
        body: `These Terms are governed by the laws of the Federal Republic of Nigeria.`
      },
    ]
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    icon: Shield,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    content: [
      {
        title: '1. Information We Collect',
        body: `We may collect:\n• Full name\n• Phone number\n• Email address\n• Location\n• Payment confirmation data\n• Account activity logs`
      },
      {
        title: '2. How We Use Information',
        body: `Your information is used to:\n• Create and manage accounts\n• Process rent and inspection payments\n• Facilitate inspection bookings\n• Prevent fraud\n• Improve platform performance`
      },
      {
        title: '3. Payment Information',
        body: `All payments on Rentora are processed securely through third-party payment providers.\n\nRentora does NOT store:\n• Card numbers\n• CVV details\n• Bank card credentials`
      },
      {
        title: '4. Data Sharing',
        body: `Rentora does not sell user data.\n\nInformation may be shared:\n• With assigned agents for inspection purposes\n• When required by law\n• To prevent fraud or abuse`
      },
      {
        title: '5. Data Security',
        body: `We implement reasonable security measures, but no online system is 100% secure.`
      },
      {
        title: '6. Account Deletion',
        body: `Users may request account deletion by contacting support.`
      },
    ]
  },
  {
    id: 'refund',
    label: 'Refund Policy',
    icon: RefreshCw,
    color: 'text-green-600',
    bg: 'bg-green-50',
    content: [
      {
        title: '1. Inspection Fees',
        body: `Refund may be issued if:\n• The agent fails to attend a confirmed inspection\n• The property is confirmed unavailable at booking time\n\nRefund will NOT be issued if:\n• User fails to attend inspection\n• User changes mind after booking\n• Inspection has been completed\n\nRefund processing time: 3–7 business days.`
      },
      {
        title: '2. Rent Payments',
        body: `Rent, the agent fee, and the service fee are held in escrow once paid, and are not immediately refundable while held.\n\nA refund may be issued while a payment is still held if:\n• The property is confirmed unavailable, misrepresented, or does not exist\n• The agent is unresponsive or unable to complete the move-in process\n\nOnce a rent payment has been released to the agent (after move-in confirmation or the 5-day auto-release), it is no longer refundable through Rentora — any dispute at that point is handled directly between the tenant and agent, with Rentora's admin team available to assist per Section 8 of the Terms & Conditions.\n\nTo raise a rent payment issue before release, contact support@rentora.com.ng as soon as possible.`
      },
    ]
  },
  {
    id: 'disclaimer',
    label: 'Disclaimer',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    content: [
      {
        title: 'Platform Disclaimer',
        body: `Rentora is not a landlord or property owner.\n\nRentora operates strictly as a digital marketplace connecting property seekers and verified agents.\n\nAll rental agreements are made directly between tenants and landlords.\n\nUsers are advised to verify all agreements before making rental payments.`
      },
    ]
  },
];

export function TermsAndPolicies() {
  const navigate = useNavigate();
  const [active, setActive] = useState('terms');

  const current = sections.find(s => s.id === active);
  const Icon = current.icon;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-5 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Legal & Policies</h1>
        <p className="text-muted-foreground mt-2 text-sm">Last updated: July 2026</p>
      </div>

      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {sections.map(s => {
          const SIcon = s.icon;
          return (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                active === s.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}>
              <SIcon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-5 border-b">
          <div className={`w-10 h-10 rounded-xl ${current.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${current.color}`} />
          </div>
          <h2 className="text-xl font-bold">{current.label}</h2>
        </div>

        <div className="space-y-6">
          {current.content.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold text-base mb-2">{section.title}</h3>
              <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">{section.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Questions? <a href="/contact" className="text-primary hover:underline">Contact us</a>
      </p>
    </div>
  );
}

export default TermsAndPolicies;