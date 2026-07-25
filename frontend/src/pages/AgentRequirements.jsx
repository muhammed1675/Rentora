import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, FileText, Shield, Clock, DollarSign, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function AgentRequirements() {
  const requirements = [
    {
      icon: FileText,
      title: 'Valid Identification',
      items: [
        "National ID Card, Driver's License, or International Passport",
        'Proof of address (utility bill or bank statement)',
        'Business registration documents (if applicable)',
      ],
    },
    {
      icon: Shield,
      title: 'Property Verification',
      items: [
        'Proof of property ownership or authorized agency agreement',
        'Property inspection approval from Rentora team',
        'Accurate property photos and descriptions',
      ],
    },
    {
      icon: Users,
      title: 'Professional Standards',
      items: [
        'Respond to inquiries within 24 hours',
        'Maintain at least 80% positive review rating',
        'Provide accurate listing information',
      ],
    },
    {
      icon: DollarSign,
      title: 'Payment & Pricing',
      items: [
        'Competitive and transparent pricing',
        "Accept payments through Rentora's secure platform",
        'Clear cancellation and refund policies',
      ],
    },
  ];

  const benefits = [
    'Access to thousands of verified LAUTECH students',
    'Free property listing for the first 30 days',
    'Secure payment processing with Paystack',
    'Dashboard to manage listings, bookings, and analytics',
    'Marketing support and visibility on our platform',
    'Dedicated agent support team',
  ];

  const steps = [
    { title: 'Submit Application', desc: 'Fill out the agent application form with your details' },
    { title: 'Document Verification', desc: 'Upload required documents for identity and property verification' },
    { title: 'Property Inspection', desc: 'Our team will schedule a property inspection' },
    { title: 'Approval & Onboarding', desc: 'Get approved and start listing properties within 3-5 days' },
  ];

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link to="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
      </Button>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <BadgeCheck className="w-3.5 h-3.5" />
          Join Our Trusted Agent Network
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Agent Requirements</h1>
        <p className="text-lg text-foreground/60 max-w-2xl mx-auto leading-relaxed">
          Become a verified Rentora agent and connect with hundreds of LAUTECH students 
          looking for quality accommodation. Here's what you need to know.
        </p>
      </div>

      {/* Requirements Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">What You Need to Qualify</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {requirements.map((req, idx) => (
            <Card key={idx} className="p-6 border-border/60">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <req.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-3">{req.title}</h3>
                  <ul className="space-y-2">
                    {req.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Application Process */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">How to Become an Agent</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              <Card className="p-6 border-border/60 h-full">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg mb-4">
                  {idx + 1}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-foreground/60 leading-relaxed">{step.desc}</p>
              </Card>
              {idx < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-2 -translate-y-1/2 w-5 h-5 text-foreground/30" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-foreground/60 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Typical approval time: 3-5 business days
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">Why Join Rentora?</h2>
        <Card className="p-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-foreground/80">{benefit}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Agent Responsibilities */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">Your Responsibilities as an Agent</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-border/60">
            <h3 className="font-semibold mb-3">Listing Accuracy</h3>
            <p className="text-sm text-foreground/70 leading-relaxed">
              Ensure all property details, photos, and pricing are accurate and up-to-date. 
              Misleading information can result in account suspension.
            </p>
          </Card>
          <Card className="p-6 border-border/60">
            <h3 className="font-semibold mb-3">Timely Communication</h3>
            <p className="text-sm text-foreground/70 leading-relaxed">
              Respond to student inquiries within 24 hours. Maintain professional and respectful communication at all times.
            </p>
          </Card>
          <Card className="p-6 border-border/60">
            <h3 className="font-semibold mb-3">Property Maintenance</h3>
            <p className="text-sm text-foreground/70 leading-relaxed">
              Keep properties in good condition. Address maintenance issues promptly and ensure student safety.
            </p>
          </Card>
        </div>
      </section>

      {/* Fees & Pricing */}
      <section className="mb-16">
        <Card className="p-8 border-border/60">
          <h2 className="text-2xl font-bold mb-4 text-center">Fees & Pricing</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border/60">
              <span className="font-medium">Application Fee</span>
              <span className="text-primary font-semibold">Free</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/60">
              <span className="font-medium">First 30 Days of Listing</span>
              <span className="text-primary font-semibold">Free</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/60">
              <span className="font-medium">Monthly Listing Fee (After 30 days)</span>
              <span className="text-primary font-semibold">₦2,000/property</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="font-medium">Transaction Fee (Per Booking)</span>
              <span className="text-primary font-semibold">5% of booking value</span>
            </div>
          </div>
          <p className="text-sm text-foreground/60 text-center mt-6">
            All fees are subject to change. You'll be notified 30 days in advance of any pricing updates.
          </p>
        </Card>
      </section>

      {/* CTA */}
      <section className="text-center">
        <Card className="p-10 bg-primary text-white border-none">
          <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">
            Join Rentora today and start connecting with LAUTECH students looking for verified accommodation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link to="/become-agent">Apply Now</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white/10">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

export default AgentRequirements;
