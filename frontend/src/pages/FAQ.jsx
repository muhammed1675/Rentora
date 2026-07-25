import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, HelpCircle, ChevronDown, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I create an account on Rentora?',
        a: 'Click the "Register" button in the top right corner, fill in your details (name, email, password, and LAUTECH student ID), and verify your email. Once verified, you can start browsing and booking properties.',
      },
      {
        q: 'Is Rentora only for LAUTECH students?',
        a: 'Yes, Rentora is specifically designed for LAUTECH students. You'll need a valid LAUTECH student ID to register and access our platform.',
      },
      {
        q: 'How do I search for accommodation?',
        a: 'Use the Browse page to search for properties. You can filter by location, price range, property type, and amenities. Our advanced search helps you find exactly what you need.',
      },
    ],
  },
  {
    category: 'Booking & Payments',
    questions: [
      {
        q: 'How do I book a property?',
        a: 'Once you find a property you like, click "Book Now" on the property details page. You'll be guided through the payment process using Paystack. After payment confirmation, the agent will contact you to finalize the move-in details.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We accept all major payment methods through Paystack, including debit/credit cards, bank transfers, and USSD. All payments are secure and encrypted.',
      },
      {
        q: 'Can I get a refund if I change my mind?',
        a: 'Refund policies depend on the agent and how far in advance you cancel. Generally, cancellations made 30+ days before move-in are eligible for full refunds. Check the property's cancellation policy before booking.',
      },
      {
        q: 'Do I pay the full rent upfront?',
        a: 'Payment terms vary by property. Some require full annual rent upfront, while others accept semester-based payments. Check the property listing for specific payment terms.',
      },
    ],
  },
  {
    category: 'Properties & Verification',
    questions: [
      {
        q: 'How do I know a property is verified?',
        a: 'All verified properties display a blue "Verified" badge. This means our team has physically inspected the property, confirmed the agent's identity, and validated the listing details.',
      },
      {
        q: 'What if the property doesn't match the listing?',
        a: 'If a property significantly differs from its listing, contact us immediately via the Contact page or email support@rentora.com.ng. We take listing accuracy seriously and will investigate any discrepancies.',
      },
      {
        q: 'Can I visit a property before booking?',
        a: 'Absolutely! We encourage students to visit properties before booking. Contact the agent directly through the platform to schedule a viewing.',
      },
      {
        q: 'How often are property listings updated?',
        a: 'Agents update listings in real-time. If a property is marked as available, it should be ready for booking. However, we recommend confirming availability with the agent before payment.',
      },
    ],
  },
  {
    category: 'Agents & Communication',
    questions: [
      {
        q: 'How do I contact a property agent?',
        a: 'Each property listing includes the agent's contact information. You can call, email, or message them directly through the platform.',
      },
      {
        q: 'What if an agent isn't responding?',
        a: 'If an agent doesn't respond within 24 hours, please report them via the Contact page. We monitor agent responsiveness and take action against unresponsive agents.',
      },
      {
        q: 'How do I become an agent on Rentora?',
        a: 'Visit the "Become an Agent" page and submit your application. You'll need to provide verification documents, and our team will review your application within 3-5 business days.',
      },
    ],
  },
  {
    category: 'Account & Security',
    questions: [
      {
        q: 'How do I reset my password?',
        a: 'Click "Forgot Password" on the login page, enter your email, and we'll send you a password reset link. Follow the instructions in the email to create a new password.',
      },
      {
        q: 'Is my personal information safe?',
        a: 'Yes. We use industry-standard encryption and security measures to protect your data. Read our Privacy Policy for more details on how we handle your information.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Go to your Profile page, scroll to the bottom, and click "Delete Account". This action is permanent and cannot be undone.',
      },
      {
        q: 'How do I update my profile information?',
        a: 'Log in and go to your Profile page. You can update your name, email, phone number, profile picture, and bio from there.',
      },
    ],
  },
  {
    category: 'Troubleshooting',
    questions: [
      {
        q: 'Why can't I log in?',
        a: 'Make sure you're using the correct email and password. If you forgot your password, use the "Forgot Password" link. If the issue persists, clear your browser cache or contact support.',
      },
      {
        q: 'My payment was successful but my booking wasn't confirmed. What should I do?',
        a: 'Payment confirmations can take a few minutes. If your booking isn't confirmed within 10 minutes, contact us at support@rentora.com.ng with your payment reference number.',
      },
      {
        q: 'The website is loading slowly. What can I do?',
        a: 'Try refreshing the page, clearing your browser cache, or switching to a different browser. If the issue persists, it may be a temporary server issue — please try again later.',
      },
    ],
  },
];

export function FAQ() {
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  const filteredFaqs = useMemo(() => {
    if (!search.trim()) return faqs;

    const query = search.toLowerCase();
    return faqs
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (faq) =>
            faq.q.toLowerCase().includes(query) ||
            faq.a.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [search]);

  const toggleQuestion = (catIdx, qIdx) => {
    const key = `${catIdx}-${qIdx}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link to="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
      </Button>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-foreground/60 mt-2">Find answers to common questions about Rentora</p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <Input
            type="text"
            placeholder="Search for questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 text-base"
          />
        </div>
        {search && (
          <p className="text-center text-sm text-foreground/60 mt-3">
            {filteredFaqs.reduce((acc, cat) => acc + cat.questions.length, 0)} result(s) found
          </p>
        )}
      </div>

      {/* FAQ Categories */}
      {filteredFaqs.length > 0 ? (
        <div className="space-y-8">
          {filteredFaqs.map((category, catIdx) => (
            <section key={catIdx}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full" />
                {category.category}
              </h2>
              <div className="space-y-3">
                {category.questions.map((faq, qIdx) => {
                  const key = `${catIdx}-${qIdx}`;
                  const isOpen = openIndex === key;

                  return (
                    <Card
                      key={qIdx}
                      className="border-border/60 overflow-hidden transition-colors hover:border-primary/30"
                    >
                      <button
                        onClick={() => toggleQuestion(catIdx, qIdx)}
                        className="w-full text-left p-5 flex items-start justify-between gap-4"
                      >
                        <span className="font-semibold text-foreground">{faq.q}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-foreground/40 shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-0">
                          <div className="border-t border-border/60 pt-4">
                            <p className="text-foreground/70 leading-relaxed">{faq.a}</p>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/60">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-foreground/40" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No results found</h3>
          <p className="text-foreground/60 mb-6">
            We couldn't find any questions matching "{search}". Try different keywords or browse all categories.
          </p>
          <Button onClick={() => setSearch('')} variant="outline">
            Clear Search
          </Button>
        </Card>
      )}

      {/* Contact CTA */}
      <Card className="mt-12 p-8 bg-primary/5 border-primary/20 text-center">
        <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
        <h3 className="font-semibold text-lg mb-2">Still have questions?</h3>
        <p className="text-foreground/60 mb-5">
          Can't find what you're looking for? Our support team is here to help.
        </p>
        <Button asChild>
          <Link to="/contact">Contact Support</Link>
        </Button>
      </Card>
    </div>
  );
}

export default FAQ;
