import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export function Privacy() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link to="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
      </Button>

      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-foreground/60 mt-2">Last updated: January 2025</p>
      </div>

      <div className="prose prose-sm max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-bold mb-3">Introduction</h2>
          <p className="text-foreground/70 leading-relaxed">
            At Rentora, we are committed to protecting your privacy and ensuring the security of your personal information. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our student accommodation platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-2">Personal Information</h3>
              <p className="text-foreground/70 leading-relaxed">
                When you create an account or use our services, we may collect:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-foreground/70">
                <li>Full name, email address, and phone number</li>
                <li>Student ID and university affiliation (LAUTECH)</li>
                <li>Profile picture and bio (optional)</li>
                <li>Payment information (processed securely through Paystack)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2">Property Information</h3>
              <p className="text-foreground/70 leading-relaxed">
                For property listings, we collect property details, images, pricing, and location data provided by agents.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2">Usage Data</h3>
              <p className="text-foreground/70 leading-relaxed">
                We automatically collect information about how you interact with our platform, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-foreground/70">
                <li>Device information (browser type, OS, device ID)</li>
                <li>IP address and location data</li>
                <li>Pages visited, search queries, and features used</li>
                <li>Time and date of visits</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">How We Use Your Information</h2>
          <p className="text-foreground/70 leading-relaxed mb-2">
            We use the information we collect for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-foreground/70">
            <li>To provide, operate, and maintain our platform</li>
            <li>To process bookings and payments securely</li>
            <li>To verify student and agent identities</li>
            <li>To send you notifications about bookings, messages, and updates</li>
            <li>To improve our services and develop new features</li>
            <li>To detect and prevent fraud, security issues, and technical problems</li>
            <li>To comply with legal obligations and enforce our Terms of Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Information Sharing</h2>
          <p className="text-foreground/70 leading-relaxed mb-2">
            We do not sell or rent your personal information to third parties. We may share your information only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-foreground/70">
            <li><strong>With Agents:</strong> Your name, email, and phone number are shared with agents when you book a property</li>
            <li><strong>With Payment Processors:</strong> Payment information is securely processed through Paystack</li>
            <li><strong>With Service Providers:</strong> We may share data with trusted service providers who help us operate our platform</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal requests</li>
            <li><strong>Business Transfers:</strong> If Rentora is acquired or merged, your information may be transferred to the new entity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Data Security</h2>
          <p className="text-foreground/70 leading-relaxed">
            We implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits. 
            However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Your Rights</h2>
          <p className="text-foreground/70 leading-relaxed mb-2">You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 text-foreground/70">
            <li>Access, update, or delete your personal information</li>
            <li>Opt-out of marketing communications</li>
            <li>Request a copy of your data</li>
            <li>Object to or restrict certain data processing activities</li>
            <li>Delete your account at any time</li>
          </ul>
          <p className="text-foreground/70 leading-relaxed mt-3">
            To exercise these rights, please contact us at <a href="mailto:privacy@rentora.com.ng" className="text-primary font-medium hover:underline">privacy@rentora.com.ng</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Cookies and Tracking</h2>
          <p className="text-foreground/70 leading-relaxed">
            We use cookies and similar tracking technologies to improve your experience, analyze usage patterns, and remember your preferences. 
            You can control cookie settings through your browser, but disabling cookies may affect platform functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Children's Privacy</h2>
          <p className="text-foreground/70 leading-relaxed">
            Rentora is intended for university students (18+). We do not knowingly collect information from individuals under 18 years old. 
            If you believe we have inadvertently collected such information, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Changes to This Policy</h2>
          <p className="text-foreground/70 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page 
            and updating the "Last updated" date. Your continued use of Rentora after changes are posted constitutes your acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Contact Us</h2>
          <p className="text-foreground/70 leading-relaxed">
            If you have questions or concerns about this Privacy Policy, please contact us:
          </p>
          <div className="mt-3 text-foreground/70">
            <p><strong>Email:</strong> <a href="mailto:privacy@rentora.com.ng" className="text-primary font-medium hover:underline">privacy@rentora.com.ng</a></p>
            <p className="mt-1"><strong>Phone:</strong> +234 913 113 3832</p>
            <p className="mt-1"><strong>Address:</strong> Ogbomoso, Oyo State, Nigeria</p>
          </div>
        </section>
      </div>

      <div className="mt-12 p-6 bg-muted/30 rounded-2xl border border-border/60 text-center">
        <p className="text-sm text-foreground/70">
          By using Rentora, you agree to this Privacy Policy and our{' '}
          <Link to="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}

export default Privacy;
